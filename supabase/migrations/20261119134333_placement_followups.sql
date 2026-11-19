-- Plassering av leidere og skap: to rettelser etter gjennomgang.

-- ── 1. Bare leverte leidere kan tas i bruk av kunden ────────────────────────
-- Grensesnittet tilbyr det bare for leverte leidere, men funksjonen kan
-- kalles direkte. En leider i produksjon eller en utrangert leider skal ikke
-- kunne settes «i bruk» av andre enn NorthWest Coast.
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
declare
  v_status public.ladder_lifecycle_status;
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

  select l.status into v_status from public.ladders l where l.id = p_ladder;
  if v_status not in ('delivered', 'installed') and not app.is_staff() then
    if v_status = 'in_production' then
      raise exception 'Leideren er ikke levert ennå.' using errcode = 'P0001';
    end if;
    raise exception 'Leideren er utrangert og kan ikke tas i bruk.' using errcode = 'P0001';
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

-- ── 2. Skap: «nøyaktig sted» følger plasseringen ────────────────────────────
-- Feltet ble stående fra forrige plassering når det ble tømt, fordi den nye
-- verdien bare erstattet den gamle når den hadde innhold. Skjemaet sender
-- alltid det som skal stå, så verdien settes som den er. Samme regel for
-- status som for leidere.
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

  if v_cabinet.status not in ('delivered', 'installed') and not app.is_staff() then
    raise exception 'Skapet er ikke levert, eller det er utrangert.' using errcode = 'P0001';
  end if;

  update public.cabinets
     set vessel_id = p_vessel,
         project_id = p_project,
         installed_at = coalesce(p_installed_at, current_date),
         location_note = v_location,
         status = 'installed'
   where id = p_cabinet;
end;
$$;
