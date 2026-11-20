-- Lager, del 2: produksjonsjobbene og bestillingene fører lageret selv.
--
-- Del 1 (inventory_schema) har tabellene. Her kobles de til det som alt
-- finnes: når en jobb er ferdig montert trekkes delene i stykklista, og når
-- den leveres går enheten ut som solgt. Reservedeler trekkes når
-- bestillingen er levert.

-- ── 10. Produksjonsjobbene fører lageret selv ───────────────────────────────
-- En enhet som er bygget til lager beholder jobben sin, og den jobben
-- knyttes til bestillingen når enheten selges (se seksjon 12).
alter table public.production_jobs
  add column stock_posted_at timestamptz,
  add column stock_sold_at   timestamptz;

alter table public.production_jobs drop constraint production_jobs_status_check;
alter table public.production_jobs add constraint production_jobs_status_check
  check (status in ('queued', 'in_progress', 'ready', 'shipped', 'delivered', 'cancelled', 'stocked'));

comment on column public.production_jobs.stock_posted_at is
  'Når delene ble trukket fra lager (første gang jobben ble ferdig). Hindrer at de trekkes to ganger.';

create or replace function app.production_jobs_post_stock()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sourcing text;
  v_length   numeric;
  v_item     uuid;
  v_cab_item uuid;
  v_need     numeric;
  c          record;
begin
  if new.status = old.status then
    return new;
  end if;

  select p.sourcing, p.length_m into v_sourcing, v_length
  from public.products p where p.id = new.product_id;
  select s.id into v_item from public.stock_items s where s.product_id = new.product_id;

  -- Ferdig montert: delene i stykklista er brukt, og enheten står på lager
  -- til den leveres. Skjer én gang per jobb, også om et steg åpnes igjen.
  if new.status = 'ready' and new.stock_posted_at is null then
    new.stock_posted_at := now();

    if v_sourcing = 'assembled' then
      v_length := coalesce(new.length_m, v_length, 0);
      for c in
        select pc.item_id, pc.qty, pc.qty_per_metre
        from public.product_components pc where pc.product_id = new.product_id
      loop
        v_need := c.qty + c.qty_per_metre * v_length;
        if v_need > 0 then
          insert into public.stock_movements (item_id, quantity, kind, job_id, order_id, note)
          values (c.item_id, -v_need, 'production_out', new.id, new.order_id, 'Jobb ' || new.job_number);
        end if;
      end loop;

      if v_item is not null then
        insert into public.stock_movements (item_id, quantity, kind, job_id, order_id, note)
        values (v_item, 1, 'production_in', new.id, new.order_id, 'Jobb ' || new.job_number);
      end if;
    end if;
  end if;

  -- Levert: enheten går ut av lageret som solgt. Gjelder både det vi har
  -- satt sammen selv og det vi selger videre.
  if new.status = 'delivered' and new.stock_sold_at is null then
    new.stock_sold_at := now();

    if v_item is not null then
      insert into public.stock_movements (item_id, quantity, kind, job_id, order_id, note)
      values (v_item, -1, 'sale', new.id, new.order_id,
              'Jobb ' || new.job_number || coalesce(', bestilling ' || new.order_number, ''));
    end if;

    if new.kind = 'ladder' and new.with_cabinet and new.cabinet_product_id is not null then
      select s.id into v_cab_item from public.stock_items s where s.product_id = new.cabinet_product_id;
      if v_cab_item is not null then
        insert into public.stock_movements (item_id, quantity, kind, job_id, order_id, note)
        values (v_cab_item, -1, 'sale', new.id, new.order_id,
                'Skap til jobb ' || new.job_number || coalesce(', bestilling ' || new.order_number, ''));
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.production_jobs_post_stock() from public, anon, authenticated;

create trigger production_jobs_post_stock
  before update of status on public.production_jobs
  for each row execute function app.production_jobs_post_stock();

-- ── 11. Reservedeler og annet som selges uten produksjonsjobb ───────────────
-- Leidere og skap går ut gjennom jobbene. Reservedeler har ingen jobb, så de
-- trekkes når bestillingen blir levert.
create or replace function app.orders_post_stock()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    insert into public.stock_movements (item_id, quantity, kind, order_id, note)
    select s.id, -sum(ol.qty), 'sale', new.id, 'Bestilling ' || new.order_number
    from public.order_lines ol
    join public.products p on p.id = ol.product_id and p.kind = 'spare_part'
    join public.stock_items s on s.product_id = p.id
    where ol.order_id = new.id
      and not exists (
        select 1 from public.stock_movements m
        where m.order_id = new.id and m.item_id = s.id and m.kind = 'sale' and m.job_id is null
      )
    group by s.id;
  end if;
  return new;
end;
$$;

revoke all on function app.orders_post_stock() from public, anon, authenticated;

create trigger orders_post_stock
  after update of status on public.orders
  for each row execute function app.orders_post_stock();

-- ── 12. Bygget til lager, og solgt fra lager ────────────────────────────────
-- En jobb uten bestilling kan avsluttes som «på lager» (advance_job med
-- status stocked). Når enheten selges, tar den plassen til jobben som ble
-- opprettet for bestillingen: da følger produksjonsnummeret og historikken
-- med, og delene trekkes ikke en gang til.
create or replace function public.fulfil_job_from_stock(p_job uuid, p_stock_job uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job     record;
  v_stock   record;
  v_company uuid;
begin
  if not app.is_production() then
    raise exception 'Bare ansatte kan endre produksjonsjobber.' using errcode = '42501';
  end if;

  select j.* into v_job from public.production_jobs j where j.id = p_job for update;
  select j.* into v_stock from public.production_jobs j where j.id = p_stock_job for update;

  if v_job.id is null or v_stock.id is null then
    raise exception 'Fant ikke jobben.' using errcode = 'P0001';
  end if;
  if v_job.order_id is null then
    raise exception 'Jobben hører ikke til en bestilling.' using errcode = 'P0001';
  end if;
  if v_job.status not in ('queued', 'in_progress') then
    raise exception 'Jobben er allerede ferdig produsert.' using errcode = 'P0001';
  end if;
  if v_job.ladder_id is not null or v_job.serial_number is not null then
    raise exception 'Jobben har allerede et produksjonsnummer. Fjern det først, eller fullfør jobben som vanlig.'
      using errcode = 'P0001';
  end if;
  if v_stock.status <> 'stocked' then
    raise exception 'Enheten står ikke på lager.' using errcode = 'P0001';
  end if;
  if v_stock.product_id <> v_job.product_id
     or v_stock.length_m is distinct from v_job.length_m then
    raise exception 'Enheten på lager er ikke samme produkt og lengde som bestillingen.' using errcode = 'P0001';
  end if;

  select o.company_id into v_company from public.orders o where o.id = v_job.order_id;

  -- Plassholderen for bestillingen fjernes først, så ordrelinja bare har én jobb.
  delete from public.production_jobs where id = p_job;

  update public.production_jobs
     set order_id = v_job.order_id,
         order_line_id = v_job.order_line_id,
         order_number = v_job.order_number,
         customer_label = v_job.customer_label,
         vessel_name = v_job.vessel_name,
         due_date = v_job.due_date,
         with_cabinet = v_job.with_cabinet,
         cabinet_name = v_job.cabinet_name,
         cabinet_product_id = v_job.cabinet_product_id,
         status = 'ready'
   where id = p_stock_job;

  -- Leideren hører nå til kunden, og står som «i produksjon» til den leveres.
  update public.ladders
     set company_id = v_company, status = 'in_production'
   where id = v_stock.ladder_id;

  return p_stock_job;
end;
$$;

revoke all on function public.fulfil_job_from_stock(uuid, uuid) from public, anon;
grant execute on function public.fulfil_job_from_stock(uuid, uuid) to authenticated;

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
  if p_status not in ('shipped', 'delivered', 'cancelled', 'stocked') then
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
  -- En enhet på lager leveres ved at den knyttes til en bestilling
  -- (fulfil_job_from_stock), ikke herfra.
  if v_job.status = 'stocked' and p_status <> 'cancelled' then
    raise exception 'Enheten står på lager. Knytt den til en bestilling for å levere den.'
      using errcode = 'P0001';
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

  elsif p_status = 'stocked' then
    -- Bygget til lager: jobben har ingen bestilling, og enheten blir stående
    -- som ferdigvare til den selges.
    if v_job.order_id is not null then
      raise exception 'Jobben hører til en bestilling og kan ikke legges på lager.' using errcode = 'P0001';
    end if;
    if v_job.status <> 'ready' then
      raise exception 'Alle steg må være kvittert ut før enheten kan legges på lager.' using errcode = 'P0001';
    end if;
    if v_job.kind = 'ladder' and v_job.ladder_id is null then
      raise exception 'Registrer produksjonsnummeret før leideren legges på lager.' using errcode = 'P0001';
    end if;

    update public.production_jobs set status = 'stocked' where id = p_job;
    update public.ladders
       set status = 'in_stock',
           produced_at = coalesce(produced_at, current_date)
     where id = v_job.ladder_id;

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

create or replace function public.set_production_step(
  p_step uuid,
  p_done boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_step   record;
  v_job    record;
  v_name   text;
  v_left   integer;
  v_done   integer;
  v_status text;
begin
  if not app.is_production() then
    raise exception 'Bare produksjon kan kvittere ut steg.' using errcode = '42501';
  end if;

  select s.* into v_step from public.production_job_steps s where s.id = p_step for update;
  if v_step.id is null then
    raise exception 'Fant ikke steget.' using errcode = 'P0001';
  end if;

  select j.* into v_job from public.production_jobs j where j.id = v_step.job_id for update;
  if v_job.status in ('shipped', 'delivered', 'cancelled', 'stocked') then
    raise exception 'Jobben er avsluttet og kan ikke endres.' using errcode = 'P0001';
  end if;

  select coalesce(p.full_name, p.email::text) into v_name
  from public.profiles p where p.user_id = auth.uid();

  update public.production_job_steps
     set done_at = case when p_done then coalesce(done_at, now()) end,
         done_by = case when p_done then coalesce(done_by, auth.uid()) end,
         done_by_name = case when p_done then coalesce(done_by_name, v_name) end,
         note = coalesce(nullif(left(btrim(coalesce(p_note, '')), 1000), ''), note)
   where id = p_step;

  select count(*) filter (where s.done_at is null), count(*) filter (where s.done_at is not null)
    into v_left, v_done
  from public.production_job_steps s where s.job_id = v_job.id;

  v_status := case
                when v_left = 0 then 'ready'
                when v_done > 0 then 'in_progress'
                else 'queued'
              end;

  update public.production_jobs
     set status = v_status,
         started_at = case when v_done > 0 then coalesce(started_at, now()) end,
         completed_at = case when v_left = 0 then coalesce(completed_at, now()) end
   where id = v_job.id;

  if v_status = 'ready' and v_job.status <> 'ready' then
    perform app.notify_staff(
      'admin', 'production_ready',
      'Jobb ' || v_job.job_number || ' er klar for forsendelse',
      v_job.product_name || coalesce(' – ' || v_job.customer_label, ''),
      '/produksjon/' || v_job.id
    );
  end if;

  return jsonb_build_object('status', v_status, 'remaining', v_left);
end;
$$;
