-- Lager: varer og deler, stykkliste per produkt, innkjøp og bevegelser.
--
-- Tankegangen:
--  - En lagervare (stock_items) er alt det telles opp av: deler, og ferdige
--    produkter som står klare til salg. En vare kan være knyttet til produktet
--    den selges som (reservedel, ferdig leider, skap).
--  - Beholdningen endres bare av bevegelser (stock_movements). De slettes og
--    endres aldri; en feil rettes med en ny bevegelse. Slik kan det alltid
--    vises hva som har gått til produksjon og hva som er solgt direkte.
--  - Stykklista (product_components) sier hvilke deler et produkt består av.
--    Når en produksjonsjobb er ferdig montert, trekkes delene av seg selv.

-- ── 1. Hvordan et produkt skaffes ───────────────────────────────────────────
-- «assembled»: settes sammen hos NorthWest Coast av deler (stykkliste).
-- «resale»: kjøpes ferdig og selges videre som det er.
alter table public.products
  add column sourcing text not null default 'assembled'
    check (sourcing in ('assembled', 'resale'));

update public.products set sourcing = 'resale' where kind <> 'ladder';

comment on column public.products.sourcing is
  'assembled = settes sammen hos NWC (delene trekkes fra lager når jobben er ferdig). resale = kjøpes ferdig og selges videre.';

-- ── 2. Leverandører ─────────────────────────────────────────────────────────
create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 2 and 160),
  contact_name text,
  email        text,
  phone        text,
  notes        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── 3. Lagervarer ───────────────────────────────────────────────────────────
create table public.stock_items (
  id            uuid primary key default gen_random_uuid(),
  item_number   text not null unique
                check (item_number ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$'),
  name          text not null check (length(btrim(name)) between 2 and 160),
  -- part = del som inngår i et produkt. finished = ferdig vare klar til salg.
  category      text not null default 'part' check (category in ('part', 'finished')),
  -- purchased = kjøpes ferdig. external = produseres hos ekstern part på
  -- bestilling. assembled = settes sammen hos oss.
  supply        text not null default 'purchased'
                check (supply in ('purchased', 'external', 'assembled')),
  unit          text not null default 'stk'
                check (unit in ('stk', 'm', 'kg', 'l', 'sett', 'par')),
  -- Produktet varen selges som. Høyst én vare per produkt.
  product_id    uuid unique references public.products(id) on delete set null,
  supplier_id   uuid references public.suppliers(id) on delete set null,
  reorder_point numeric(12,3) not null default 0 check (reorder_point >= 0),
  -- Vedlikeholdes av bevegelsene (stock_movements_apply). Kan ikke settes direkte.
  on_hand       numeric(12,3) not null default 0,
  location      text,
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger stock_items_set_updated_at
  before update on public.stock_items
  for each row execute function public.set_updated_at();

comment on column public.stock_items.on_hand is
  'Beholdning nå. Summen av alle bevegelser på varen; endres bare gjennom stock_movements.';

-- ── 4. Stykkliste ───────────────────────────────────────────────────────────
-- Mengden per enhet er qty + qty_per_metre × lengden på leideren. Standard-
-- lengder bruker bare qty. Spesiallengder, der produktet er felles for alle
-- lengder, bruker qty_per_metre for det som følger lengden (tau, trinn).
create table public.product_components (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  item_id       uuid not null references public.stock_items(id) on delete restrict,
  qty           numeric(12,3) not null default 0 check (qty >= 0),
  qty_per_metre numeric(12,3) not null default 0 check (qty_per_metre >= 0),
  note          text,
  created_at    timestamptz not null default now(),
  unique (product_id, item_id),
  check (qty > 0 or qty_per_metre > 0)
);

create index product_components_item_idx on public.product_components (item_id);

-- ── 5. Innkjøp og bestilling hos ekstern produsent ──────────────────────────
create sequence public.purchase_number_seq;

create table public.purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  po_number   text not null unique
              default ('I-' || lpad(nextval('public.purchase_number_seq')::text, 5, '0')),
  supplier_id uuid references public.suppliers(id) on delete set null,
  -- purchase = vanlig innkjøp. external_production = deler satt i produksjon
  -- hos ekstern part.
  kind        text not null default 'purchase'
              check (kind in ('purchase', 'external_production')),
  status      text not null default 'ordered'
              check (status in ('ordered', 'received', 'cancelled')),
  ordered_on  date not null default current_date,
  expected_on date,
  reference   text,
  notes       text,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger purchase_orders_set_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();

create table public.purchase_order_lines (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  item_id           uuid not null references public.stock_items(id) on delete restrict,
  qty_ordered       numeric(12,3) not null check (qty_ordered > 0),
  qty_received      numeric(12,3) not null default 0 check (qty_received >= 0),
  note              text,
  unique (purchase_order_id, item_id)
);

create index purchase_order_lines_item_idx on public.purchase_order_lines (item_id);

-- ── 6. Bevegelser ───────────────────────────────────────────────────────────
-- Fortegnet følger slaget: inn er pluss, ut er minus.
--   receipt         varemottak fra leverandør                       +
--   production_in   ferdig montert enhet inn på lager               +
--   return          retur fra kunde                                 +
--   production_out  del brukt i produksjon                          −
--   sale            solgt direkte (reservedel, ferdig leider, skap) −
--   scrap           svinn og kassering                              −
--   adjustment      varetelling og retting                          ±
create table public.stock_movements (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid not null references public.stock_items(id) on delete restrict,
  quantity         numeric(12,3) not null,
  kind             text not null
                   check (kind in ('receipt', 'production_in', 'return',
                                   'production_out', 'sale', 'scrap', 'adjustment')),
  job_id           uuid references public.production_jobs(id) on delete set null,
  order_id         uuid references public.orders(id) on delete set null,
  purchase_line_id uuid references public.purchase_order_lines(id) on delete set null,
  note             text,
  occurred_on      date not null default current_date,
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_by_name  text,
  created_at       timestamptz not null default now(),
  check (
    (kind in ('receipt', 'production_in', 'return') and quantity > 0)
    or (kind in ('production_out', 'sale', 'scrap') and quantity < 0)
    or (kind = 'adjustment' and quantity <> 0)
  )
);

create index stock_movements_item_idx on public.stock_movements (item_id, created_at desc);
create index stock_movements_job_idx on public.stock_movements (job_id);
create index stock_movements_order_idx on public.stock_movements (order_id);

create or replace function app.stock_movements_stamp()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.created_by_name is null and auth.uid() is not null then
    select coalesce(nullif(btrim(p.full_name), ''), p.email::text) into new.created_by_name
    from public.profiles p where p.user_id = auth.uid();
  end if;
  new.note := nullif(left(btrim(coalesce(new.note, '')), 500), '');
  return new;
end;
$$;

create or replace function app.stock_movements_apply()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  update public.stock_items set on_hand = on_hand + new.quantity where id = new.item_id;
  return new;
end;
$$;

revoke all on function app.stock_movements_stamp(), app.stock_movements_apply()
  from public, anon, authenticated;

create trigger stock_movements_stamp
  before insert on public.stock_movements
  for each row execute function app.stock_movements_stamp();

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function app.stock_movements_apply();

-- ── 7. Tilgang ──────────────────────────────────────────────────────────────
-- Administratorer styrer varer, stykklister og innkjøp. Produksjon ser alt og
-- kan registrere mottak, telling og svinn. Kunder og media ser ingenting.
alter table public.suppliers            enable row level security;
alter table public.stock_items          enable row level security;
alter table public.product_components   enable row level security;
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.stock_movements      enable row level security;

create policy suppliers_select on public.suppliers
  for select to authenticated using (app.is_production());
create policy suppliers_write on public.suppliers
  for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy stock_items_select on public.stock_items
  for select to authenticated using (app.is_production());
create policy stock_items_write on public.stock_items
  for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy product_components_select on public.product_components
  for select to authenticated using (app.is_production());
create policy product_components_write on public.product_components
  for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy purchase_orders_select on public.purchase_orders
  for select to authenticated using (app.is_production());
create policy purchase_orders_write on public.purchase_orders
  for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy purchase_order_lines_select on public.purchase_order_lines
  for select to authenticated using (app.is_production());
create policy purchase_order_lines_write on public.purchase_order_lines
  for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy stock_movements_select on public.stock_movements
  for select to authenticated using (app.is_production());
-- Bare nye bevegelser, aldri endring eller sletting. Kolonnene som knytter en
-- bevegelse til en jobb, en bestilling eller et innkjøp kan ikke settes
-- herfra (se grant under); de settes av funksjonene.
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated with check (app.is_production());

grant select on public.suppliers, public.stock_items, public.product_components,
  public.purchase_orders, public.purchase_order_lines, public.stock_movements
  to authenticated;

grant insert, update, delete on public.suppliers, public.product_components to authenticated;

grant insert (item_number, name, category, supply, unit, product_id, supplier_id,
              reorder_point, location, notes, active)
  on public.stock_items to authenticated;
grant update (item_number, name, category, supply, unit, product_id, supplier_id,
              reorder_point, location, notes, active)
  on public.stock_items to authenticated;
grant delete on public.stock_items to authenticated;

grant insert (supplier_id, kind, ordered_on, expected_on, reference, notes)
  on public.purchase_orders to authenticated;
grant update (supplier_id, kind, status, ordered_on, expected_on, reference, notes)
  on public.purchase_orders to authenticated;
grant delete on public.purchase_orders to authenticated;
grant usage on sequence public.purchase_number_seq to authenticated;

grant insert (purchase_order_id, item_id, qty_ordered, note)
  on public.purchase_order_lines to authenticated;
grant update (qty_ordered, note) on public.purchase_order_lines to authenticated;
grant delete on public.purchase_order_lines to authenticated;

grant insert (item_id, quantity, kind, note, occurred_on)
  on public.stock_movements to authenticated;

-- ── 8. Oversikten: beholdning, bestilt og behov ─────────────────────────────
-- on_order: bestilt hos leverandør, ikke mottatt.
-- reserved: det åpne produksjonsjobber kommer til å bruke av varen, etter
-- stykklista. available: beholdning minus det som er bundet.
create view public.stock_overview
with (security_invoker = true)
as
select
  s.*,
  coalesce(po.on_order, 0)::numeric(12,3)             as on_order,
  coalesce(rs.reserved, 0)::numeric(12,3)             as reserved,
  (s.on_hand - coalesce(rs.reserved, 0))::numeric(12,3) as available,
  (s.active and s.reorder_point > 0
     and s.on_hand - coalesce(rs.reserved, 0) < s.reorder_point) as below_minimum
from public.stock_items s
left join lateral (
  select sum(greatest(l.qty_ordered - l.qty_received, 0)) as on_order
  from public.purchase_order_lines l
  join public.purchase_orders o on o.id = l.purchase_order_id
  where l.item_id = s.id and o.status = 'ordered'
) po on true
left join lateral (
  select sum(c.qty + c.qty_per_metre * coalesce(j.length_m, p.length_m, 0)) as reserved
  from public.product_components c
  join public.production_jobs j on j.product_id = c.product_id
  join public.products p on p.id = j.product_id
  where c.item_id = s.id
    and p.sourcing = 'assembled'
    and j.status in ('queued', 'in_progress')
) rs on true;

grant select on public.stock_overview to authenticated;

-- Hva som har gått hvor i en periode, per vare. Alle tall er positive.
create or replace function public.stock_usage(p_from date default null, p_to date default null)
returns table (
  item_id            uuid,
  received           numeric,
  produced           numeric,
  used_in_production numeric,
  sold               numeric,
  scrapped           numeric,
  returned           numeric,
  adjusted           numeric
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select m.item_id,
         coalesce(sum(m.quantity)  filter (where m.kind = 'receipt'), 0),
         coalesce(sum(m.quantity)  filter (where m.kind = 'production_in'), 0),
         coalesce(-sum(m.quantity) filter (where m.kind = 'production_out'), 0),
         coalesce(-sum(m.quantity) filter (where m.kind = 'sale'), 0),
         coalesce(-sum(m.quantity) filter (where m.kind = 'scrap'), 0),
         coalesce(sum(m.quantity)  filter (where m.kind = 'return'), 0),
         coalesce(sum(m.quantity)  filter (where m.kind = 'adjustment'), 0)
  from public.stock_movements m
  where (p_from is null or m.occurred_on >= p_from)
    and (p_to is null or m.occurred_on <= p_to)
  group by m.item_id;
$$;

revoke all on function public.stock_usage(date, date) from public, anon;
grant execute on function public.stock_usage(date, date) to authenticated;

-- ── 9. Varemottak ───────────────────────────────────────────────────────────
create or replace function public.receive_purchase_line(
  p_line uuid,
  p_qty numeric,
  p_received_on date default current_date,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_line  record;
  v_order record;
begin
  if not app.is_production() then
    raise exception 'Bare ansatte kan registrere varemottak.' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Mengden må være større enn null.' using errcode = 'P0001';
  end if;
  if coalesce(p_received_on, current_date) > current_date then
    raise exception 'Mottaksdatoen kan ikke ligge fram i tid.' using errcode = 'P0001';
  end if;

  select l.* into v_line from public.purchase_order_lines l where l.id = p_line for update;
  if v_line.id is null then
    raise exception 'Fant ikke linja.' using errcode = 'P0001';
  end if;
  select o.* into v_order from public.purchase_orders o where o.id = v_line.purchase_order_id for update;
  if v_order.status <> 'ordered' then
    raise exception 'Innkjøpet er avsluttet.' using errcode = 'P0001';
  end if;

  insert into public.stock_movements (item_id, quantity, kind, purchase_line_id, note, occurred_on)
  values (v_line.item_id, p_qty, 'receipt', p_line,
          coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Innkjøp ' || v_order.po_number),
          coalesce(p_received_on, current_date));

  update public.purchase_order_lines
     set qty_received = qty_received + p_qty
   where id = p_line;

  -- Innkjøpet er mottatt når alle linjene er kommet.
  if not exists (
    select 1 from public.purchase_order_lines l
    where l.purchase_order_id = v_order.id and l.qty_received < l.qty_ordered
  ) then
    update public.purchase_orders set status = 'received' where id = v_order.id;
  end if;
end;
$$;

revoke all on function public.receive_purchase_line(uuid, numeric, date, text) from public, anon;
grant execute on function public.receive_purchase_line(uuid, numeric, date, text) to authenticated;
