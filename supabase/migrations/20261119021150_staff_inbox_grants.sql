-- Henvendelser og nyhetsbrev hadde policy for ansatte, men ingen
-- tabellrettighet: den opprinnelige grant-lista tok dem ikke med, fordi de den
-- gangen bare ble lest med service-role. Admin leser nå med egen sesjon.
grant select, update on public.contact_requests to authenticated;
grant select, update on public.newsletter_subscribers to authenticated;
grant select on public.email_log to authenticated;
