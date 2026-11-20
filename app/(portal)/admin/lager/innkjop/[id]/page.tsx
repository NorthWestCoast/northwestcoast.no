import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { uuid } from '@/lib/portal/forms';
import { Alert, Badge, Card, KV, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Hidden, Input, Select, Textarea } from '@/components/admin/fields';
import { itemLabel, loadStockRows } from '@/components/lager/data';
import { PURCHASE_KIND, purchaseStatus } from '@/lib/portal/labels';
import { fmtQty, num } from '@/lib/stock';
import { dato, idag } from '@/lib/format';
import { addLine, cancelPurchase, receiveLine, removeLine, updateLine, updatePurchase } from '../actions';

export const metadata: Metadata = { title: 'Innkjøp' };

/** Tall til et skjemafelt: uten tusenskille, med norsk komma. */
const fieldQty = (value: number) => String(Math.round(value * 1000) / 1000).replace('.', ',');

/**
 * Ett innkjøp: hodet, linjene med bestilt, mottatt og gjenstående, og
 * varemottak per linje. Et mottak kan gjøres i flere omganger; innkjøpet
 * settes som mottatt av databasen når alle linjene er kommet.
 */
export default async function InnkjopDetaljPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase } = await requireStaff();

  const [{ data: order }, { data: lineRows }] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select('id, po_number, kind, status, ordered_on, expected_on, reference, notes, created_at, suppliers(name, contact_name, email, phone)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('purchase_order_lines')
      .select('id, item_id, qty_ordered, qty_received, note, stock_items(item_number, name, unit)')
      .eq('purchase_order_id', id),
  ]);
  if (!order) notFound();

  const lines = (lineRows ?? [])
    .map((line) => {
      const ordered = num(line.qty_ordered);
      const received = num(line.qty_received);
      return {
        id: line.id,
        itemId: line.item_id,
        number: line.stock_items?.item_number ?? 'Ukjent vare',
        name: line.stock_items?.name ?? '',
        unit: line.stock_items?.unit ?? 'stk',
        note: line.note,
        ordered,
        received,
        remaining: Math.max(Math.round((ordered - received) * 1000) / 1000, 0),
        over: Math.max(Math.round((received - ordered) * 1000) / 1000, 0),
      };
    })
    .sort((a, b) => a.number.localeCompare(b.number, 'nb'));

  const open = order.status === 'ordered';
  const today = idag();
  const late = open && order.expected_on !== null && order.expected_on < today;
  const status = purchaseStatus(order.status);
  const complete = lines.filter((line) => line.remaining === 0).length;
  const anyReceived = lines.some((line) => line.received > 0);

  const lineIds = lines.map((line) => line.id);
  const [{ data: receipts }, stock] = await Promise.all([
    lineIds.length > 0
      ? supabase
          .from('stock_movements')
          .select('id, purchase_line_id, quantity, note, occurred_on, created_by_name, created_at')
          .in('purchase_line_id', lineIds)
          .eq('kind', 'receipt')
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] }),
    // Varene trengs bare til «Legg til linje», som finnes mens innkjøpet er åpent.
    open ? loadStockRows(supabase) : Promise.resolve([]),
  ]);

  const lineById = new Map(lines.map((line) => [line.id, line]));
  const onOrder = new Set(lines.map((line) => line.itemId));
  const addable = stock.filter((item) => item.active && !onOrder.has(item.id));
  const supplier = order.suppliers;
  const contact = [supplier?.contact_name, supplier?.email, supplier?.phone].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        title={`Innkjøp ${order.po_number}`}
        description={[supplier?.name, PURCHASE_KIND[order.kind] ?? order.kind].filter(Boolean).join(' · ')}
        crumbs={[
          { href: '/admin/lager', label: 'Lager' },
          { href: '/admin/lager/innkjop', label: 'Innkjøp' },
          { label: order.po_number },
        ]}
        badge={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            {late && <Badge tone="danger">Forsinket</Badge>}
          </>
        }
      />

      {order.status === 'cancelled' && (
        <Alert tone="info" title="Innkjøpet er kansellert">
          {anyReceived
            ? 'Det som ble mottatt før kanselleringen, står fortsatt på lager. Resten teller ikke lenger som bestilt.'
            : 'Ingenting ble mottatt, og linjene teller ikke lenger som bestilt.'}
        </Alert>
      )}

      <Card title="Innkjøpet">
        <KV
          items={[
            { label: 'Leverandør', value: supplier?.name ?? 'Ikke oppgitt' },
            { label: 'Kontakt', value: contact || '–' },
            { label: 'Type', value: PURCHASE_KIND[order.kind] ?? order.kind },
            { label: 'Leverandørens referanse', value: order.reference ?? '–' },
            { label: 'Bestilt', value: dato(order.ordered_on) },
            {
              label: 'Ventet',
              value: order.expected_on
                ? <>{dato(order.expected_on)}{late && <span className="pt-muted"> (ikke kommet)</span>}</>
                : 'Ikke oppgitt',
            },
            { label: 'Mottatt', value: `${complete} av ${lines.length} ${lines.length === 1 ? 'linje' : 'linjer'}` },
            { label: 'Status', value: status.label },
          ]}
        />
        {order.notes && (
          <dl className="pt-kv" style={{ gridTemplateColumns: '1fr', marginTop: '0.9rem' }}>
            <div>
              <dt>Notat</dt>
              <dd style={{ whiteSpace: 'pre-line' }}>{order.notes}</dd>
            </div>
          </dl>
        )}

        {open && (
          <details className="pt-more" style={{ marginTop: '1rem' }}>
            <summary>Endre ventet dato, referanse og notat</summary>
            <PortalForm action={updatePurchase} submitLabel="Lagre" resetOnSuccess={false}>
              <Hidden fields={{ order_id: order.id }} />
              <div className="pt-form-row">
                <Input
                  scope="order"
                  name="expected_on"
                  label="Ventet dato"
                  type="date"
                  min={order.ordered_on}
                  defaultValue={order.expected_on ?? ''}
                />
                <Input
                  scope="order"
                  name="reference"
                  label="Leverandørens referanse"
                  maxLength={120}
                  autoComplete="off"
                  defaultValue={order.reference ?? ''}
                />
              </div>
              <Textarea scope="order" name="notes" label="Notat" rows={2} maxLength={2000} defaultValue={order.notes ?? ''} />
            </PortalForm>
          </details>
        )}
      </Card>

      <Card
        title={`Linjer (${lines.length})`}
        description={
          open
            ? 'Registrer det som er kommet på hver linje. Kommer varene i flere sendinger, registrerer du hver sending for seg.'
            : undefined
        }
      >
        <div className="pt-records">
          {lines.map((line) => {
            const state =
              line.remaining === 0
                ? { tone: 'ok' as const, label: 'Mottatt' }
                : line.received > 0
                  ? { tone: 'warn' as const, label: 'Delvis mottatt' }
                  : { tone: 'neutral' as const, label: order.status === 'cancelled' ? 'Ikke mottatt' : 'Venter' };
            const editable = open && line.received === 0;

            return (
              <div key={line.id} className="pt-record">
                <div className="pt-record-head">
                  <Link href={`/admin/lager/${line.itemId}`} className="pt-link pt-mono">{line.number}</Link>
                  <strong>{line.name}</strong>
                  <Badge tone={state.tone}>{state.label}</Badge>
                </div>

                <KV
                  items={[
                    { label: 'Bestilt', value: fmtQty(line.ordered, line.unit) },
                    {
                      label: 'Mottatt',
                      value: line.over > 0
                        ? `${fmtQty(line.received, line.unit)} (${fmtQty(line.over, line.unit)} mer enn bestilt)`
                        : fmtQty(line.received, line.unit),
                    },
                    // Etter en kansellering kommer ikke resten: da er det ikke noe som «gjenstår».
                    {
                      label: order.status === 'cancelled' ? 'Ikke levert' : 'Gjenstår',
                      value: fmtQty(line.remaining, line.unit),
                    },
                    { label: 'Notat', value: line.note ?? '–' },
                  ]}
                />

                {open && line.remaining > 0 && (
                  <PortalForm action={receiveLine} submitLabel="Registrer mottak" pendingLabel="Registrerer…" tone="green">
                    <Hidden fields={{ line_id: line.id }} />
                    <div className="pt-form-row pt-form-row-3">
                      <Input
                        scope={line.id}
                        name="qty"
                        label={`Mottatt nå (${line.unit})`}
                        inputMode="decimal"
                        maxLength={14}
                        autoComplete="off"
                        defaultValue={fieldQty(line.remaining)}
                        required
                      />
                      <Input
                        scope={line.id}
                        name="received_on"
                        label="Mottatt dato"
                        type="date"
                        max={today}
                        defaultValue={today}
                        required
                      />
                      <Input scope={line.id} name="note" label="Notat (valgfritt)" maxLength={500} autoComplete="off" />
                    </div>
                  </PortalForm>
                )}

                {editable && (
                  <details className="pt-more">
                    <summary>Endre eller fjern linja</summary>
                    <div className="pt-form">
                      <PortalForm action={updateLine} submitLabel="Lagre linja" resetOnSuccess={false}>
                        <Hidden fields={{ line_id: line.id }} />
                        <div className="pt-form-row">
                          <Input
                            scope={`edit-${line.id}`}
                            name="qty_ordered"
                            label={`Bestilt mengde (${line.unit})`}
                            inputMode="decimal"
                            maxLength={14}
                            autoComplete="off"
                            defaultValue={fieldQty(line.ordered)}
                            required
                          />
                          <Input
                            scope={`edit-${line.id}`}
                            name="note"
                            label="Notat (valgfritt)"
                            maxLength={500}
                            autoComplete="off"
                            defaultValue={line.note ?? ''}
                          />
                        </div>
                      </PortalForm>
                      <div>
                        <ActionButton
                          action={removeLine}
                          fields={{ line_id: line.id }}
                          label="Fjern linja"
                          pendingLabel="Fjerner…"
                          tone="danger"
                          confirm={`Fjerne ${line.number} fra innkjøpet?`}
                        />
                      </div>
                    </div>
                  </details>
                )}
              </div>
            );
          })}

          {open && (
            <details className="pt-more">
              <summary>Legg til linje</summary>
              {addable.length > 0 ? (
                <PortalForm action={addLine} submitLabel="Legg til linje">
                  <Hidden fields={{ order_id: order.id }} />
                  <div className="pt-form-row pt-form-row-3">
                    <Select scope="add" name="item" label="Vare" required defaultValue="">
                      <option value="" disabled>Velg vare</option>
                      {addable.map((item) => <option key={item.id} value={item.id}>{itemLabel(item)}</option>)}
                    </Select>
                    <Input scope="add" name="qty" label="Mengde" inputMode="decimal" maxLength={14} autoComplete="off" required />
                    <Input scope="add" name="note" label="Notat (valgfritt)" maxLength={500} autoComplete="off" />
                  </div>
                </PortalForm>
              ) : (
                <p className="pt-hint">Alle aktive varer står allerede på innkjøpet.</p>
              )}
            </details>
          )}
        </div>
      </Card>

      {(receipts ?? []).length > 0 && (
        <Card title="Mottak" description="Hvert mottak er ført som en bevegelse på varen." flush>
          <table className="pt-table">
            <thead>
              <tr><th>Dato</th><th>Vare</th><th className="pt-num">Mengde</th><th>Notat</th><th>Registrert av</th></tr>
            </thead>
            <tbody>
              {(receipts ?? []).map((receipt) => {
                const line = receipt.purchase_line_id ? lineById.get(receipt.purchase_line_id) : undefined;
                return (
                  <tr key={receipt.id}>
                    <Td label="Dato" className="pt-nowrap">{dato(receipt.occurred_on)}</Td>
                    <Td label="Vare"><span className="pt-mono">{line?.number ?? '–'}</span></Td>
                    <Td label="Mengde" className="pt-num">{fmtQty(receipt.quantity, line?.unit)}</Td>
                    <Td label="Notat">{receipt.note ?? '–'}</Td>
                    <Td label="Registrert av">{receipt.created_by_name ?? '–'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {open && (
        <Card
          title="Kanseller innkjøpet"
          description={
            anyReceived
              ? 'Brukes når resten ikke kommer. Det som alt er mottatt, blir stående på lager; bare det som gjenstår slutter å telle som bestilt.'
              : 'Brukes når bestillingen er trukket tilbake. Linjene slutter å telle som bestilt.'
          }
        >
          <ActionButton
            action={cancelPurchase}
            fields={{ order_id: order.id }}
            label="Kanseller innkjøpet"
            pendingLabel="Kansellerer…"
            tone="danger"
            size="md"
            confirm={`Kansellere innkjøp ${order.po_number}? Dette kan ikke angres.`}
          />
        </Card>
      )}
    </>
  );
}
