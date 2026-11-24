-- ============================================================================
-- Nyhetsinnlegg: versjonshistorikk og automatisk lagring
-- ============================================================================

-- ── 1. Versjoner ────────────────────────────────────────────────────────────
-- Hver lagring av et innlegg blir en versjon, og et slettet innlegg blir
-- liggende her så det kan hentes tilbake. Versjonene skrives av en trigger,
-- så de kommer med uansett hvor endringen kommer fra, og ingen kan endre
-- eller slette dem gjennom API-et.
create table public.post_revisions (
  id              uuid primary key default gen_random_uuid(),
  -- Ikke fremmednøkkel: historikken skal overleve at innlegget slettes.
  post_id         uuid not null,
  action          text not null check (action in ('created', 'updated', 'deleted', 'restored')),
  -- Hele raden slik den ble lagret (ved sletting: slik den var).
  data            jsonb not null,
  restored_from   uuid,
  changed_by      uuid references auth.users(id) on delete set null,
  changed_by_name text,
  changed_at      timestamptz not null default now()
);

create index post_revisions_post_idx on public.post_revisions (post_id, changed_at desc);
create index post_revisions_deleted_idx on public.post_revisions (changed_at desc) where action = 'deleted';

alter table public.post_revisions enable row level security;

create policy post_revisions_read on public.post_revisions
  for select to authenticated
  using (app.is_media());

grant select on public.post_revisions to authenticated;

-- Kjører med eierens rettigheter fordi ingen bruker får skrive i
-- post_revisions selv. Ligger i app, så den ikke kan kalles som RPC.
create or replace function app.log_post_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row    public.posts;
  v_action text;
  v_source uuid := nullif(current_setting('nwc.restored_from', true), '')::uuid;
  v_name   text;
begin
  if tg_op = 'DELETE' then
    v_row := old;
    v_action := 'deleted';
  else
    v_row := new;
    -- En lagring uten endringer gir ingen ny versjon.
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
      return null;
    end if;
    v_action := case
      when v_source is not null then 'restored'
      when tg_op = 'INSERT' then 'created'
      else 'updated'
    end;
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), u.email::text)
    into v_name
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = auth.uid();

  insert into public.post_revisions (post_id, action, data, restored_from, changed_by, changed_by_name)
  values (v_row.id, v_action, to_jsonb(v_row),
          case when v_action = 'restored' then v_source end,
          auth.uid(), v_name);
  return null;
end $$;

revoke all on function app.log_post_revision() from public;

create trigger posts_log_revision
  after insert or update or delete on public.posts
  for each row execute function app.log_post_revision();

-- Innleggene som finnes nå, får sin nåværende utgave som første versjon.
insert into public.post_revisions (post_id, action, data, changed_by, changed_by_name, changed_at)
select p.id, 'updated', to_jsonb(p),
       (select u.id from auth.users u where u.id = p.author_id),
       p.author_name, p.updated_at
from public.posts p;

-- Henter tilbake en versjon. Finnes innlegget, erstattes innholdet (status og
-- publiseringsdato beholdes). Er det slettet, kommer det tilbake som kladd.
-- Kjører med den innloggedes rettigheter, så RLS på posts avgjør som ellers.
create or replace function public.restore_post_revision(p_revision uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rev  public.post_revisions;
  v_post public.posts;
begin
  if not app.is_media() then
    raise exception 'Bare administrator og media kan hente tilbake innlegg.' using errcode = '42501';
  end if;

  select * into v_rev from public.post_revisions where id = p_revision;
  if not found then
    raise exception 'Fant ikke versjonen.' using errcode = 'P0002';
  end if;
  v_post := jsonb_populate_record(null::public.posts, v_rev.data);

  perform set_config('nwc.restored_from', v_rev.id::text, true);

  if exists (select 1 from public.posts where id = v_rev.post_id) then
    update public.posts set
      slug            = v_post.slug,
      title_no        = v_post.title_no,
      title_en        = v_post.title_en,
      excerpt_no      = v_post.excerpt_no,
      excerpt_en      = v_post.excerpt_en,
      body_no         = v_post.body_no,
      body_en         = v_post.body_en,
      tag_no          = v_post.tag_no,
      tag_en          = v_post.tag_en,
      cover_image_url = v_post.cover_image_url
    where id = v_rev.post_id;
  else
    begin
      insert into public.posts (id, slug, title_no, title_en, excerpt_no, excerpt_en, body_no, body_en,
                                tag_no, tag_en, cover_image_url, status, published_at,
                                author_id, author_name, created_at)
      values (v_rev.post_id, v_post.slug, v_post.title_no, v_post.title_en, v_post.excerpt_no,
              v_post.excerpt_en, v_post.body_no, v_post.body_en, v_post.tag_no, v_post.tag_en,
              v_post.cover_image_url, 'draft', v_post.published_at,
              v_post.author_id, v_post.author_name, coalesce(v_post.created_at, now()));
    exception when foreign_key_violation then
      -- Den som skrev innlegget, finnes ikke lenger som bruker.
      insert into public.posts (id, slug, title_no, title_en, excerpt_no, excerpt_en, body_no, body_en,
                                tag_no, tag_en, cover_image_url, status, published_at,
                                author_id, author_name, created_at)
      values (v_rev.post_id, v_post.slug, v_post.title_no, v_post.title_en, v_post.excerpt_no,
              v_post.excerpt_en, v_post.body_no, v_post.body_en, v_post.tag_no, v_post.tag_en,
              v_post.cover_image_url, 'draft', v_post.published_at,
              null, v_post.author_name, coalesce(v_post.created_at, now()));
    end;
  end if;

  perform set_config('nwc.restored_from', '', true);
  return v_rev.post_id;
end $$;

revoke all on function public.restore_post_revision(uuid) from public, anon;
grant execute on function public.restore_post_revision(uuid) to authenticated;

-- ── 2. Automatisk lagring ───────────────────────────────────────────────────
-- Skjemaet lagrer det som står i det, mens man skriver. Det er en kopi per
-- person og innlegg («ny» for et innlegg som ikke er opprettet ennå), og den
-- rører ikke selve innlegget: det som er publisert, endres først når man
-- trykker Lagre. Kopien slettes når innlegget lagres.
create table public.post_autosaves (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  post_key   text not null
             check (post_key = 'ny' or post_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  data       jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, post_key)
);

create trigger post_autosaves_set_updated_at
  before update on public.post_autosaves
  for each row execute function public.set_updated_at();

alter table public.post_autosaves enable row level security;

create policy post_autosaves_own on public.post_autosaves
  for all to authenticated
  using (user_id = auth.uid() and app.is_media())
  with check (user_id = auth.uid() and app.is_media());

grant select, insert, update, delete on public.post_autosaves to authenticated;
