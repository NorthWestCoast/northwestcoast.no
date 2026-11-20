-- Sikkerhetsgjennomgang 19.11.2026: rettelser i tilgangsreglene, del 2 av 3.
--
-- Nettlaget har ingen servicenøkkel, så RLS og funksjonene her er den eneste
-- virkelige grensen. Alt under er ting en innlogget bruker (eller en anonym
-- med den offentlige nøkkelen) kunne gjøre rett mot API-et, uavhengig av hva
-- sidene i portalen tilbyr.

-- ── 11. De åpne skjemaene: grenser som ikke kan brukes til å stenge dem ─────
-- Før hadde hvert skjema én felles grense for alle (60 i timen). Den som
-- sendte 60 kall, stengte skjemaet for alle andre. Nå:
--  - kall som kommer gjennom nettstedet teller per besøkende. Nettstedet
--    viser at kallet er dets eget med en nøkkel i hodet x-nwc-gate, og
--    oppgir besøkerens adresse i x-nwc-client
--  - kall rett mot API-et, utenom nettstedet, har sin egen lille kvote, som
--    ikke berører dem som bruker skjemaene
-- Nøkkelen ligger bare som sjekksum her (app.gates) og som FORM_GATE_SECRET
-- i nettlaget. Før den er satt opp, gjelder den gamle felles grensen.
create table app.gates (
  name        text primary key,
  secret_hash text not null,
  created_at  timestamptz not null default now()
);
revoke all on app.gates from public, anon, authenticated;

create or replace function app.request_header(p_name text)
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select nullif(current_setting('request.headers', true), '')::json ->> p_name;
$$;

create or replace function app.gate_configured()
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (select 1 from app.gates g where g.name = 'forms');
$$;

create or replace function app.via_site()
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from app.gates g
    where g.name = 'forms'
      and g.secret_hash = encode(sha256(convert_to(coalesce(app.request_header('x-nwc-gate'), ''), 'UTF8')), 'hex')
  );
$$;

create or replace function app.form_throttle(p_form text, p_per_client integer, p_direct integer, p_legacy integer)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not app.gate_configured() then
    return app.throttle(p_form || ':all', p_legacy, interval '1 hour');
  end if;

  if app.via_site() then
    return app.throttle(
             p_form || ':ip:' || left(coalesce(nullif(btrim(app.request_header('x-nwc-client')), ''), 'ukjent'), 64),
             p_per_client, interval '1 hour')
       -- Nødbrems for hele skjemaet, langt over vanlig bruk.
       and app.throttle(p_form || ':site', 600, interval '1 hour');
  end if;

  return app.throttle(p_form || ':direct', p_direct, interval '1 hour');
end;
$$;

revoke all on function app.request_header(text), app.gate_configured(), app.via_site(),
  app.form_throttle(text, integer, integer, integer) from public, anon, authenticated;

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
     or (v_uid is null and not app.form_throttle('order', 8, 20, 60))
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

create or replace function public.submit_contact_request(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name  text := left(btrim(coalesce(payload ->> 'name', '')), 120);
  v_email text := lower(left(btrim(coalesce(payload ->> 'email', '')), 160));
  v_id    uuid;
begin
  if v_name = '' or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'Navn og gyldig e-post er påkrevd.' using errcode = 'P0001';
  end if;
  if not app.throttle('contact:email:' || v_email, 5, interval '1 hour')
     or not app.form_throttle('contact', 6, 20, 60) then
    raise exception 'For mange henvendelser på kort tid. Prøv igjen senere.' using errcode = 'P0001';
  end if;

  insert into public.contact_requests (name, email, phone, company_name, product, message, source)
  values (
    v_name, v_email,
    nullif(left(btrim(coalesce(payload ->> 'phone', '')), 40), ''),
    nullif(left(btrim(coalesce(payload ->> 'company', '')), 160), ''),
    nullif(left(btrim(coalesce(payload ->> 'product', '')), 120), ''),
    nullif(left(btrim(coalesce(payload ->> 'message', '')), 4000), ''),
    'web')
  returning id into v_id;

  perform app.notify_staff(
    'admin', 'contact', 'Ny henvendelse fra ' || v_name,
    nullif(left(btrim(coalesce(payload ->> 'message', '')), 200), ''),
    '/admin/henvendelser'
  );

  return v_id;
end;
$$;

create or replace function public.reply_ticket(p_ticket uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_staff  boolean := app.is_staff();
  v_ticket record;
  v_name   text;
begin
  select t.* into v_ticket from public.support_tickets t where t.id = p_ticket for update;

  if v_ticket.id is null or not (v_staff or app.can_see_ticket(p_ticket)) then
    raise exception 'Fant ikke saken.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_body, ''))) < 1 then
    raise exception 'Meldingen er tom.' using errcode = 'P0001';
  end if;
  -- Hvert svar varsler administratorene.
  if not v_staff and not app.throttle('ticket_reply:' || v_uid, 60, interval '1 hour') then
    raise exception 'For mange meldinger på kort tid. Prøv igjen senere.' using errcode = 'P0001';
  end if;

  select coalesce(p.full_name, p.email::text) into v_name
  from public.profiles p where p.user_id = v_uid;

  insert into public.ticket_messages (ticket_id, author_id, author_name, from_staff, body)
  values (p_ticket, v_uid,
          case when v_staff then coalesce(v_name, 'NorthWest Coast') else v_name end,
          v_staff, left(btrim(p_body), 5000));

  update public.support_tickets
     set status = case
                    when v_staff then 'waiting_customer'
                    when status in ('waiting_customer', 'resolved', 'closed') then 'open'
                    else status
                  end,
         closed_at = null,
         last_message_at = now()
   where id = p_ticket;

  if v_staff then
    perform app.notify_user(
      v_ticket.created_by, 'ticket_reply',
      'Svar på sak ' || v_ticket.ticket_number,
      v_ticket.subject,
      '/minside/support/' || p_ticket
    );
  else
    perform app.notify_staff(
      'admin', 'ticket_reply',
      'Nytt svar i sak ' || v_ticket.ticket_number,
      v_ticket.subject,
      '/admin/saker/' || p_ticket
    );
  end if;
end;
$$;

create or replace function public.request_service(
  p_ladder uuid,
  p_preferred_date date default null,
  p_location text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text;
  v_serial text;
  v_id     uuid;
begin
  if v_uid is null or not app.can_access_ladder(p_ladder) then
    raise exception 'Du har ikke tilgang til denne leideren.' using errcode = '42501';
  end if;
  if not app.throttle('service:' || v_uid, 20, interval '1 hour') then
    raise exception 'For mange bestillinger på kort tid. Prøv igjen senere.' using errcode = 'P0001';
  end if;
  if p_preferred_date is not null and p_preferred_date < current_date then
    raise exception 'Ønsket dato kan ikke ligge bak i tid.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.service_bookings b
             where b.ladder_id = p_ladder and b.status = 'requested') then
    raise exception 'Det ligger allerede en ubehandlet servicebestilling på denne leideren.'
      using errcode = 'P0001';
  end if;

  select coalesce(p.full_name, p.email::text) into v_name
  from public.profiles p where p.user_id = v_uid;
  select l.serial_number into v_serial from public.ladders l where l.id = p_ladder;

  insert into public.service_bookings
    (ladder_id, requested_by, requester_name, preferred_date, location, notes)
  values
    (p_ladder, v_uid, v_name, p_preferred_date,
     nullif(left(btrim(coalesce(p_location, '')), 200), ''),
     nullif(left(btrim(coalesce(p_notes, '')), 2000), ''))
  returning id into v_id;

  perform app.notify_staff(
    'admin', 'service_request',
    'Service bestilt på leider ' || v_serial,
    coalesce(v_name, 'En kunde') ||
      case when p_preferred_date is not null
           then ' ønsker ' || to_char(p_preferred_date, 'DD.MM.YYYY') else '' end,
    '/admin/service'
  );

  return v_id;
end;
$$;
