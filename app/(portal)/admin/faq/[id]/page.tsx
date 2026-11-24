import { notFound } from 'next/navigation';
import { requireMedia } from '@/lib/portal/context';
import { uuid } from '@/lib/portal/forms';
import { Badge, Card, PageHeader } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Hidden } from '@/components/admin/fields';
import FaqFields from '@/components/admin/faq-fields';
import { datoTid } from '@/lib/format';
import { deleteFaqItem, updateFaqItem } from '../actions';

/** Ett spørsmål: tekst på norsk og engelsk, kategori og synlighet. */
export default async function FaqItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase } = await requireMedia(`/admin/faq/${id}`);

  const { data: item } = await supabase
    .from('faq_items')
    .select('id, category, question_no, answer_no, question_en, answer_en, published, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (!item) notFound();

  return (
    <>
      <PageHeader
        title="Endre spørsmål"
        crumbs={[{ href: '/admin/faq', label: 'Spørsmål og svar' }, { label: item.question_no }]}
        badge={item.published ? <Badge tone="ok">Publisert</Badge> : <Badge>Skjult</Badge>}
        description={`Sist endret ${datoTid(item.updated_at)}.`}
      />

      <Card>
        <PortalForm action={updateFaqItem} submitLabel="Lagre spørsmålet" resetOnSuccess={false}>
          <Hidden fields={{ faq_id: item.id }} />
          <FaqFields item={item} />
        </PortalForm>
      </Card>

      <Card title="Slett spørsmålet" description="Spørsmålet fjernes fra /faq og forsiden.">
        <ActionButton
          action={deleteFaqItem}
          fields={{ faq_id: item.id, back: 'true' }}
          label="Slett spørsmålet"
          tone="danger"
          size="md"
          confirm={`Slette «${item.question_no}»? Det kan ikke angres.`}
        />
      </Card>
    </>
  );
}
