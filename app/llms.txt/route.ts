import { getPriceTable } from '@/lib/catalog';
import { llmsTxt } from '@/lib/llms';

/**
 * llms.txt: en kort, lesbar oversikt for AI-assistenter (llmstxt.org), med
 * lenker til de viktigste sidene på begge språk. Teksten bygges i lib/llms.ts
 * av det som allerede står i ordbøkene og prislista.
 */
// Prisene hentes fra prislista i databasen; bygges på nytt når admin lagrer.
export const revalidate = 3600;

export async function GET() {
  const table = await getPriceTable();
  return new Response(llmsTxt(table), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
