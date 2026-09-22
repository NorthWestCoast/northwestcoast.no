-- ============================================================================
-- Eksplisitte grants.
--
-- RLS avgjør hvilke RADER en rolle ser, men den slår ikke inn før rollen har
-- table-grant i det hele tatt. Supabase gir som standard anon/authenticated
-- bred tilgang til public-skjemaet; her strammes det inn til det vi faktisk
-- har policyer for.
-- ============================================================================

-- Nullstill og bygg opp igjen.
revoke all on all tables in schema public from anon, authenticated;

-- anon ser kun prislista (som allerede ligger åpent på nettsiden).
grant select on public.products to anon;

-- Innlogget bruker: lesetilgang der RLS tillater det.
grant select on
  public.companies,
  public.company_members,
  public.company_invitations,
  public.vessels,
  public.vessel_members,
  public.products,
  public.ladders,
  public.orders,
  public.order_lines,
  public.deliveries,
  public.service_reports,
  public.maintenance_logs,
  public.maintenance_photos,
  public.ladder_state_shares,
  public.ladder_state_photos,
  public.ladder_status
to authenticated;

-- Skriving fra dashboardet: vedlikeholdslogg og los-deling.
grant insert on public.maintenance_logs   to authenticated;
grant insert on public.ladder_state_shares to authenticated;
grant update on public.ladder_state_shares to authenticated;
grant insert on public.ladder_state_photos to authenticated;

-- Administrasjon av eget selskap.
grant update on public.companies to authenticated;
grant insert, update, delete on public.company_members     to authenticated;
grant insert, update, delete on public.company_invitations to authenticated;
grant insert, update, delete on public.vessels             to authenticated;
grant insert, update, delete on public.vessel_members      to authenticated;

-- Staff-skriving går gjennom de samme tabellene; RLS-policyene skiller.
grant insert, update, delete on
  public.ladders, public.products, public.orders, public.order_lines,
  public.deliveries, public.service_reports
to authenticated;

-- Sekvenser som authenticated kan trenge ved insert.
grant usage, select on all sequences in schema public to authenticated;
