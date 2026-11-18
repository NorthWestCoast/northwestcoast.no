alter table public.products
  add column price_on_request boolean not null default false;

comment on column public.products.price_on_request is
  'Ingen fast pris – selges på forespørsel. price_nok teller da ikke i summer.';

insert into public.products
  (product_number, name, kind, length_m, steps, price_nok, price_on_request)
values
  ('ARG-2ML', 'Argostep – 2ML', 'ladder', 2.0, null, 0, true)
on conflict (product_number) do nothing;

create table public.product_price_history (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  old_price_nok   integer,
  new_price_nok   integer,
  old_on_request  boolean,
  new_on_request  boolean,
  changed_by      uuid,
  changed_at      timestamptz not null default now()
);

create index product_price_history_product_idx
  on public.product_price_history (product_id, changed_at desc);

create or replace function public.log_product_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.price_nok is distinct from old.price_nok
     or new.price_on_request is distinct from old.price_on_request then
    insert into public.product_price_history
      (product_id, old_price_nok, new_price_nok, old_on_request, new_on_request, changed_by)
    values
      (old.id, old.price_nok, new.price_nok, old.price_on_request, new.price_on_request, auth.uid());
  end if;
  return new;
end;
$$;

revoke execute on function public.log_product_price_change() from public, anon, authenticated;

create trigger products_log_price_change
  after update on public.products
  for each row execute function public.log_product_price_change();

alter table public.product_price_history enable row level security;

create policy product_price_history_select on public.product_price_history
  for select to authenticated
  using (app.is_staff());

grant select on public.product_price_history to authenticated;
