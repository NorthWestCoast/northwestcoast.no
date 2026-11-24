import Link from 'next/link';
import { requireMedia } from '@/lib/portal/context';
import { Alert, Badge, Card, Empty, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import FaqFields from '@/components/admin/faq-fields';
import { FAQ_FRONT_PAGE } from '@/lib/faq';
import { getDict } from '@/lib/i18n';
import { createFaqItem, deleteFaqItem, moveFaqItem, setFaqPublished } from './actions';

/** Spørsmål og svar på /faq og forsiden. */
export default async function FaqAdminPage({ searchParams }: { searchParams: Promise<{ slettet?: string }> }) {
  const { slettet } = await searchParams;
  const { supabase } = await requireMedia('/admin/faq');

  const { data: items, error } = await supabase
    .from('faq_items')
    .select('id, category, question_no, answer_no, question_en, answer_en, published, sort_order')
    .order('sort_order')
    .order('created_at')
    .limit(500);

  const list = items ?? [];
  const categories = getDict('no').faq.categories as Record<string, string>;
  // Plassen på forsiden: de fire første som er publisert.
  const frontPage = new Set(list.filter((item) => item.published).slice(0, FAQ_FRONT_PAGE).map((item) => item.id));

  return (
    <>
      <PageHeader
        title="Spørsmål og svar"
        description={`Spørsmålene på /faq, i denne rekkefølgen. De ${FAQ_FRONT_PAGE} første som er publisert, vises også på forsiden.`}
      />

      {slettet && <Alert tone="ok" title="Spørsmålet er slettet" />}
      {error && <Alert tone="danger" title="Kunne ikke lese spørsmålene">Last siden på nytt. Ingenting er endret.</Alert>}

      <Card title={`Spørsmål (${list.length})`} flush>
        {list.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Spørsmål</th><th>Kategori</th><th>Status</th><th>Rekkefølge</th><th /></tr>
            </thead>
            <tbody>
              {list.map((item, index) => {
                const edit = `/admin/faq/${item.id}`;
                return (
                  <tr key={item.id}>
                    <Td label="Spørsmål" className="pt-table-strong">
                      <span>
                        <Link href={edit}>{item.question_no}</Link>
                        <span className="pt-muted pt-faq-answer">{item.answer_no}</span>
                      </span>
                    </Td>
                    <Td label="Kategori" className="pt-nowrap">{categories[item.category] ?? item.category}</Td>
                    <Td label="Status">
                      <span className="pt-actions">
                        {item.published ? <Badge tone="ok">Publisert</Badge> : <Badge>Skjult</Badge>}
                        {frontPage.has(item.id) && <Badge tone="info">Forsiden</Badge>}
                        {!(item.question_en && item.answer_en) && <Badge tone="warn">Mangler engelsk</Badge>}
                      </span>
                    </Td>
                    <Td label="Rekkefølge">
                      <div className="pt-actions">
                        {index > 0 && (
                          <ActionButton action={moveFaqItem} fields={{ faq_id: item.id, direction: 'up' }} label="Flytt opp" />
                        )}
                        {index < list.length - 1 && (
                          <ActionButton action={moveFaqItem} fields={{ faq_id: item.id, direction: 'down' }} label="Flytt ned" />
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="pt-actions">
                        <ActionButton
                          action={setFaqPublished}
                          fields={{ faq_id: item.id, published: item.published ? 'false' : 'true' }}
                          label={item.published ? 'Skjul' : 'Publiser'}
                        />
                        <Link href={edit} className="pt-btn pt-btn-ghost pt-btn-sm">Endre</Link>
                        <ActionButton
                          action={deleteFaqItem}
                          fields={{ faq_id: item.id }}
                          label="Slett"
                          tone="danger"
                          confirm={`Slette «${item.question_no}»? Det kan ikke angres.`}
                        />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen spørsmål ennå">Legg til det første under.</Empty>
        )}
      </Card>

      <Card title="Nytt spørsmål" description="Havner nederst i lista. Flytt det opp etterpå om det skal stå tidligere.">
        <PortalForm action={createFaqItem} submitLabel="Legg til spørsmålet">
          <FaqFields scope="ny" />
        </PortalForm>
      </Card>
    </>
  );
}
