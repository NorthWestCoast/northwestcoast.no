-- Demodata for lageret: noen deler, stykklista til 4 m-leideren, bevegelser
-- bakover i tid og et innkjøp som ikke er mottatt ennå.
--
-- BARE for det lokale miljøet, aldri i produksjon: delelista og
-- ferdigvarelinja henger på de ekte produktene, så ekte produksjonsjobber
-- ville trukket demodelene. Fjernes med remove-demo.sql. Kan kjøres flere
-- ganger.
do $$
declare
  p4 record;
begin
  if exists (select 1 from public.suppliers where id = '0d000000-0000-4000-8000-000000000071') then
    raise notice 'Demodata for lageret finnes allerede.';
    return;
  end if;

  select * into p4 from public.products where kind = 'ladder' and length_m = 4;

  insert into public.suppliers (id, name, contact_name, email)
  values ('0d000000-0000-4000-8000-000000000071', 'Demo Tauverk AS', 'Per Tau', 'per@demo.invalid');

  insert into public.stock_items (id, item_number, name, category, supply, unit, supplier_id, reorder_point, location)
  values
    ('0d000000-0000-4000-8000-000000000081', 'DEMO-TRINN', 'Demo: trinn, aluminium', 'part', 'external', 'stk', null, 100, 'Reol A1'),
    ('0d000000-0000-4000-8000-000000000082', 'DEMO-TAU', 'Demo: sidetau 20 mm', 'part', 'purchased', 'm', '0d000000-0000-4000-8000-000000000071', 50, 'Reol B2'),
    ('0d000000-0000-4000-8000-000000000083', 'DEMO-SJAKKEL', 'Demo: sjakkel, syrefast', 'part', 'purchased', 'stk', null, 10, 'Skuff 3');
  insert into public.stock_items (id, item_number, name, category, supply, product_id, location)
  values ('0d000000-0000-4000-8000-000000000084', 'DEMO-F-4ML', 'Demo: ' || p4.name, 'finished', 'assembled', p4.id, 'Ferdigvarelager');

  insert into public.product_components (product_id, item_id, qty)
  values (p4.id, '0d000000-0000-4000-8000-000000000081', 13), (p4.id, '0d000000-0000-4000-8000-000000000082', 8.5), (p4.id, '0d000000-0000-4000-8000-000000000083', 2);

  insert into public.stock_movements (item_id, quantity, kind, note, occurred_on, created_by_name)
  values
    ('0d000000-0000-4000-8000-000000000081', 120, 'receipt', 'Demo: varemottak', current_date - 40, 'Demo'),
    ('0d000000-0000-4000-8000-000000000082', 200, 'receipt', 'Demo: varemottak', current_date - 40, 'Demo'),
    ('0d000000-0000-4000-8000-000000000083', 8, 'receipt', 'Demo: varemottak', current_date - 40, 'Demo'),
    ('0d000000-0000-4000-8000-000000000081', -26, 'production_out', 'Demo: to leidere montert', current_date - 20, 'Demo'),
    ('0d000000-0000-4000-8000-000000000082', -17, 'production_out', 'Demo: to leidere montert', current_date - 20, 'Demo'),
    ('0d000000-0000-4000-8000-000000000083', -4, 'production_out', 'Demo: to leidere montert', current_date - 20, 'Demo'),
    ('0d000000-0000-4000-8000-000000000084', 2, 'production_in', 'Demo: to leidere montert', current_date - 20, 'Demo'),
    ('0d000000-0000-4000-8000-000000000081', -6, 'sale', 'Demo: reservedeler solgt', current_date - 10, 'Demo'),
    ('0d000000-0000-4000-8000-000000000084', -1, 'sale', 'Demo: levert til kunde', current_date - 5, 'Demo'),
    ('0d000000-0000-4000-8000-000000000082', -1.5, 'scrap', 'Demo: skadet kveil', current_date - 3, 'Demo');

  insert into public.purchase_orders (id, supplier_id, kind, ordered_on, expected_on, reference)
  values ('0d000000-0000-4000-8000-000000000091', '0d000000-0000-4000-8000-000000000071', 'purchase', current_date - 7, current_date + 7, 'DT-1042');
  insert into public.purchase_order_lines (purchase_order_id, item_id, qty_ordered)
  values ('0d000000-0000-4000-8000-000000000091', '0d000000-0000-4000-8000-000000000082', 300), ('0d000000-0000-4000-8000-000000000091', '0d000000-0000-4000-8000-000000000083', 50);

  raise notice 'Demodata for lageret lagt inn.';
end $$;
