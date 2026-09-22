import type { Metadata } from 'next';
import JsonLd from '@/components/json-ld';
import { faqSchema, graph } from '@/lib/structured-data';
import { pageMetadata } from '@/lib/site';

// /faq er en klientkomponent (søk + filtrering), så metadata og JSON-LD
// legges i denne layouten – der kan Next kjøre dem på serveren.
export const metadata: Metadata = pageMetadata({
  title: 'Ofte stilte spørsmål',
  description:
    'Svar på de vanligste spørsmålene om Argostep livbåtleider – sertifisering, lengder, materialer, montering, levering og reservedeler.',
  path: '/faq',
});

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={graph(faqSchema)} />
      {children}
    </>
  );
}
