-- En leider som er bygget til lager og venter på å bli solgt. Verdien må
-- ligge i en egen migrasjon: en ny enum-verdi kan ikke brukes i samme
-- transaksjon som den legges til.
alter type public.ladder_lifecycle_status add value if not exists 'in_stock';
