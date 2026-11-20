-- Sikkerhetsgjennomgang 19.11.2026, første del: offentlige oppslag skal ikke
-- velte på hjelpefunksjonene.
--
-- Policyene på posts, gallery_images og products faller tilbake på
-- app.is_media()/app.is_staff() for rader som ikke er offentlige. Uten USAGE
-- på skjemaet feiler hele spørringen for en anonym besøkende i stedet for å
-- gi null rader (f.eks. når et innlegg er tidsinnstilt). Hver funksjon og
-- tabell i skjemaet har fortsatt sine egne rettigheter.
grant usage on schema app to anon;
