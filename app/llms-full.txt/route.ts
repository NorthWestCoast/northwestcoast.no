import { getPriceTable } from '@/lib/catalog';
import { getLlmsContent, llmsFullTxt } from '@/lib/llms';

/**
 * llms-full.txt: all teksten bak /llms.txt, på norsk og engelsk, slik at
 * AI-assistenter kan sitere nettstedet uten å måtte lese hver side. Bygges i
 * lib/llms.ts av ordbøkene, FAQ-en og prislista.
 */
// Prisene, nyhetene og spørsmålene hentes fra databasen; bygges på nytt når admin lagrer.
export const revalidate = 3600;

export async function GET() {
  const [table, content] = await Promise.all([getPriceTable(), getLlmsContent()]);
  return new Response(llmsFullTxt(table, content), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
