-- Ny ansattrolle: media. Styrer nyheter og galleri, og ingenting annet.
--
-- Står i egen migrasjon fordi en ny enum-verdi ikke kan brukes i samme
-- transaksjon som den legges til i. Funksjonene som bruker den kommer i neste.
alter type public.staff_role add value if not exists 'media';
