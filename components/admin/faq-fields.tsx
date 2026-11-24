import { Check, Input, Select, Textarea } from './fields';
import { FAQ_CATEGORIES } from '@/lib/faq';
import { getDict } from '@/lib/i18n';

type Item = {
  category: string;
  question_no: string;
  answer_no: string;
  question_en: string | null;
  answer_en: string | null;
  published: boolean;
};

/** Feltene for ett spørsmål, brukt både for nye og eksisterende. */
export default function FaqFields({ item, scope }: { item?: Item; scope?: string }) {
  const labels = getDict('no').faq.categories;
  return (
    <>
      <Select name="category" label="Kategori" defaultValue={item?.category ?? 'product'} scope={scope}>
        {FAQ_CATEGORIES.map((category) => (
          <option key={category} value={category}>{labels[category]}</option>
        ))}
      </Select>
      <Input
        name="question_no"
        label="Spørsmål"
        required
        minLength={3}
        maxLength={300}
        defaultValue={item?.question_no ?? ''}
        scope={scope}
      />
      <Textarea
        name="answer_no"
        label="Svar"
        required
        rows={4}
        maxLength={4000}
        defaultValue={item?.answer_no ?? ''}
        hint="Blank linje gir nytt avsnitt. Skriv svaret så det står på egen hånd: Google og AI-søk kan vise det uten spørsmålet rundt."
        scope={scope}
      />
      <div className="pt-form-row">
        <Input
          name="question_en"
          label="Spørsmål (engelsk)"
          maxLength={300}
          defaultValue={item?.question_en ?? ''}
          scope={scope}
        />
        <Textarea
          name="answer_en"
          label="Svar (engelsk)"
          rows={3}
          maxLength={4000}
          defaultValue={item?.answer_en ?? ''}
          hint="Uten engelsk utgave vises det norske på den engelske siden."
          scope={scope}
        />
      </div>
      <Check name="published" label="Vis på nettsiden" defaultChecked={item?.published ?? true} />
    </>
  );
}
