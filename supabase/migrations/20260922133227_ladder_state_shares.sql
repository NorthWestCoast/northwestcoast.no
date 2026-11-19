create table public.ladder_state_shares (
  id             uuid primary key default gen_random_uuid(),
  ladder_id      uuid not null references public.ladders(id) on delete cascade,
  vessel_id      uuid references public.vessels(id) on delete set null,
  token_hash     text not null unique,
  created_by     uuid references auth.users(id) on delete set null,
  note           text,
  expires_at     timestamptz not null default (now() + interval '7 days'),
  revoked_at     timestamptz,
  view_count     integer not null default 0,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now()
);

create index ladder_state_shares_ladder_idx
  on public.ladder_state_shares (ladder_id, created_at desc);

comment on column public.ladder_state_shares.expires_at is
  'Tilgangsstyring for selve lenken. Uavhengig av 24-timersmerkingen av bilder.';
comment on column public.ladder_state_shares.view_count is
  'Viser om losene faktisk apner lenkene - nokkeltallet for om funksjonen virker.';

create type public.ladder_photo_kind as enum
  ('ladder', 'attachment_point', 'overview', 'other');

create table public.ladder_state_photos (
  id           uuid primary key default gen_random_uuid(),
  share_id     uuid not null
    references public.ladder_state_shares(id) on delete cascade,
  storage_path text not null,
  kind         public.ladder_photo_kind not null default 'other',
  captured_at  timestamptz not null,
  uploaded_at  timestamptz not null default now(),
  caption      text
);

create index ladder_state_photos_share_idx
  on public.ladder_state_photos (share_id, captured_at desc);

create or replace function public.purge_expired_shares(retain_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.ladder_state_shares
  where expires_at < now() - make_interval(days => retain_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.purge_expired_shares(integer) from public, anon, authenticated;

comment on function public.purge_expired_shares(integer) is
  'Sletter delinger (og bilderader via cascade) som utlop for mer enn N dager siden.';
