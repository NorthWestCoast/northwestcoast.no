-- ============================================================================
-- Faste kontroller fra brukermanualen som oppgaver på leideren
-- ============================================================================
-- Når en leider tas i bruk (installed_at settes), får den to oppgaver:
--   - Kvartalsvis kontroll, hver 3. måned.
--   - Test etter ISO 799-1, 30 måneder etter at den ble tatt i bruk.
-- Når en kvartalsvis kontroll registreres (sjekklisten «quarterly», i Min side
-- eller via lenke), lukkes oppgaven, og neste legges inn tre måneder etter.
-- Tas leideren ut av drift, avlyses den kvartalsvise oppgaven.
--
-- Oppgavene er vanlige rader i ladder_tasks, merket med `auto`, så de vises i
-- kalenderen og under «Service og oppgaver» som alle andre.
--
-- MERK: tidsstempelet i filnavnet er selvvalgt. Når migrasjonen kjøres i
-- produksjon med apply_migration, skal filen få versjonen derfra.

alter table public.ladder_tasks
  add column auto text check (auto is null or auto in ('quarterly_inspection', 'iso_test'));

comment on column public.ladder_tasks.auto is
  'Fast kontroll fra brukermanualen, lagt inn av databasen: quarterly_inspection eller iso_test. Null for oppgaver folk legger inn selv.';

-- Høyst én åpen fast oppgave av hver sort per leider.
create unique index ladder_tasks_auto_open_idx
  on public.ladder_tasks (ladder_id, auto)
  where status = 'open' and auto is not null;

-- Legger inn de faste oppgavene som mangler. Den kvartalsvise får første
-- frist på eller etter i dag (en leider som er registrert med en gammel
-- dato, skal ikke starte med en forfalt kontroll). Testen kommer bare én
-- gang per leider, 30 måneder etter datoen den ble tatt i bruk.
create or replace function app.ensure_auto_tasks(p_ladder uuid, p_from date)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_due date;
  v_step integer := 1;
begin
  if p_ladder is null or p_from is null then
    return;
  end if;

  if not exists (select 1 from public.ladder_tasks t
                 where t.ladder_id = p_ladder and t.auto = 'quarterly_inspection' and t.status = 'open') then
    v_due := (p_from + make_interval(months => 3))::date;
    while v_due < current_date loop
      v_step := v_step + 1;
      v_due := (p_from + make_interval(months => 3 * v_step))::date;
    end loop;

    insert into public.ladder_tasks
      (ladder_id, kind, title, description, due_date, recurrence_months, created_by, auto)
    values
      (p_ladder, 'inspection', 'Kvartalsvis kontroll',
       'Sjekklisten i brukermanualen: skader på stropper, tau og trinn, forurensning, skilt og dokumentasjon. Registreres under «Registrer vedlikehold».',
       v_due, 3, null, 'quarterly_inspection');
  end if;

  if not exists (select 1 from public.ladder_tasks t
                 where t.ladder_id = p_ladder and t.auto = 'iso_test') then
    insert into public.ladder_tasks
      (ladder_id, kind, title, description, due_date, recurrence_months, created_by, auto)
    values
      (p_ladder, 'test', 'Test etter ISO 799-1',
       'Brukermanualen: en leider som har vært i tjeneste i mer enn 30 måneder, skal testes etter ISO 799-1. Testresultatet skal kunne vises til los og Kystvakten.',
       (p_from + make_interval(months => 30))::date, null, null, 'iso_test');
  end if;
end;
$$;

revoke all on function app.ensure_auto_tasks(uuid, date) from public, anon, authenticated;

-- Tatt i bruk: legg inn oppgavene. Tatt ned: avlys den kvartalsvise (testen
-- blir stående til leideren tas i bruk igjen). Utrangert: avlys begge.
create or replace function app.ladders_auto_tasks()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.status = 'retired' then
    update public.ladder_tasks
       set status = 'cancelled'
     where ladder_id = new.id and auto is not null and status = 'open';
  elsif new.installed_at is null then
    if tg_op = 'UPDATE' and old.installed_at is not null then
      update public.ladder_tasks
         set status = 'cancelled'
       where ladder_id = new.id and auto = 'quarterly_inspection' and status = 'open';
    end if;
  elsif tg_op = 'INSERT' or old.installed_at is distinct from new.installed_at
        or old.status is distinct from new.status then
    perform app.ensure_auto_tasks(new.id, new.installed_at);
  end if;
  return null;
end;
$$;

revoke all on function app.ladders_auto_tasks() from public, anon, authenticated;

create trigger ladders_auto_tasks
  after insert or update of installed_at, status on public.ladders
  for each row execute function app.ladders_auto_tasks();

-- En registrert kvartalsvis kontroll lukker den åpne oppgaven og legger inn
-- neste, tre måneder etter datoen kontrollen ble utført. Gjelder også
-- ufullstendige kontroller og papirskjema: kontrollen er gjort, og det som
-- mangler, står i historikken.
create or replace function app.maintenance_logs_complete_quarterly()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_task record;
begin
  if new.checklist is distinct from 'quarterly' or new.ladder_id is null or new.source = 'web' then
    return null;
  end if;

  select t.* into v_task
    from public.ladder_tasks t
   where t.ladder_id = new.ladder_id and t.auto = 'quarterly_inspection' and t.status = 'open'
   for update;
  if v_task.id is null then
    return null;
  end if;

  update public.ladder_tasks
     set status = 'done', completed_at = now(),
         completed_by = new.reported_by_user_id, completed_log_id = new.id
   where id = v_task.id;

  insert into public.ladder_tasks
    (ladder_id, kind, title, description, due_date, recurrence_months, created_by, auto)
  values
    (v_task.ladder_id, v_task.kind, v_task.title, v_task.description,
     (new.performed_at + make_interval(months => coalesce(v_task.recurrence_months, 3)))::date,
     v_task.recurrence_months, v_task.created_by, v_task.auto);

  return null;
end;
$$;

revoke all on function app.maintenance_logs_complete_quarterly() from public, anon, authenticated;

create trigger maintenance_logs_complete_quarterly
  after insert on public.maintenance_logs
  for each row execute function app.maintenance_logs_complete_quarterly();

-- Fullfører en oppgave for hånd (Min side → Service og oppgaver). Som før,
-- men neste forekomst av en fast oppgave beholder merket, så den fortsatt
-- lukkes av neste registrerte kontroll. Ellers uendret fra
-- portal_v2_operations.
create or replace function public.complete_ladder_task(
  p_task uuid,
  p_notes text default null,
  p_performed_at date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_task record;
  v_name text;
  v_log  uuid;
  v_when date := coalesce(p_performed_at, current_date);
begin
  select t.* into v_task from public.ladder_tasks t where t.id = p_task for update;

  if v_task.id is null then
    raise exception 'Fant ikke oppgaven.' using errcode = 'P0001';
  end if;
  if not (app.can_access_ladder(v_task.ladder_id) or app.is_staff()) then
    raise exception 'Du har ikke tilgang til denne leideren.' using errcode = '42501';
  end if;
  if v_task.status <> 'open' then
    raise exception 'Oppgaven er allerede avsluttet.' using errcode = 'P0001';
  end if;
  if v_when > current_date then
    raise exception 'Datoen kan ikke ligge fram i tid.' using errcode = 'P0001';
  end if;

  select coalesce(p.full_name, p.email::text) into v_name
  from public.profiles p where p.user_id = auth.uid();

  insert into public.maintenance_logs
    (ladder_id, vessel_id, serial_number_raw, reported_by_user_id, reporter_name,
     performed_at, notes, source, kind, title)
  select l.id, l.vessel_id, l.serial_number, auth.uid(), v_name,
         v_when, nullif(left(btrim(coalesce(p_notes, '')), 4000), ''),
         'portal', v_task.kind, v_task.title
  from public.ladders l where l.id = v_task.ladder_id
  returning id into v_log;

  update public.ladder_tasks
     set status = 'done', completed_at = now(), completed_by = auth.uid(),
         completed_log_id = v_log
   where id = p_task;

  if v_task.recurrence_months is not null then
    insert into public.ladder_tasks
      (ladder_id, kind, title, description, due_date, recurrence_months, created_by, auto)
    values
      (v_task.ladder_id, v_task.kind, v_task.title, v_task.description,
       (v_when + make_interval(months => v_task.recurrence_months))::date,
       v_task.recurrence_months, v_task.created_by, v_task.auto);
  end if;

  return v_log;
end;
$$;

-- Leidere som allerede er tatt i bruk, får oppgavene nå.
do $$
declare
  v_ladder record;
begin
  for v_ladder in
    select l.id, l.installed_at from public.ladders l
     where l.installed_at is not null and l.status <> 'retired'
  loop
    perform app.ensure_auto_tasks(v_ladder.id, v_ladder.installed_at);
  end loop;
end;
$$;
