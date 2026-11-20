import Link from 'next/link';
import { Badge, Empty, Td } from '@/components/portal/ui';
import { movementKind } from '@/lib/portal/labels';
import { fmtQty } from '@/lib/stock';
import { dato } from '@/lib/format';
import { type Movement, type Usage, qtyOrDash, signedQty } from './data';

/**
 * Det som har skjedd med en vare: lista over bevegelser, og forbruket
 * fordelt på hva varen har gått til.
 */

/**
 * Bevegelsene på en vare, nyeste først. Med `adminLinks` lenkes det til
 * bestillingen og innkjøpet bevegelsen hører til. Produksjon får bare lenke
 * til jobben, som ligger i deres eget område.
 */
export function MovementList({
  movements,
  unit,
  adminLinks = false,
}: {
  movements: Movement[];
  unit: string;
  adminLinks?: boolean;
}) {
  if (movements.length === 0) {
    return <Empty title="Ingen bevegelser ennå">Varemottak, forbruk og tellinger vises her etter hvert som de føres.</Empty>;
  }

  return (
    <table className="pt-table">
      <thead>
        <tr><th>Dato</th><th>Hva</th><th className="pt-num">Mengde</th><th>Registrert av</th><th>Notat</th></tr>
      </thead>
      <tbody>
        {movements.map((movement) => {
          const kind = movementKind(movement.kind);
          const links = [
            movement.job_id ? { href: `/produksjon/${movement.job_id}`, label: 'Åpne jobben' } : null,
            adminLinks && movement.order_id
              ? { href: `/admin/bestillinger/${movement.order_id}`, label: 'Åpne bestillingen' }
              : null,
            adminLinks && movement.purchase_order_id
              ? { href: `/admin/lager/innkjop/${movement.purchase_order_id}`, label: 'Åpne innkjøpet' }
              : null,
          ].filter((link) => link !== null);

          return (
            <tr key={movement.id}>
              <Td label="Dato" className="pt-nowrap">{dato(movement.occurred_on)}</Td>
              <Td label="Hva"><div><Badge tone={kind.tone}>{kind.label}</Badge></div></Td>
              <Td label="Mengde" className="pt-num pt-table-strong">{signedQty(movement.quantity, unit)}</Td>
              <Td label="Registrert av">{movement.created_by_name ?? 'Systemet'}</Td>
              <Td label="Notat">
                <div>
                  {movement.note ?? (links.length === 0 ? '–' : null)}
                  {links.map((link) => (
                    <div key={link.href}><Link href={link.href}>{link.label}</Link></div>
                  ))}
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Forbruket av én vare i to perioder side om side: først det som kom inn,
 * så det som gikk ut. Det som gikk til produksjon og det som ble solgt
 * direkte er uthevet: det er skillet lageret er satt opp for å vise.
 */
export function UsageBlock({
  unit,
  periods,
}: {
  unit: string;
  /** Periodene som skal stå ved siden av hverandre, med hver sin overskrift. */
  periods: { label: string; usage: Usage }[];
}) {
  const any = (pick: (usage: Usage) => number) => periods.some((period) => pick(period.usage) !== 0);

  const rows: { label: string; strong?: boolean; value: (usage: Usage) => string }[] = [
    { label: 'Mottatt', value: (usage) => qtyOrDash(usage.received, unit) },
    // Bare ferdigvarer monteres inn på lager. For en del ville raden alltid stått tom.
    ...(any((usage) => usage.produced)
      ? [{ label: 'Ferdig montert', value: (usage: Usage) => qtyOrDash(usage.produced, unit) }]
      : []),
    { label: 'Brukt i produksjon', strong: true, value: (usage) => fmtQty(usage.used_in_production, unit) },
    { label: 'Solgt direkte', strong: true, value: (usage) => fmtQty(usage.sold, unit) },
    { label: 'Svinn', value: (usage) => qtyOrDash(usage.scrapped, unit) },
    { label: 'Retur fra kunde', value: (usage) => qtyOrDash(usage.returned, unit) },
    { label: 'Justert ved telling', value: (usage) => (usage.adjusted === 0 ? '–' : signedQty(usage.adjusted, unit)) },
  ];

  return (
    <table className="pt-table">
      <thead>
        <tr>
          <th />
          {periods.map((period) => <th key={period.label} className="pt-num">{period.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <Td className={row.strong ? 'pt-table-strong' : undefined}>{row.label}</Td>
            {periods.map((period) => (
              <Td key={period.label} label={period.label} className={row.strong ? 'pt-num pt-table-strong' : 'pt-num'}>
                {row.value(period.usage)}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
