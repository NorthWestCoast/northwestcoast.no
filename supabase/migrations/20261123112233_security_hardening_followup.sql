-- Gjennomgang 23.11.2026: det som ikke ble med i rettelsene 19.11.
--
-- Som før er RLS og funksjonene her den eneste virkelige grensen: nettlaget
-- har ingen servicenøkkel, og alt under gjelder kall rett mot API-et.

-- ── 1. Medlemmer på fartøy og leidere kommer bare via samtykke ──────────────
-- Som for selskap (19.11): ingen setter inn medlemmer direkte. Tilgang gis
-- når mottakeren godtar en invitasjon (accept_invitation) eller en
-- forespørsel godkjennes (decide_ladder_access). På et medlemskap kan bare
-- rollen endres. Å fjerne et medlem og å forlate et fartøy virker som før.
drop policy vessel_members_manage on public.vessel_members;
revoke insert, update on public.vessel_members from authenticated;
grant update (role) on public.vessel_members to authenticated;

create policy vessel_members_update on public.vessel_members
  for update to authenticated
  using (exists (select 1 from public.vessels v
                 where v.id = vessel_id and app.is_company_admin(v.company_id))
         or app.is_staff())
  with check (exists (select 1 from public.vessels v
                      where v.id = vessel_id and app.is_company_admin(v.company_id))
              or app.is_staff());

create policy vessel_members_delete on public.vessel_members
  for delete to authenticated
  using (exists (select 1 from public.vessels v
                 where v.id = vessel_id and app.is_company_admin(v.company_id))
         or app.is_staff());

drop policy ladder_members_insert on public.ladder_members;
revoke insert, update on public.ladder_members from authenticated;
grant update (role) on public.ladder_members to authenticated;

-- ── 2. Nyhetene: hvem som skrev dem, er ikke offentlig ──────────────────────
-- Besøkende får bare kolonnene nettsiden viser. author_id er en brukers id,
-- og author_name kan være en ansatts e-postadresse.
revoke select on public.posts from anon;
grant select (id, slug, status, title_no, title_en, tag_no, tag_en,
              excerpt_no, excerpt_en, body_no, body_en, cover_image_url,
              published_at, created_at, updated_at)
  on public.posts to anon;

-- ── 3. Verifiserte selskap ─────────────────────────────────────────────────
-- Hvem som helst kan registrere et selskap med et organisasjonsnummer, og
-- nummeret kan bare brukes én gang. En administrator i NorthWestCoast
-- verifiserer selskapet når det er kontrollert. Selskap ansatte oppretter,
-- er verifisert med en gang.
--  - organisasjonsnummeret endres bare av ansatte
--  - navnet på et verifisert selskap endres bare av ansatte
--  - bare ansatte kan verifisere, og det står hvem som gjorde det
alter table public.companies
  add column verified_at timestamptz,
  add column verified_by uuid references auth.users(id) on delete set null;

comment on column public.companies.verified_at is
  'Når en administrator i NorthWestCoast kontrollerte navn og organisasjonsnummer. Null = ikke kontrollert.';

create or replace function app.companies_guard()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  -- Endringer som ikke kommer fra en innlogget bruker (opprydding, migrasjoner).
  if auth.uid() is null then
    return new;
  end if;

  if app.is_staff() then
    if tg_op = 'INSERT' then
      new.verified_at := coalesce(new.verified_at, now());
    end if;
    if tg_op = 'INSERT' or new.verified_at is distinct from old.verified_at then
      new.verified_by := case when new.verified_at is null then null else auth.uid() end;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified_at := null;
    new.verified_by := null;
    return new;
  end if;

  if new.verified_at is distinct from old.verified_at
     or new.verified_by is distinct from old.verified_by then
    raise exception 'Bare NorthWestCoast kan verifisere et selskap.' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Dette feltet kan ikke endres.' using errcode = '42501';
  end if;
  if new.org_number is distinct from old.org_number then
    raise exception 'Organisasjonsnummeret endres av NorthWestCoast. Ta kontakt med oss.'
      using errcode = 'P0001';
  end if;
  if old.verified_at is not null and new.name is distinct from old.name then
    raise exception 'Navnet på et verifisert selskap endres av NorthWestCoast. Ta kontakt med oss.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger companies_guard
  before insert or update on public.companies
  for each row execute function app.companies_guard();

-- ── 4. Bilder fra det åpne vedlikeholdsskjemaet ─────────────────────────────
-- Hver rapport fra skjemaet åpner en mappe for opplasting uten innlogging.
-- Nå har skjemaet i tillegg et tak på 200 MB per døgn til sammen. Er det
-- brukt opp, lagres rapporten som før, bare uten bilder. Høyst 10 bilder per
-- rapport, som skjemaet selv.
create or replace function app.can_upload_log_photo(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.maintenance_logs m
    where m.id = app.uuid_or_null(p_folder)
      and (
        app.is_staff()
        or (auth.uid() is not null and m.reported_by_user_id = auth.uid()
            and m.created_at > now() - interval '1 day')
        -- Det åpne skjemaet: mappen er åpen en halvtime, til rapporten er
        -- avsluttet, og så lenge døgnkvoten ikke er brukt opp. Størrelsen er
        -- kjent først når en fil er ferdig lastet opp; til da regnes den
        -- som full (10 MB, grensen på bøtta).
        or (m.source = 'web' and m.notified_at is null
            and m.created_at > now() - interval '30 minutes'
            and (select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 10485760)), 0)
                   from storage.objects o
                   join public.maintenance_logs w
                     on w.id = app.uuid_or_null(split_part(o.name, '/', 1))
                  where o.bucket_id = 'maintenance-photos'
                    and w.source = 'web'
                    and o.created_at > now() - interval '1 day') < 209715200)
      )
  )
  -- Et tak på antall filer per loggføring, så en åpen mappe ikke kan fylles.
  and (
    app.is_staff()
    or (select count(*) from storage.objects o
         where o.bucket_id = 'maintenance-photos'
           and o.name like p_folder || '/%') < 10
  );
$$;

-- Filer som aldri ble knyttet til en rapport (opplastingen stoppet halvveis,
-- eller rapporten er slettet). Administratorer ser lista under
-- Vedlikeholdsrapporter og kan slette filene derfra. Filer yngre enn et døgn
-- er ikke med: de kan ennå bli knyttet til rapporten sin.
create or replace function public.orphan_maintenance_photos()
returns table (path text, bytes bigint, uploaded_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not app.is_staff() then
    raise exception 'Bare administratorer kan rydde i bildene.' using errcode = '42501';
  end if;

  return query
    select o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at
      from storage.objects o
     where o.bucket_id = 'maintenance-photos'
       and o.created_at < now() - interval '1 day'
       and not exists (select 1 from public.maintenance_photos p where p.storage_path = o.name)
     order by o.created_at
     limit 1000;
end;
$$;

revoke all on function public.orphan_maintenance_photos() from public, anon;
grant execute on function public.orphan_maintenance_photos() to authenticated;

-- Administratorer kan slette nettopp disse filene, og ingen andre. Lagringen
-- leser raden før den sletter, så de må også kunne se dem.
create policy nwc_maintenance_photos_orphan_select on storage.objects
  for select to authenticated
  using (bucket_id = 'maintenance-photos'
         and app.is_staff()
         and not exists (select 1 from public.maintenance_photos p where p.storage_path = objects.name));

create policy nwc_maintenance_photos_orphan_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'maintenance-photos'
         and app.is_staff()
         and objects.created_at < now() - interval '1 day'
         and not exists (select 1 from public.maintenance_photos p where p.storage_path = objects.name));

-- ── 5. Bestillinger fra nettsiden: høyst 5 i timen per besøkende ────────────
-- Gjelder når skjemanøkkelen er satt opp (se app.form_throttle). Funksjonen
-- er ellers uendret fra security_hardening_forms.
create or replace function public.place_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_name     text := left(btrim(coalesce(payload ->> 'name', '')), 120);
  v_email    text := lower(left(btrim(coalesce(payload ->> 'email', '')), 160));
  v_phone    text := nullif(left(btrim(coalesce(payload ->> 'phone', '')), 40), '');
  v_vessel   text := nullif(left(btrim(coalesce(payload ->> 'vessel', '')), 160), '');
  v_imo      text := nullif(left(btrim(coalesce(payload ->> 'imo', '')), 20), '');
  v_notes    text := nullif(left(btrim(coalesce(payload ->> 'notes', '')), 4000), '');
  v_address  text := nullif(left(btrim(coalesce(payload ->> 'delivery_address', '')), 400), '');
  v_source   text := case when payload ->> 'source' in ('web', 'portal', 'calculator')
                          then payload ->> 'source' else 'web' end;
  v_company  uuid;
  v_order    record;
  v_item     jsonb;
  v_product  record;
  v_custom   numeric(4,1);
  v_request  boolean;
  v_pname    text;
  v_cab_id   uuid;
  v_cab_name text;
  v_cab_price integer;
  v_qty      integer;
  v_with     boolean;
  v_unit     integer;
  v_cab      integer;
  v_line     integer;
  v_total    integer := 0;
  v_units    integer := 0;
  v_lines    jsonb := '[]'::jsonb;
  v_rows     jsonb := '[]'::jsonb;
  r          jsonb;
begin
  if v_name = '' or v_email = '' then
    raise exception 'Navn og e-post er påkrevd.' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'E-postadressen ser ikke gyldig ut.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(payload -> 'items') is distinct from 'array'
     or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'Bestillingen er tom.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(payload -> 'items') > 30 then
    raise exception 'Bestillingen har for mange linjer.' using errcode = 'P0001';
  end if;

  -- Grenser for hvor mye som kan komme inn uten innlogging.
  if not app.throttle('order:email:' || v_email, 6, interval '1 hour')
     or (v_uid is null and not app.form_throttle('order', 5, 20, 60))
     -- Innloggede velger selv e-postadressen på bestillingen, så de trenger
     -- en egen grense som følger kontoen.
     or (v_uid is not null and not app.throttle('order:user:' || v_uid, 10, interval '1 hour')) then
    raise exception 'For mange bestillinger på kort tid. Prøv igjen senere eller ring oss.'
      using errcode = 'P0001';
  end if;

  if v_uid is not null and nullif(payload ->> 'company_id', '') is not null then
    select cm.company_id into v_company
    from public.company_members cm
    where cm.user_id = v_uid and cm.company_id = (payload ->> 'company_id')::uuid;
  end if;

  for v_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    v_qty := least(greatest(coalesce((v_item ->> 'qty')::integer, 1), 1), 99);
    v_with := coalesce((v_item ->> 'with_cabinet')::boolean, false);
    v_custom := null;

    if nullif(v_item ->> 'custom_length_m', '') is not null then
      -- Spesiallengde: lengden står på linja, produktet er det felles.
      begin
        v_custom := (v_item ->> 'custom_length_m')::numeric(4,1);
      exception when others then
        raise exception 'Lengden på leideren er ikke et gyldig tall.' using errcode = 'P0001';
      end;
      if v_custom < 1.5 or v_custom > 30 or v_custom * 2 <> trunc(v_custom * 2) then
        raise exception 'Spesiallengder bestilles i hele eller halve meter mellom 1,5 og 30 m.'
          using errcode = 'P0001';
      end if;

      select p.* into v_product
      from public.products p
      where p.product_number = 'ARG-SPES' and p.active;

      if v_product.id is null then
        raise exception 'Spesiallengder kan ikke bestilles her akkurat nå. Ta kontakt, så hjelper vi deg.'
          using errcode = 'P0001';
      end if;
    else
      select p.* into v_product
      from public.products p
      where p.id = (v_item ->> 'product_id')::uuid and p.active;

      if v_product.id is null then
        raise exception 'Et produkt i bestillingen finnes ikke lenger. Last siden på nytt.'
          using errcode = 'P0001';
      end if;
      if v_product.product_number = 'ARG-SPES' then
        raise exception 'Oppgi lengden på leideren du ønsker.' using errcode = 'P0001';
      end if;
    end if;

    v_request := v_product.price_on_request or v_custom is not null;
    v_pname := case
                 when v_custom is not null
                 then 'Argostep – ' || replace(v_custom::text, '.', ',') || ' m (spesiallengde)'
                 else v_product.name
               end;

    v_cab_id := null; v_cab_name := null; v_cab_price := 0;
    if v_with and v_custom is not null then
      -- Skapet som passer er det som hører til nærmeste standardlengde over.
      select c.id, c.name into v_cab_id, v_cab_name
      from public.products l
      join public.products c on c.id = l.cabinet_product_id and c.active
      where l.kind = 'ladder' and l.active and l.length_m >= v_custom
      order by l.length_m
      limit 1;
    elsif v_with and v_product.cabinet_product_id is not null and not v_product.price_on_request then
      select c.id, c.name, c.price_nok into v_cab_id, v_cab_name, v_cab_price
      from public.products c
      where c.id = v_product.cabinet_product_id and c.active;
    end if;
    v_with := v_cab_id is not null;

    v_unit := case when v_request then 0 else v_product.price_nok end;
    v_cab  := case when v_with and not v_request then coalesce(v_cab_price, 0) else 0 end;
    v_line := v_qty * (v_unit + v_cab);
    v_total := v_total + v_line;
    v_units := v_units + v_qty;

    v_rows := v_rows || jsonb_build_object(
      'product_id', v_product.id, 'qty', v_qty, 'with_cabinet', v_with,
      'unit', v_unit, 'cab', v_cab, 'line', v_line,
      'on_request', v_request,
      'custom_length_m', v_custom,
      'cabinet_product_id', v_cab_id);

    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id,
      'product_number', v_product.product_number,
      'name', v_pname,
      'kind', v_product.kind,
      'length_m', coalesce(v_custom, v_product.length_m),
      'custom_length_m', v_custom,
      'steps', v_product.steps,
      'qty', v_qty,
      'unit_price_nok', v_unit,
      'with_cabinet', v_with,
      'cabinet_name', case when v_with then v_cab_name end,
      'cabinet_price_nok', v_cab,
      'line_total_nok', v_line,
      'on_request', v_request);
  end loop;

  insert into public.orders
    (company_id, created_by, contact_name, contact_email, contact_phone,
     vessel_name, imo, notes, delivery_address, total_nok, source)
  values
    (v_company, v_uid, v_name, v_email, v_phone,
     v_vessel, v_imo, v_notes, v_address, v_total, v_source)
  returning * into v_order;

  for r in select * from jsonb_array_elements(v_rows)
  loop
    insert into public.order_lines
      (order_id, product_id, qty, with_cabinet, unit_price_nok,
       cabinet_price_nok, line_total_nok, on_request, custom_length_m, cabinet_product_id)
    values
      (v_order.id, (r ->> 'product_id')::uuid, (r ->> 'qty')::integer,
       (r ->> 'with_cabinet')::boolean, (r ->> 'unit')::integer,
       (r ->> 'cab')::integer, (r ->> 'line')::integer, (r ->> 'on_request')::boolean,
       (r ->> 'custom_length_m')::numeric(4,1), (r ->> 'cabinet_product_id')::uuid);
  end loop;

  perform app.notify_staff(
    'admin', 'order',
    'Ny bestilling ' || v_order.order_number,
    v_name || ' – ' || v_units || ' enhet(er), ' ||
      to_char(v_total, 'FM999G999G999') || ' kr eks. mva.',
    '/admin/bestillinger/' || v_order.id
  );

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'total_nok', v_total,
    'units', v_units,
    'lines', v_lines
  );
end;
$$;
