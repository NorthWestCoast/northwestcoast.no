'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import type { ChecklistKind, PrintSheet, SheetLabels } from '@/lib/maintenance-checklists';

/**
 * Skjemaene for utskrift (før bruk, etter bruk, kvartalsvis).
 *
 * Arkene legges rett under <body>, så utskriftsstilen (.cl-print i
 * globals.css) kan skjule alt annet på siden, uansett hvor dypt komponenten
 * står. På skjerm er de skjult.
 *
 * - printSheet(kind) skriver ut ett skjema, printSheet('all') alle tre.
 * - Med `printByDefault` gir vanlig utskrift (Ctrl+P) alle tre skjemaene i
 *   stedet for siden. Brukes på veiledningssiden.
 * - Med `inline` tegnes arkene der komponenten står, også i HTML-en fra
 *   serveren. Bare for sider der komponenten står rett under <body> (sidene
 *   på nettstedet). Ellers flyttes de dit etter at siden har lastet.
 */
export function printSheet(kind: ChecklistKind | 'all') {
  const root = document.documentElement;
  if (kind === 'all') delete root.dataset.printSheet;
  else root.dataset.printSheet = kind;
  root.dataset.printing = 'sheets';

  const done = () => {
    delete root.dataset.printSheet;
    delete root.dataset.printing;
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

export function PrintSheetButton({
  kind,
  label,
  className = 'btn-primary',
}: {
  kind: ChecklistKind | 'all';
  label: string;
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={() => printSheet(kind)}>
      <Printer size={15} strokeWidth={1.8} aria-hidden="true" />
      {label}
    </button>
  );
}

export default function ChecklistPrint({
  sheets,
  labels,
  prefill,
  printByDefault = false,
  inline = false,
}: {
  sheets: PrintSheet[];
  labels: SheetLabels;
  /** Fartøy og serienummer som skrives inn på forhånd, når leideren er kjent. */
  prefill?: { vessel?: string | null; serial?: string | null };
  printByDefault?: boolean;
  inline?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sheetsMarkup = (
    <div className="cl-print" data-default={printByDefault ? 'true' : undefined} aria-hidden="true">
      {sheets.map((sheet) => (
        <section className="cl-sheet" data-sheet={sheet.kind} key={sheet.kind}>
          <div className="cl-sheet-brand">{labels.brand}</div>
          <h1>{sheet.title}</h1>
          <div className="cl-sheet-fields">
            <div><span>{labels.vessel}</span><strong>{prefill?.vessel ?? ''}</strong></div>
            <div><span>{labels.serial}</span><strong>{prefill?.serial ?? ''}</strong></div>
            <div><span>{labels.date}</span></div>
            <div><span>{labels.by}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>{labels.item}</th>
                <th>{labels.ok}</th>
                <th>{labels.deviation}</th>
              </tr>
            </thead>
            <tbody>
              {sheet.items.map((item) => (
                <tr key={item}>
                  <td>{item}</td>
                  <td className="box" />
                  <td className="box" />
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cl-sheet-remarks"><span>{labels.remarks}</span></div>
          <div className="cl-sheet-sign"><span>{labels.signature}</span></div>
          <p className="cl-sheet-footer">{labels.footer}</p>
        </section>
      ))}
    </div>
  );

  if (inline) return sheetsMarkup;
  if (!mounted) return null;
  return createPortal(sheetsMarkup, document.body);
}
