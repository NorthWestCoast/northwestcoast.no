import { getPriceTable } from '@/lib/catalog';
import { llmsFullTxt } from '@/lib/llms';

/**
 * llms-full.txt: all teksten bak /llms.txt, på norsk og engelsk, slik at
 * AI-assistenter kan sitere nettstedet uten å måtte lese hver side. Bygges i
 * lib/llms.ts av ordbøkene, FAQ-en og prislista.
 */
// Prisene hentes fra prislista i databasen; bygges på nytt når admin lagrer.
export const revalidate = 3600;

export async function GET() {
  const table = await getPriceTable();
  return new Response(llmsFullTxt(table), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
