import { getPriceTable } from '@/lib/catalog';
import { getLlmsContent, llmsTxt } from '@/lib/llms';

/**
 * llms.txt: en kort, lesbar oversikt for AI-assistenter (llmstxt.org), med
 * lenker til de viktigste sidene på begge språk. Teksten bygges i lib/llms.ts
 * av det som allerede står i ordbøkene og prislista.
 */
// Prisene, nyhetene og spørsmålene hentes fra databasen; bygges på nytt når admin lagrer.
export const revalidate = 3600;

export async function GET() {
  const [table, content] = await Promise.all([getPriceTable(), getLlmsContent()]);
  return new Response(llmsTxt(table, content), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
