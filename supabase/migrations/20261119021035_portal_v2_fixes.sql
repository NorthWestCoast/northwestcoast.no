-- Tre mangler funnet da portalen ble tatt i bruk.

-- 1) Den som ber om tilgang ser ikke leideren før svaret kommer, og kunne
--    derfor ikke se hvilket nummer forespørselen gjaldt. Nummeret hun selv
--    skrev inn lagres nå på forespørselen.
alter table public.ladder_access_requests
  add column serial_number text;

create or replace function public.request_ladder_access(p_serial text, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_serial  text := upper(btrim(coalesce(p_serial, '')));
  v_ladder  record;
  v_name    text;
  v_email   text;
  v_request uuid;
  v_count   integer;
begin
  if v_uid is null then
    raise exception 'Du må være logget inn.' using errcode = 'P0001';
  end if;
  if length(v_serial) < 3 then
    raise exception 'Skriv inn produksjonsnummeret som står på leideren.' using errcode = 'P0001';
  end if;
  -- Hindrer at noen prøver seg gjennom nummerserien.
  if not app.throttle('ladder_lookup:' || v_uid, 15, interval '1 hour') then
    raise exception 'For mange forsøk. Prøv igjen om en time.' using errcode = 'P0001';
  end if;

  select l.id, l.serial_number into v_ladder
  from public.ladders l
  where upper(l.serial_number) = v_serial;

  if v_ladder.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if app.can_access_ladder(v_ladder.id) then
    return jsonb_build_object('status', 'already', 'ladder_id', v_ladder.id);
  end if;

  if exists (select 1 from public.ladder_access_requests r
             where r.ladder_id = v_ladder.id and r.requester_id = v_uid and r.status = 'pending') then
    return jsonb_build_object('status', 'pending');
  end if;

  select p.full_name, p.email::text into v_name, v_email
  from public.profiles p where p.user_id = v_uid;
  if v_email is null then
    select u.email into v_email from auth.users u where u.id = v_uid;
  end if;

  insert into public.ladder_access_requests
    (ladder_id, requester_id, requester_name, requester_email, message, serial_number)
  values
    (v_ladder.id, v_uid, v_name, v_email,
     nullif(left(btrim(coalesce(p_message, '')), 1000), ''), v_ladder.serial_number)
  returning id into v_request;

  v_count := app.notify_ladder_managers(
    v_ladder.id, 'access_request',
    coalesce(v_name, v_email) || ' ber om tilgang til leider ' || v_ladder.serial_number,
    nullif(left(btrim(coalesce(p_message, '')), 300), ''),
    '/minside/tilgang'
  );

  -- Ingen eier ennå (eller ingen som kan svare): NorthWest Coast tar den.
  if v_count = 0 then
    perform app.notify_staff(
      'admin', 'access_request',
      coalesce(v_name, v_email) || ' ber om tilgang til leider ' || v_ladder.serial_number,
      'Leideren har ingen eier som kan svare. Forespørselen må behandles av NorthWest Coast.',
      '/admin/tilgang'
    );
  end if;

  return jsonb_build_object('status', 'requested', 'request_id', v_request,
                            'handled_by', case when v_count = 0 then 'nwc' else 'owner' end);
end;
$$;

-- 2) Bilder i en tilbaketrukket deling kunne ikke slettes fra lagringen,
--    fordi sletting brukte samme regel som opplasting (krever aktiv deling).
create or replace function app.can_delete_share_photo(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.ladder_state_shares s
    where s.id = app.uuid_or_null(p_folder)
      and (app.can_access_ladder(s.ladder_id) or app.is_staff())
  );
$$;

grant execute on function app.can_delete_share_photo(text) to authenticated, service_role;

drop policy nwc_share_photos_delete on storage.objects;
create policy nwc_share_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ladder-state-photos'
         and app.can_delete_share_photo((storage.foldername(name))[1]));

-- 3) Man kan alltid fjerne sin egen tilgang til et fartøy.
create policy vessel_members_leave on public.vessel_members
  for delete to authenticated
  using (user_id = auth.uid());
