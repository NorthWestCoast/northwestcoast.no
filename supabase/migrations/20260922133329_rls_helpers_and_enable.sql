create or replace function public.auth_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.company_members where user_id = auth.uid();
$$;

create or replace function public.is_company_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = target
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false);
$$;

create or replace function public.can_access_ladder(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ladders l
    join public.vessels v on v.id = l.vessel_id
    join public.company_members cm on cm.company_id = v.company_id
    where l.id = target and cm.user_id = auth.uid()
  );
$$;

revoke execute on function public.auth_company_ids()      from public, anon;
revoke execute on function public.is_company_admin(uuid)  from public, anon;
revoke execute on function public.can_access_ladder(uuid) from public, anon;
grant  execute on function public.auth_company_ids()      to authenticated;
grant  execute on function public.is_company_admin(uuid)  to authenticated;
grant  execute on function public.can_access_ladder(uuid) to authenticated;

alter table public.companies              enable row level security;
alter table public.company_members        enable row level security;
alter table public.company_invitations    enable row level security;
alter table public.vessels                enable row level security;
alter table public.vessel_members         enable row level security;
alter table public.products               enable row level security;
alter table public.ladders                enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_lines            enable row level security;
alter table public.deliveries             enable row level security;
alter table public.service_reports        enable row level security;
alter table public.maintenance_logs       enable row level security;
alter table public.maintenance_photos     enable row level security;
alter table public.ladder_state_shares    enable row level security;
alter table public.ladder_state_photos    enable row level security;
alter table public.contact_requests       enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.email_log              enable row level security;
