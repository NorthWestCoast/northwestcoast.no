-- ============================================================================
-- Portal v3: medierolle og galleri, prosjekter, oppbevaringsskap som egne
-- enheter, spesiallengder, servicebilder og servicesertifikat.
-- ============================================================================

-- ── 1. Medierollen ──────────────────────────────────────────────────────────
-- is_production() betydde «har en ansattrolle». Med en tredje rolle ville
-- media dermed fått se produksjonen, så rollene navngis nå eksplisitt.
create or replace function app.is_production()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    app.staff_role() in ('admin'::public.staff_role, 'production'::public.staff_role),
    false
  );
$$;

-- Administrator eller media: nyheter, galleri og bildene til dem.
create or replace function app.is_media()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    app.staff_role() in ('admin'::public.staff_role, 'media'::public.staff_role),
    false
  );
$$;

grant execute on function app.is_media() to anon, authenticated, service_role;

drop policy posts_read_published on public.posts;
create policy posts_read_published on public.posts
  for select to anon, authenticated
  using ((status = 'published' and published_at is not null and published_at <= now())
         or app.is_media());

drop policy posts_manage on public.posts;
create policy posts_manage on public.posts
  for all to authenticated
  using (app.is_media()) with check (app.is_media());

drop policy nwc_public_media_insert on storage.objects;
create policy nwc_public_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-media' and app.is_media());

drop policy nwc_public_media_update on storage.objects;
create policy nwc_public_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'public-media' and app.is_media())
  with check (bucket_id = 'public-media' and app.is_media());

drop policy nwc_public_media_delete on storage.objects;
create policy nwc_public_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-media' and app.is_media());

drop policy nwc_public_media_select on storage.objects;
create policy nwc_public_media_select on storage.objects
  for select to authenticated
  using (bucket_id = 'public-media' and app.is_media());

-- ── 2. Galleri ──────────────────────────────────────────────────────────────
-- Bildene som lastes opp i admin kommer i tillegg til de faste bildene som
-- ligger i koden. Kategoriene er de samme som fanene på gallerisiden.
create table public.gallery_images (
  id           uuid primary key default gen_random_uuid(),
  image_url    text not null check (image_url ~ '^(https://|/)'),
  storage_path text,
  tag          text not null default 'inUse'
               check (tag in ('ladder', 'storage', 'inUse', 'references')),
  alt_no       text not null check (length(btrim(alt_no)) between 2 and 300),
  alt_en       text,
  caption_no   text,
  caption_en   text,
  contain      boolean not null default false,
  sort_order   integer not null default 0,
  published    boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index gallery_images_order_idx on public.gallery_images (sort_order, created_at desc);

create trigger gallery_images_set_updated_at
  before update on public.gallery_images
  for each row execute function public.set_updated_at();

alter table public.gallery_images enable row level security;

create policy gallery_images_read on public.gallery_images
  for select to anon, authenticated
  using (published or app.is_media());

create policy gallery_images_manage on public.gallery_images
  for all to authenticated
  using (app.is_media()) with check (app.is_media());

grant select on public.gallery_images to anon, authenticated;
grant insert, update, delete on public.gallery_images to authenticated;

comment on column public.gallery_images.contain is
  'Bilde med gjennomsiktig bakgrunn: vises i sin helhet på sandfarget bunn.';

-- ── 3. Fartøy: opplysninger fra fartøyregisteret ────────────────────────────
alter table public.vessels
  add column registration_mark text,
  add column length_m          numeric(5,2) check (length_m is null or length_m > 0),
  add column beam_m            numeric(5,2) check (beam_m is null or beam_m > 0),
  add column build_year        integer check (build_year is null or build_year between 1800 and 2200),
  add column registry_id       text;

comment on column public.vessels.registry_id is
  'Id i Fiskeridirektoratets fartøyregister når fartøyet er hentet derfra.';

-- ── 4. Prosjekter ───────────────────────────────────────────────────────────
-- Ikke alt utstyr står på et fartøy. Noe står på en kai, noe på et anlegg på
-- land. Et prosjekt er stedet eller oppdraget utstyret hører til.
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 160),
  kind        text not null default 'other'
              check (kind in ('quay', 'onshore', 'aquaculture', 'other')),
  location    text,
  description text,
  status      text not null default 'active' check (status in ('active', 'closed')),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index projects_company_idx on public.projects (company_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create or replace function app.can_manage_project(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.projects p
    join public.company_members cm on cm.company_id = p.company_id
    where p.id = target and cm.user_id = auth.uid() and cm.role in ('owner', 'admin')
  );
$$;

grant execute on function app.can_manage_project(uuid) to authenticated, service_role;

create policy projects_select on public.projects
  for select to authenticated
  using (company_id in (select app.auth_company_ids()) or app.is_staff());

create policy projects_insert on public.projects
  for insert to authenticated
  with check (app.is_company_admin(company_id) or app.is_staff());

create policy projects_update on public.projects
  for update to authenticated
  using (app.is_company_admin(company_id) or app.is_staff())
  with check (app.is_company_admin(company_id) or app.is_staff());

-- Ingen sletting gjennom API-et: et prosjekt med utstyr og historikk
-- avsluttes (status = closed), det forsvinner ikke.
grant select, insert, update on public.projects to authenticated;

-- ── 5. Leidere: prosjekt og spesiallengde ───────────────────────────────────
alter table public.ladders
  add column project_id      uuid references public.projects(id) on delete set null,
  add column custom_length_m numeric(4,1)
    check (custom_length_m is null or custom_length_m between 1 and 30);

create index ladders_project_idx on public.ladders (project_id);

comment on column public.ladders.custom_length_m is
  'Lengde i meter når leideren er laget i en annen lengde enn produktet (spesiallengde).';

alter table public.ladders drop constraint ladders_installed_needs_vessel;
alter table public.ladders add constraint ladders_installed_needs_place
  check (status <> 'installed' or vessel_id is not null or project_id is not null);

-- Eierselskapet følger fartøyet, eller prosjektet når leideren ikke står på
-- et fartøy. Fartøy og prosjekt må høre til samme selskap.
create or replace function public.ladders_sync_company()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_vessel_company  uuid;
  v_project_company uuid;
begin
  if new.vessel_id is not null then
    select v.company_id into v_vessel_company from public.vessels v where v.id = new.vessel_id;
  end if;
  if new.project_id is not null then
    select p.company_id into v_project_company from public.projects p where p.id = new.project_id;
  end if;

  if v_vessel_company is not null and v_project_company is not null
     and v_vessel_company <> v_project_company then
    raise exception 'Fartøyet og prosjektet tilhører ulike selskap.' using errcode = 'P0001';
  end if;

  new.company_id := coalesce(v_vessel_company, v_project_company, new.company_id);
  return new;
end;
$$;

drop trigger ladders_sync_company on public.ladders;
create trigger ladders_sync_company
  before insert or update of vessel_id, project_id on public.ladders
  for each row execute function public.ladders_sync_company();

-- Monter en leider på et fartøy og/eller knytt den til et prosjekt. Uten
-- fartøy og prosjekt tas den av.
drop function public.install_ladder(uuid, uuid, date);

create or replace function public.install_ladder(
  p_ladder uuid,
  p_vessel uuid,
  p_installed_at date default current_date,
  p_project uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not (app.can_manage_ladder(p_ladder) or app.is_staff()) then
    raise exception 'Du kan ikke endre denne leideren.' using errcode = '42501';
  end if;

  if p_vessel is null and p_project is null then
    update public.ladders
       set vessel_id = null,
           project_id = null,
           status = case when status = 'installed' then 'delivered' else status end
     where id = p_ladder;
    return;
  end if;

  if p_vessel is not null and not (app.can_manage_vessel(p_vessel) or app.is_staff()) then
    raise exception 'Du kan ikke legge leidere til dette fartøyet.' using errcode = '42501';
  end if;
  if p_project is not null and not (app.can_manage_project(p_project) or app.is_staff()) then
    raise exception 'Du kan ikke legge leidere til dette prosjektet.' using errcode = '42501';
  end if;

  update public.ladders
     set vessel_id = p_vessel,
         project_id = p_project,
         installed_at = coalesce(p_installed_at, current_date),
         status = 'installed'
   where id = p_ladder;
end;
$$;

grant execute on function public.install_ladder(uuid, uuid, date, uuid) to authenticated;

-- ── 6. Bestilling: spesiallengder og skap alene ─────────────────────────────
-- Halvmetere og andre lengder utenom standard er ikke egne produkter. De
-- bestilles på forespørsel mot ett felles produkt, med lengden på linja.
insert into public.products
  (product_number, name, kind, length_m, steps, price_nok, price_on_request, sort_order, description)
values
  ('ARG-SPES', 'Argostep – spesiallengde', 'ladder', null, null, 0, true, 900,
   'Halvmeterlengder og andre lengder utenom standard. Pris på forespørsel.')
on conflict (product_number) do nothing;

alter table public.order_lines
  add column custom_length_m    numeric(4,1)
    check (custom_length_m is null
           or (custom_length_m between 1.5 and 30 and custom_length_m * 2 = trunc(custom_length_m * 2))),
  add column cabinet_product_id uuid references public.products(id) on delete set null;

comment on column public.order_lines.custom_length_m is
  'Ønsket lengde i meter når linja gjelder en spesiallengde (produktet ARG-SPES).';
comment on column public.order_lines.cabinet_product_id is
  'Skapet som følger leideren på linja, når with_cabinet er satt.';

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
     or (v_uid is null and not app.throttle('order:anon', 60, interval '1 hour')) then
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

-- ── 7. Produksjon: skap som egne jobber ─────────────────────────────────────
alter table public.production_jobs
  add column kind               public.product_kind not null default 'ladder',
  add column cabinet_product_id uuid references public.products(id) on delete set null;

alter table public.production_step_templates
  add column for_cabinet boolean not null default false;

comment on column public.production_step_templates.for_cabinet is
  'Steget gjelder også jobber som bare er et oppbevaringsskap.';

update public.production_step_templates
   set for_cabinet = true
 where title in ('Materialer plukket og kontrollert', 'Dokumentasjon lagt ved',
                 'Pakket', 'Klar for forsendelse');

create or replace function public.production_jobs_spawn_steps()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.production_job_steps (job_id, position, title, description)
  select new.id, row_number() over (order by t.position, t.created_at), t.title, t.description
  from public.production_step_templates t
  where t.active and (new.kind = 'ladder' or t.for_cabinet);

  -- En jobb uten steg ville aldri blitt «klar» og kunne ikke sendes.
  if not found then
    update public.production_jobs
       set status = 'ready', completed_at = now()
     where id = new.id;
  end if;
  return new;
end;
$$;

-- ── 8. Oppbevaringsskap som egne enheter ────────────────────────────────────
-- Et levert skap kan stå et annet sted enn leideren: på et fartøy, på en kai
-- eller på et anlegg. Skap som bestilles alene har ingen leider i det hele tatt.
create table public.cabinets (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id),
  serial_number text unique,
  company_id    uuid references public.companies(id) on delete set null,
  vessel_id     uuid references public.vessels(id) on delete set null,
  project_id    uuid references public.projects(id) on delete set null,
  ladder_id     uuid references public.ladders(id) on delete set null,
  job_id        uuid references public.production_jobs(id) on delete set null,
  status        text not null default 'delivered'
                check (status in ('in_production', 'delivered', 'installed', 'retired')),
  installed_at  date,
  location_note text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index cabinets_company_idx on public.cabinets (company_id);
create index cabinets_vessel_idx  on public.cabinets (vessel_id);
create index cabinets_project_idx on public.cabinets (project_id);
create index cabinets_ladder_idx  on public.cabinets (ladder_id);

comment on column public.cabinets.ladder_id is
  'Leideren skapet oppbevarer, når det ble levert sammen med en.';

create trigger cabinets_set_updated_at
  before update on public.cabinets
  for each row execute function public.set_updated_at();

create or replace function public.cabinets_sync_company()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_vessel_company  uuid;
  v_project_company uuid;
begin
  if new.vessel_id is not null then
    select v.company_id into v_vessel_company from public.vessels v where v.id = new.vessel_id;
  end if;
  if new.project_id is not null then
    select p.company_id into v_project_company from public.projects p where p.id = new.project_id;
  end if;

  if v_vessel_company is not null and v_project_company is not null
     and v_vessel_company <> v_project_company then
    raise exception 'Fartøyet og prosjektet tilhører ulike selskap.' using errcode = 'P0001';
  end if;

  new.company_id := coalesce(v_vessel_company, v_project_company, new.company_id);
  return new;
end;
$$;

create trigger cabinets_sync_company
  before insert or update of vessel_id, project_id on public.cabinets
  for each row execute function public.cabinets_sync_company();

alter table public.cabinets enable row level security;

create policy cabinets_select on public.cabinets
  for select to authenticated
  using (
    app.is_production()
    or company_id in (select app.auth_company_ids())
    or (vessel_id is not null and app.can_access_vessel(vessel_id))
  );

create policy cabinets_manage on public.cabinets
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

grant select, insert, update, delete on public.cabinets to authenticated;

-- Plasserer et skap på et fartøy og/eller i et prosjekt. Uten begge tas det ned.
create or replace function public.place_cabinet(
  p_cabinet uuid,
  p_vessel uuid,
  p_project uuid,
  p_installed_at date default current_date,
  p_location text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_cabinet record;
  v_location text := nullif(left(btrim(coalesce(p_location, '')), 200), '');
begin
  select c.* into v_cabinet from public.cabinets c where c.id = p_cabinet for update;
  if v_cabinet.id is null then
    raise exception 'Fant ikke skapet.' using errcode = 'P0001';
  end if;
  if not (app.is_staff()
          or (v_cabinet.company_id is not null and app.is_company_admin(v_cabinet.company_id))) then
    raise exception 'Du kan ikke endre dette skapet.' using errcode = '42501';
  end if;
  if p_vessel is not null and not (app.can_manage_vessel(p_vessel) or app.is_staff()) then
    raise exception 'Du kan ikke legge utstyr til dette fartøyet.' using errcode = '42501';
  end if;
  if p_project is not null and not (app.can_manage_project(p_project) or app.is_staff()) then
    raise exception 'Du kan ikke legge utstyr til dette prosjektet.' using errcode = '42501';
  end if;

  if p_vessel is null and p_project is null then
    update public.cabinets
       set vessel_id = null,
           project_id = null,
           installed_at = null,
           location_note = v_location,
           status = case when status = 'installed' then 'delivered' else status end
     where id = p_cabinet;
    return;
  end if;

  update public.cabinets
     set vessel_id = p_vessel,
         project_id = p_project,
         installed_at = coalesce(p_installed_at, current_date),
         location_note = coalesce(v_location, location_note),
         status = 'installed'
   where id = p_cabinet;
end;
$$;

grant execute on function public.place_cabinet(uuid, uuid, uuid, date, text) to authenticated;

-- Bekrefter en bestilling og legger én produksjonsjobb per leider og per skap
-- som er bestilt alene.
create or replace function public.confirm_order(p_order uuid, p_due_date date default null)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order   record;
  v_line    record;
  v_label   text;
  v_created integer := 0;
  i         integer;
begin
  if not app.is_staff() then
    raise exception 'Bare administratorer kan bekrefte bestillinger.' using errcode = '42501';
  end if;

  select o.* into v_order from public.orders o where o.id = p_order for update;
  if v_order.id is null then
    raise exception 'Fant ikke bestillingen.' using errcode = 'P0001';
  end if;
  if v_order.status not in ('new', 'quoted') then
    raise exception 'Bestillingen er allerede bekreftet.' using errcode = 'P0001';
  end if;

  select coalesce(c.name, v_order.contact_name) into v_label
  from (select 1) x
  left join public.companies c on c.id = v_order.company_id;

  for v_line in
    select ol.*, p.kind, p.name as p_name, p.product_number as p_number,
           p.length_m as p_length, p.steps as p_steps,
           coalesce(ol.cabinet_product_id, p.cabinet_product_id) as cab_id,
           cab.name as cab_name
    from public.order_lines ol
    join public.products p on p.id = ol.product_id
    left join public.products cab
           on cab.id = coalesce(ol.cabinet_product_id, p.cabinet_product_id)
    where ol.order_id = p_order and p.kind in ('ladder', 'cabinet')
  loop
    for i in 1 .. v_line.qty loop
      insert into public.production_jobs
        (order_id, order_line_id, product_id, kind, product_name, product_number,
         length_m, steps, with_cabinet, cabinet_name, cabinet_product_id, order_number,
         customer_label, vessel_name, due_date)
      values
        (p_order, v_line.id, v_line.product_id, v_line.kind,
         case
           when v_line.custom_length_m is not null
           then 'Argostep – ' || replace(v_line.custom_length_m::text, '.', ',') || ' m (spesiallengde)'
           else v_line.p_name
         end,
         v_line.p_number,
         coalesce(v_line.custom_length_m, v_line.p_length),
         case when v_line.custom_length_m is null then v_line.p_steps end,
         v_line.kind = 'ladder' and v_line.with_cabinet,
         case when v_line.kind = 'ladder' and v_line.with_cabinet then v_line.cab_name end,
         case when v_line.kind = 'ladder' and v_line.with_cabinet then v_line.cab_id end,
         v_order.order_number, v_label, v_order.vessel_name,
         coalesce(p_due_date, v_order.expected_delivery));
      v_created := v_created + 1;
    end loop;
  end loop;

  update public.orders
     set status = case when v_created > 0 then 'in_production' else 'confirmed' end::public.order_status,
         confirmed_at = now(),
         expected_delivery = coalesce(p_due_date, expected_delivery)
   where id = p_order;

  if v_created > 0 then
    perform app.notify_staff(
      'production', 'production_new',
      v_created || ' ny(e) produksjonsjobb(er) fra ' || v_order.order_number,
      v_label, '/produksjon'
    );
  end if;

  perform app.notify_user(
    v_order.created_by, 'order_confirmed',
    'Bestilling ' || v_order.order_number || ' er bekreftet',
    case when v_created > 0 then 'Bestillingen er lagt i produksjon.' end,
    '/minside/bestillinger'
  );
  if v_order.company_id is not null then
    perform app.notify_company_admins(
      v_order.company_id, 'order_confirmed',
      'Bestilling ' || v_order.order_number || ' er bekreftet',
      case when v_created > 0 then 'Bestillingen er lagt i produksjon.' end,
      '/minside/bestillinger'
    );
  end if;

  return v_created;
end;
$$;

-- Registrerer produksjonsnummeret på jobben. For en leider opprettes selve
-- leideren; et skap har ikke alltid eget nummer, og får det bare på jobben.
create or replace function public.assign_job_serial(p_job uuid, p_serial text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job     record;
  v_serial  text := upper(btrim(coalesce(p_serial, '')));
  v_ladder  uuid;
  v_company uuid;
  v_product_length numeric;
begin
  if not app.is_production() then
    raise exception 'Bare produksjon kan registrere produksjonsnummer.' using errcode = '42501';
  end if;
  if v_serial !~ '^[A-Z0-9][A-Z0-9._/-]{2,39}$' then
    raise exception 'Produksjonsnummeret må være 3–40 tegn (bokstaver, tall, bindestrek).'
      using errcode = 'P0001';
  end if;

  select j.* into v_job from public.production_jobs j where j.id = p_job for update;
  if v_job.id is null then
    raise exception 'Fant ikke jobben.' using errcode = 'P0001';
  end if;
  if v_job.status in ('delivered', 'cancelled') then
    raise exception 'Jobben er avsluttet.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.production_jobs j
             where j.serial_number = v_serial and j.id <> p_job) then
    raise exception 'Produksjonsnummeret er allerede brukt på en annen jobb.' using errcode = 'P0001';
  end if;

  if v_job.kind <> 'ladder' then
    if exists (select 1 from public.cabinets c where upper(c.serial_number) = v_serial) then
      raise exception 'Det finnes allerede et skap med dette nummeret.' using errcode = 'P0001';
    end if;
    update public.production_jobs set serial_number = v_serial where id = p_job;
    return null;
  end if;

  select o.company_id into v_company from public.orders o where o.id = v_job.order_id;

  if v_job.ladder_id is not null then
    update public.ladders set serial_number = v_serial where id = v_job.ladder_id;
    v_ladder := v_job.ladder_id;
  else
    if exists (select 1 from public.ladders l where upper(l.serial_number) = v_serial) then
      raise exception 'Det finnes allerede en leider med dette produksjonsnummeret.'
        using errcode = 'P0001';
    end if;

    select p.length_m into v_product_length from public.products p where p.id = v_job.product_id;

    insert into public.ladders (serial_number, product_id, status, company_id, custom_length_m)
    values (v_serial, v_job.product_id, 'in_production', v_company,
            case when v_job.length_m is distinct from v_product_length then v_job.length_m end)
    returning id into v_ladder;
  end if;

  update public.production_jobs
     set serial_number = v_serial, ladder_id = v_ladder
   where id = p_job;

  return v_ladder;
end;
$$;

-- Flytter jobben videre: sendt, levert eller kansellert. Ved levering
-- opprettes skapet som egen enhet, enten det ble bestilt alene eller fulgte
-- en leider.
create or replace function public.advance_job(
  p_job uuid,
  p_status text,
  p_carrier text default null,
  p_tracking text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job     record;
  v_order   record;
  v_open    integer;
  v_company uuid;
  v_what    text;
  v_cabinet_product uuid;
begin
  if not app.is_production() then
    raise exception 'Bare ansatte kan endre produksjonsjobber.' using errcode = '42501';
  end if;
  if p_status not in ('shipped', 'delivered', 'cancelled') then
    raise exception 'Ugyldig status.' using errcode = 'P0001';
  end if;
  if p_status = 'cancelled' and not app.is_staff() then
    raise exception 'Bare administratorer kan kansellere en jobb.' using errcode = '42501';
  end if;

  select j.* into v_job from public.production_jobs j where j.id = p_job for update;
  if v_job.id is null then
    raise exception 'Fant ikke jobben.' using errcode = 'P0001';
  end if;
  if v_job.status in ('delivered', 'cancelled') then
    raise exception 'Jobben er allerede avsluttet.' using errcode = 'P0001';
  end if;

  v_what := case when v_job.kind = 'cabinet' then 'Oppbevaringsskapet' else 'Leideren' end;

  if p_status = 'shipped' then
    if v_job.status <> 'ready' then
      raise exception 'Alle steg må være kvittert ut før jobben kan sendes.' using errcode = 'P0001';
    end if;
    if v_job.kind = 'ladder' and v_job.ladder_id is null then
      raise exception 'Registrer produksjonsnummeret før jobben sendes.' using errcode = 'P0001';
    end if;

    update public.production_jobs set status = 'shipped', shipped_at = now() where id = p_job;
    update public.ladders
       set produced_at = coalesce(produced_at, current_date)
     where id = v_job.ladder_id;

    if v_job.order_id is not null then
      insert into public.deliveries (order_id, job_id, shipped_at, carrier, tracking_reference)
      values (v_job.order_id, p_job, current_date,
              nullif(left(btrim(coalesce(p_carrier, '')), 120), ''),
              nullif(left(btrim(coalesce(p_tracking, '')), 120), ''));
    end if;

  elsif p_status = 'delivered' then
    if v_job.status not in ('ready', 'shipped') then
      raise exception 'Jobben må være ferdig produsert før den kan leveres.' using errcode = 'P0001';
    end if;
    if v_job.kind = 'ladder' and v_job.ladder_id is null then
      raise exception 'Registrer produksjonsnummeret før jobben leveres.' using errcode = 'P0001';
    end if;

    update public.production_jobs
       set status = 'delivered',
           shipped_at = coalesce(shipped_at, now()),
           delivered_at = now()
     where id = p_job;

    update public.ladders
       set status = case when status = 'in_production' then 'delivered' else status end,
           produced_at = coalesce(produced_at, current_date)
     where id = v_job.ladder_id;

    -- Skapet blir en egen enhet kunden kan plassere.
    select o.company_id into v_company from public.orders o where o.id = v_job.order_id;
    if not exists (select 1 from public.cabinets c where c.job_id = p_job) then
      if v_job.kind = 'cabinet' then
        insert into public.cabinets (product_id, serial_number, company_id, job_id, status)
        values (v_job.product_id, v_job.serial_number, v_company, p_job, 'delivered');
      elsif v_job.kind = 'ladder' and v_job.with_cabinet then
        -- Jobber fra før skapet ble kopiert til jobben: bruk produktets skap.
        select coalesce(v_job.cabinet_product_id, p.cabinet_product_id) into v_cabinet_product
        from public.products p where p.id = v_job.product_id;

        if v_cabinet_product is not null then
          insert into public.cabinets (product_id, company_id, ladder_id, job_id, status)
          values (v_cabinet_product, v_company, v_job.ladder_id, p_job, 'delivered');
        end if;
      end if;
    end if;

    if v_job.order_id is not null then
      update public.deliveries set delivered_at = current_date
       where job_id = p_job and delivered_at is null;
      if not found then
        insert into public.deliveries (order_id, job_id, shipped_at, delivered_at, carrier, tracking_reference)
        values (v_job.order_id, p_job, current_date, current_date,
                nullif(left(btrim(coalesce(p_carrier, '')), 120), ''),
                nullif(left(btrim(coalesce(p_tracking, '')), 120), ''));
      end if;
    end if;

  else
    update public.production_jobs set status = 'cancelled' where id = p_job;
  end if;

  -- Bestillingen er levert når ingen av jobbene står igjen.
  if v_job.order_id is not null then
    select o.* into v_order from public.orders o where o.id = v_job.order_id;

    select count(*) into v_open
    from public.production_jobs j
    where j.order_id = v_job.order_id and j.status not in ('delivered', 'cancelled');

    if v_open = 0 and p_status = 'delivered' then
      update public.orders set status = 'delivered' where id = v_job.order_id;
    end if;

    if p_status in ('shipped', 'delivered') then
      perform app.notify_user(
        v_order.created_by,
        case p_status when 'shipped' then 'order_shipped' else 'order_delivered' end,
        case p_status
          when 'shipped' then v_what || ' fra bestilling ' || v_order.order_number || ' er sendt'
          else v_what || ' fra bestilling ' || v_order.order_number || ' er levert'
        end,
        case when p_status = 'delivered'
             then 'Knytt utstyret til et fartøy eller et prosjekt på Min side.' end,
        '/minside/bestillinger'
      );
      if v_order.company_id is not null then
        perform app.notify_company_admins(
          v_order.company_id,
          case p_status when 'shipped' then 'order_shipped' else 'order_delivered' end,
          case p_status
            when 'shipped' then v_what || ' fra bestilling ' || v_order.order_number || ' er sendt'
            else v_what || ' fra bestilling ' || v_order.order_number || ' er levert'
          end,
          case when p_status = 'delivered'
               then 'Knytt utstyret til et fartøy eller et prosjekt på Min side.' end,
          '/minside/bestillinger'
        );
      end if;
    end if;
  end if;
end;
$$;

-- ── 9. Service: bilder ──────────────────────────────────────────────────────
-- Bildene ligger i bøtta service-reports, i mappen <leider-id>/<rapport-id>/.
-- Bøtta tok bare imot PDF; nå også bilder.
update storage.buckets
   set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
 where id = 'service-reports';

create table public.service_report_photos (
  id                uuid primary key default gen_random_uuid(),
  service_report_id uuid not null references public.service_reports(id) on delete cascade,
  storage_path      text not null,
  caption           text,
  uploaded_at       timestamptz not null default now()
);

create index service_report_photos_report_idx
  on public.service_report_photos (service_report_id);

alter table public.service_report_photos enable row level security;

create policy service_report_photos_select on public.service_report_photos
  for select to authenticated
  using (
    app.is_staff()
    or exists (
      select 1 from public.service_reports s
      where s.id = service_report_id and app.can_access_ladder(s.ladder_id)
    )
  );

create policy service_report_photos_manage on public.service_report_photos
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

grant select, insert, update, delete on public.service_report_photos to authenticated;

create policy nwc_service_reports_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'service-reports' and app.is_staff());

-- ── 10. Servicesertifikat ───────────────────────────────────────────────────
-- Utstedes etter godkjent service. Opplysningene om leideren kopieres inn,
-- så sertifikatet står fast selv om leideren senere flyttes eller bytter eier.
create sequence public.certificate_number_seq;

create table public.ladder_certificates (
  id                 uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  ladder_id          uuid not null references public.ladders(id) on delete cascade,
  service_report_id  uuid references public.service_reports(id) on delete set null,
  issued_on          date not null default current_date,
  valid_until        date not null,
  issued_by          uuid references auth.users(id) on delete set null,
  issued_by_name     text not null,
  result             public.service_result,
  remarks            text,
  serial_number      text not null,
  product_name       text not null,
  length_m           numeric(4,1),
  company_name       text,
  vessel_name        text,
  project_name       text,
  -- Lenken på sertifikatet. Den som har den kan kontrollere at det er ekte.
  verify_token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  replaced_by        uuid references public.ladder_certificates(id) on delete set null,
  revoked_at         timestamptz,
  revoked_reason     text,
  created_at         timestamptz not null default now(),
  constraint ladder_certificates_valid_after_issue check (valid_until > issued_on)
);

create index ladder_certificates_ladder_idx
  on public.ladder_certificates (ladder_id, issued_on desc);

alter table public.ladder_certificates enable row level security;

create policy ladder_certificates_select on public.ladder_certificates
  for select to authenticated
  using (app.can_access_ladder(ladder_id) or app.is_staff());

-- Utstedes bare gjennom issue_ladder_certificate(). Administratorer kan
-- trekke et sertifikat tilbake ved å sette revoked_at.
create policy ladder_certificates_revoke on public.ladder_certificates
  for update to authenticated
  using (app.is_staff()) with check (app.is_staff());

grant select, update on public.ladder_certificates to authenticated;

create or replace function public.issue_ladder_certificate(
  p_ladder uuid,
  p_service_report uuid default null,
  p_valid_until date default null,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ladder  record;
  v_report_id     uuid;
  v_report_result public.service_result;
  v_report_due    date;
  v_name    text;
  v_until   date;
  v_number  text;
  v_id      uuid;
begin
  if not app.is_staff() then
    raise exception 'Bare administratorer kan utstede sertifikat.' using errcode = '42501';
  end if;

  select l.id, l.serial_number, l.service_interval_months,
         p.name as product_name, coalesce(l.custom_length_m, p.length_m) as length_m,
         c.name as company_name, v.name as vessel_name, pr.name as project_name
    into v_ladder
  from public.ladders l
  join public.products p on p.id = l.product_id
  left join public.companies c on c.id = l.company_id
  left join public.vessels v on v.id = l.vessel_id
  left join public.projects pr on pr.id = l.project_id
  where l.id = p_ladder;

  if v_ladder.id is null then
    raise exception 'Fant ikke leideren.' using errcode = 'P0001';
  end if;

  if p_service_report is not null then
    select s.id, s.result, s.next_service_due
      into v_report_id, v_report_result, v_report_due
    from public.service_reports s
    where s.id = p_service_report and s.ladder_id = p_ladder;

    if v_report_id is null then
      raise exception 'Servicerapporten hører ikke til denne leideren.' using errcode = 'P0001';
    end if;
    if v_report_result = 'failed' then
      raise exception 'Leideren ble ikke godkjent ved servicen, så sertifikat kan ikke utstedes.'
        using errcode = 'P0001';
    end if;
  end if;

  v_until := coalesce(
    p_valid_until,
    v_report_due,
    (current_date + make_interval(months => v_ladder.service_interval_months))::date
  );
  if v_until <= current_date then
    raise exception 'Sertifikatet må være gyldig fram i tid.' using errcode = 'P0001';
  end if;

  select coalesce(nullif(btrim(pf.full_name), ''), pf.email::text) into v_name
  from public.profiles pf where pf.user_id = auth.uid();

  v_number := 'SS-' || to_char(now(), 'YYYY') || '-'
              || lpad(nextval('public.certificate_number_seq')::text, 4, '0');

  insert into public.ladder_certificates
    (certificate_number, ladder_id, service_report_id, valid_until, issued_by, issued_by_name,
     result, remarks, serial_number, product_name, length_m, company_name, vessel_name, project_name)
  values
    (v_number, p_ladder, p_service_report, v_until, auth.uid(), coalesce(v_name, 'NorthWest Coast'),
     v_report_result, nullif(left(btrim(coalesce(p_remarks, '')), 2000), ''),
     v_ladder.serial_number, v_ladder.product_name, v_ladder.length_m,
     v_ladder.company_name, v_ladder.vessel_name, v_ladder.project_name)
  returning id into v_id;

  -- Det nye sertifikatet erstatter de som gjaldt fra før.
  update public.ladder_certificates
     set replaced_by = v_id
   where ladder_id = p_ladder and id <> v_id
     and replaced_by is null and revoked_at is null;

  perform app.notify_ladder_users(
    p_ladder, 'certificate_issued',
    'Servicesertifikat ' || v_number || ' er utstedt for leider ' || v_ladder.serial_number,
    'Gyldig til ' || to_char(v_until, 'DD.MM.YYYY') || '.',
    '/minside/leider/' || p_ladder || '?fane=historikk'
  );

  return v_id;
end;
$$;

grant execute on function public.issue_ladder_certificate(uuid, uuid, date, text) to authenticated;

-- Kontroll av et sertifikat for den som har lenken (uten innlogging).
create or replace function public.get_certificate(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v record;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    return jsonb_build_object('found', false);
  end if;

  select c.* into v from public.ladder_certificates c where c.verify_token = p_token;
  if v.id is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'certificate_number', v.certificate_number,
    'status', case
                when v.revoked_at is not null then 'revoked'
                when v.replaced_by is not null then 'replaced'
                when v.valid_until < current_date then 'expired'
                else 'valid'
              end,
    'issued_on', v.issued_on,
    'valid_until', v.valid_until,
    'issued_by_name', v.issued_by_name,
    'result', v.result,
    'serial_number', v.serial_number,
    'product_name', v.product_name,
    'length_m', v.length_m,
    'company_name', v.company_name,
    'vessel_name', v.vessel_name,
    'project_name', v.project_name
  );
end;
$$;

grant execute on function public.get_certificate(text) to anon, authenticated;

-- ── 11. Statusviewet: prosjekt, spesiallengde og gjeldende sertifikat ───────
drop view public.ladder_status;

create view public.ladder_status
with (security_invoker = true)
as
select
  base.*,
  (base.next_service_due - current_date) as days_until_service,
  case
    when base.next_service_due is null              then 'unknown'
    when base.next_service_due < current_date       then 'overdue'
    when base.next_service_due <= current_date + 30 then 'due_soon'
    else 'ok'
  end as service_state
from (
  select
    l.id             as ladder_id,
    l.serial_number,
    l.public_code,
    l.status,
    l.produced_at,
    l.installed_at,
    l.vessel_id,
    l.company_id,
    v.name           as vessel_name,
    v.imo,
    p.product_number,
    p.name           as product_name,
    coalesce(l.custom_length_m, p.length_m)::numeric(4,1) as length_m,
    p.steps,
    sr.performed_at  as last_service_at,
    sr.result        as last_service_result,
    coalesce(
      sr.next_service_due,
      (l.installed_at + make_interval(months => l.service_interval_months))::date
    )                as next_service_due,
    ml.performed_at  as last_maintenance_at,
    l.service_interval_months,
    c.name           as company_name,
    tk.next_task_due,
    tk.open_tasks,
    bk.scheduled_date as booked_service_date,
    l.project_id,
    pr.name          as project_name,
    ct.certificate_number,
    ct.valid_until   as certificate_valid_until
  from public.ladders l
  join public.products p on p.id = l.product_id
  left join public.vessels v on v.id = l.vessel_id
  left join public.companies c on c.id = l.company_id
  left join public.projects pr on pr.id = l.project_id
  left join lateral (
    select s.performed_at, s.result, s.next_service_due
    from public.service_reports s
    where s.ladder_id = l.id
    order by s.performed_at desc
    limit 1
  ) sr on true
  left join lateral (
    select m.performed_at
    from public.maintenance_logs m
    where m.ladder_id = l.id
    order by m.performed_at desc
    limit 1
  ) ml on true
  left join lateral (
    select min(t.due_date) as next_task_due, count(*)::integer as open_tasks
    from public.ladder_tasks t
    where t.ladder_id = l.id and t.status = 'open'
  ) tk on true
  left join lateral (
    select b.scheduled_date
    from public.service_bookings b
    where b.ladder_id = l.id and b.status = 'scheduled'
    order by b.scheduled_date
    limit 1
  ) bk on true
  left join lateral (
    select lc.certificate_number, lc.valid_until
    from public.ladder_certificates lc
    where lc.ladder_id = l.id and lc.revoked_at is null and lc.replaced_by is null
    order by lc.issued_on desc, lc.created_at desc
    limit 1
  ) ct on true
) base;

comment on view public.ladder_status is
  'Beregnet status per leider. Kilden til neste service for dashboard, PDF og paminnelser.';

grant select on public.ladder_status to authenticated;
