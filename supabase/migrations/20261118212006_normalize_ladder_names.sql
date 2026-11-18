-- Den gjennomgåtte prislista skriver «Argostep – 3ML» (tankestrek). Seeden brukte
-- vanlig bindestrek, og nettsiden leser nå navnet fra databasen.
update public.products
set name = replace(name, ' - ', ' – ')
where kind = 'ladder' and name like '% - %';
