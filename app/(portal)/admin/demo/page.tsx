import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/portal/context';
import { Card, PageHeader } from '@/components/portal/ui';
import { DEMO_HOURS, DEMO_START, DEMO_STOP } from '@/lib/portal/demo';

export const metadata: Metadata = { title: 'Demovisning' };

/**
 * Slår demovisningen av og på (lib/portal/demo.ts). Demodataene ligger i
 * databasen hele tiden, men vises bare her: ellers er de usynlige i alle
 * lister, tellinger og kalendere.
 */
export default async function DemoPage() {
  const { ctx } = await requireAdmin('/admin/demo');

  return (
    <>
      <PageHeader
        title="Demovisning"
        description="Vis kunder hvordan portalen ser ut, med fiktive data i stedet for de ekte kundene."
      />

      {ctx.demo ? (
        <Card
          title="Demovisningen er på"
          description="Portalen viser bare demodataene til du avslutter. Ingenting kan endres så lenge den er på."
        >
          <div className="pt-demo-actions">
            <Link href="/minside" className="pt-btn">Gå til Min side</Link>
            <Link href="/admin" className="pt-btn pt-btn-ghost">Gå til admin</Link>
            <form action={DEMO_STOP} method="post">
              <button type="submit" className="pt-btn pt-btn-ghost">Avslutt demo</button>
            </form>
          </div>
        </Card>
      ) : (
        <Card title="Start demovisning">
          <div className="pt-demo-intro">
            <p>
              Hele portalen bytter til demodataene: Demo Rederi AS med to fartøy, fire leidere,
              vedlikeholdshistorikk, faste kontroller, serviceavtale, bestillinger og en sak.
              De ekte kundene vises ikke så lenge demovisningen er på.
            </p>
            <ul>
              <li>Min side viser det en kunde ser: oversikt, kalender, leidere og bestillinger.</li>
              <li>Admin viser de samme dataene fra vår side.</li>
              <li>Ingenting kan endres. Skjemaene kan åpnes, men ikke sendes.</li>
              <li>
                En gul stripe øverst viser at demovisningen er på. Den slås av med knappen der,
                når du logger ut, eller av seg selv etter {DEMO_HOURS} timer.
              </li>
            </ul>
          </div>
          <div className="pt-demo-actions">
            <form action={DEMO_START} method="post">
              <input type="hidden" name="til" value="/minside" />
              <button type="submit" className="pt-btn">Åpne Min side som kunde</button>
            </form>
            <form action={DEMO_START} method="post">
              <input type="hidden" name="til" value="/admin" />
              <button type="submit" className="pt-btn pt-btn-ghost">Åpne admin med demodata</button>
            </form>
          </div>
        </Card>
      )}
    </>
  );
}
