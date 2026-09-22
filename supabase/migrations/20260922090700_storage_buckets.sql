-- ============================================================================
-- Storage: tre private bøtter.
--
-- Ingen bøtte er offentlig, og det finnes ingen storage-policy for anon eller
-- authenticated. All lesing skjer med signerte URL-er generert på serveren,
-- og all opplasting via signerte opplastings-URL-er fra en route handler.
--
-- Hvorfor så strengt: et bilde av leiderens innfestingspunkt forteller hvor
-- et fartøy er svakt. Bøtta med los-bilder må ikke kunne listes av noen som
-- gjetter en sti.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('maintenance-photos',  'maintenance-photos',  false, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic']),
  ('ladder-state-photos', 'ladder-state-photos', false, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic']),
  ('service-reports',     'service-reports',     false, 20971520,
   array['application/pdf'])
on conflict (id) do nothing;
