-- ============================================================================
-- Bildebiblioteket: felles bilder til nyhetene
-- ============================================================================
-- Filene ligger i bøtta public-media, i mappen bibliotek/ (og posts/ for
-- bilder som ble lastet opp før biblioteket fantes). Tabellen er oversikten
-- over dem: beskrivelse på norsk og engelsk, størrelse og hvem som lastet
-- opp. Innleggene viser til stien, så samme bilde kan brukes i flere innlegg.
-- Administrator og media styrer biblioteket; ingen andre ser det.
create table public.media_library (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null unique
               check (storage_path ~ '^(bibliotek|posts)/[A-Za-z0-9][A-Za-z0-9_-]*\.(jpg|jpeg|png|webp|avif)$'),
  file_name    text check (file_name is null or length(file_name) <= 200),
  alt_no       text check (alt_no is null or length(alt_no) <= 300),
  alt_en       text check (alt_en is null or length(alt_en) <= 300),
  width        integer check (width is null or width > 0),
  height       integer check (height is null or height > 0),
  bytes        integer check (bytes is null or bytes >= 0),
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index media_library_created_idx on public.media_library (created_at desc);

create trigger media_library_set_updated_at
  before update on public.media_library
  for each row execute function public.set_updated_at();

alter table public.media_library enable row level security;

create policy media_library_manage on public.media_library
  for all to authenticated
  using (app.is_media()) with check (app.is_media());

grant select, insert, update, delete on public.media_library to authenticated;

comment on column public.media_library.alt_no is
  'Beskrivelse av bildet. Blir bildeteksten når bildet velges til et norsk innlegg.';
comment on column public.media_library.alt_en is
  'Beskrivelse på engelsk. Blir bildeteksten når bildet velges til den engelske teksten.';

-- Bilder som ble lastet opp til nyhetene før biblioteket fantes.
insert into public.media_library (storage_path, bytes, created_at)
select o.name,
       case when o.metadata ->> 'size' ~ '^[0-9]{1,9}$' then (o.metadata ->> 'size')::integer end,
       coalesce(o.created_at, now())
from storage.objects o
where o.bucket_id = 'public-media'
  and o.name ~ '^posts/[A-Za-z0-9][A-Za-z0-9_-]*\.(jpg|jpeg|png|webp|avif)$'
on conflict (storage_path) do nothing;
