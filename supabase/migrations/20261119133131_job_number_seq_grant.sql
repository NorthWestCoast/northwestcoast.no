-- Manuell opprettelse av produksjonsjobb («Ny jobb» i produksjon) feilet med
-- «permission denied for sequence job_number_seq». Jobbnummeret er en
-- standardverdi som henter neste tall fra sekvensen, og sekvensen ble
-- opprettet etter at standardrettighetene for sekvenser ble fjernet.
--
-- RLS (production_jobs_manage) avgjør fortsatt hvem som får sette inn en jobb:
-- bare administratorer. Rettigheten gir bare lov til å hente neste nummer.
grant usage on sequence public.job_number_seq to authenticated;
