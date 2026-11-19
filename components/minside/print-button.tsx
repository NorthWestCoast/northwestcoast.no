'use client';

/** «Skriv ut»-knapp. Skjules selv på utskriften. */
export default function PrintButton({ label = 'Skriv ut' }: { label?: string }) {
  return (
    <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm pt-no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
