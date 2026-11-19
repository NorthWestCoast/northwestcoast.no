-- Oppfølging av servicesertifikatet og vedlikeholdsrapporter fra admin.

-- ── 1. Varsling når NorthWest Coast loggfører vedlikehold ───────────────────
-- Før ble bare loggføringer fra Min side varslet (til dem som styrer
-- leideren). Når en administrator loggfører arbeid på kundens leider, skal
-- kunden få vite det.
create or replace function public.maintenance_logs_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_serial text;
begin
  if new.ladder_id is null or new.kind in ('usage', 'note')
     or new.source not in ('portal', 'admin') then
    return new;
  end if;

  select l.serial_number into v_serial from public.ladders l where l.id = new.ladder_id;

  if new.source = 'admin' then
    perform app.notify_ladder_users(
      new.ladder_id, 'log_entry',
      'NorthWest Coast har loggført arbeid på leider ' || v_serial,
      coalesce(new.title, 'Vedlikehold'),
      '/minside/leider/' || new.ladder_id || '?fane=historikk'
    );
  else
    perform app.notify_ladder_managers(
      new.ladder_id, 'log_entry',
      'Ny loggføring på leider ' || v_serial,
      coalesce(new.title, 'Vedlikehold') ||
        case when new.reporter_name is not null then ' – ' || new.reporter_name else '' end,
      '/minside/leider/' || new.ladder_id
    );
  end if;
  return new;
end;
$$;

-- ── 2. Sertifikat som trekkes tilbake ───────────────────────────────────────
-- Kunden varsles, uansett om en administrator trekker det tilbake for hånd
-- eller det skjer fordi leideren ikke ble godkjent ved en senere service.
create or replace function public.ladder_certificates_notify_revoked()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    perform app.notify_ladder_users(
      new.ladder_id, 'certificate_revoked',
      'Servicesertifikat ' || new.certificate_number || ' er trukket tilbake',
      new.revoked_reason,
      '/minside/leider/' || new.ladder_id || '?fane=historikk'
    );
  end if;
  return new;
end;
$$;

create trigger ladder_certificates_notify_revoked
  after update of revoked_at on public.ladder_certificates
  for each row execute function public.ladder_certificates_notify_revoked();

-- En registrert servicerapport avslutter åpne bestillinger og varsler kunden.
-- Ble leideren ikke godkjent, kan den ikke samtidig ha et gyldig sertifikat:
-- det gjeldende trekkes tilbake.
create or replace function public.service_reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_serial text;
begin
  update public.service_bookings
     set status = 'completed', service_report_id = new.id
   where ladder_id = new.ladder_id and status in ('requested', 'scheduled');

  select l.serial_number into v_serial from public.ladders l where l.id = new.ladder_id;

  perform app.notify_ladder_users(
    new.ladder_id, 'service_done',
    'Service registrert på leider ' || v_serial,
    case new.result
      when 'ok' then 'Godkjent.'
      when 'ok_with_remarks' then 'Godkjent med anmerkning.'
      else 'Ikke godkjent – se rapporten.'
    end,
    '/minside/leider/' || new.ladder_id
  );

  if new.result = 'failed' then
    update public.ladder_certificates
       set revoked_at = now(),
           revoked_reason = 'Leideren ble ikke godkjent ved service '
                            || to_char(new.performed_at, 'DD.MM.YYYY') || '.'
     where ladder_id = new.ladder_id
       and revoked_at is null and replaced_by is null;
  end if;

  return new;
end;
$$;

-- ── 3. Den delte rapporten til los ──────────────────────────────────────────
-- Tar med det gjeldende sertifikatet, prosjektet når leideren ikke står på et
-- fartøy, og riktig lengde for spesiallengder.
create or replace function public.get_ladder_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash  text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  v_share record;
begin
  if length(coalesce(p_token, '')) < 20 then
    return null;
  end if;

  select s.* into v_share
  from public.ladder_state_shares s
  where s.token_hash = v_hash;

  if v_share.id is null then
    return null;
  end if;
  if v_share.revoked_at is not null then
    return jsonb_build_object('state', 'revoked');
  end if;
  if v_share.expires_at <= now() then
    return jsonb_build_object('state', 'expired');
  end if;

  update public.ladder_state_shares
     set view_count = view_count + 1, last_viewed_at = now()
   where id = v_share.id;

  return (
    select jsonb_build_object(
      'state', 'active',
      'share_id', v_share.id,
      'title', v_share.title,
      'note', v_share.note,
      'recipient', v_share.recipient,
      'checklist', v_share.checklist,
      'created_at', v_share.created_at,
      'created_by_name', v_share.created_by_name,
      'expires_at', v_share.expires_at,
      'ladder', jsonb_build_object(
        'serial_number', l.serial_number,
        'product_name', p.name,
        'product_number', p.product_number,
        'length_m', coalesce(l.custom_length_m, p.length_m),
        'steps', case when l.custom_length_m is null then p.steps end,
        'produced_at', l.produced_at,
        'installed_at', l.installed_at
      ),
      'vessel', case when v.id is not null then jsonb_build_object(
        'name', v.name, 'imo', v.imo, 'call_sign', v.call_sign
      ) end,
      'project', case when pr.id is not null then jsonb_build_object(
        'name', pr.name, 'kind', pr.kind, 'location', pr.location
      ) end,
      'certificate', (
        select jsonb_build_object(
          'certificate_number', lc.certificate_number,
          'issued_on', lc.issued_on,
          'valid_until', lc.valid_until,
          'expired', lc.valid_until < current_date,
          'verify_token', lc.verify_token)
        from public.ladder_certificates lc
        where lc.ladder_id = l.id and lc.revoked_at is null and lc.replaced_by is null
        order by lc.issued_on desc, lc.created_at desc limit 1
      ),
      'last_service', (
        select jsonb_build_object(
          'performed_at', sr.performed_at, 'result', sr.result,
          'next_service_due', sr.next_service_due, 'performed_by', sr.performed_by)
        from public.service_reports sr
        where sr.ladder_id = l.id
        order by sr.performed_at desc, sr.created_at desc limit 1
      ),
      'recent_logs', (
        select coalesce(jsonb_agg(x order by x ->> 'performed_at' desc), '[]'::jsonb)
        from (
          select jsonb_build_object(
            'performed_at', m.performed_at, 'kind', m.kind,
            'title', m.title, 'reporter_name', m.reporter_name) as x
          from public.maintenance_logs m
          where m.ladder_id = l.id
          order by m.performed_at desc limit 5
        ) recent
      ),
      'photos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'path', ph.storage_path, 'kind', ph.kind,
          'captured_at', ph.captured_at, 'caption', ph.caption)
          order by ph.captured_at), '[]'::jsonb)
        from public.ladder_state_photos ph where ph.share_id = v_share.id
      )
    )
    from public.ladders l
    join public.products p on p.id = l.product_id
    left join public.vessels v on v.id = l.vessel_id
    left join public.projects pr on pr.id = l.project_id
    where l.id = v_share.ladder_id
  );
end;
$$;
