import { Input, Select, Textarea } from './fields';
import { idag } from '@/lib/format';

/**
 * Feltene i en servicerapport (action: recordService). Leideren velges av
 * skjemaet rundt, enten med et skjult felt eller en nedtrekksliste.
 */
export default function ServiceFields({ scope, performedBy }: { scope: string; performedBy: string }) {
  return (
    <>
      <div className="pt-form-row">
        <Input scope={scope} name="performed_at" label="Utført dato" type="date" required defaultValue={idag()} max={idag()} />
        <Input scope={scope} name="performed_by" label="Utført av" required maxLength={120} defaultValue={performedBy} />
      </div>
      <div className="pt-form-row">
        <Select scope={scope} name="result" label="Resultat" required defaultValue="ok">
          <option value="ok">Godkjent</option>
          <option value="ok_with_remarks">Godkjent med anmerkning</option>
          <option value="failed">Ikke godkjent</option>
        </Select>
        <Input
          scope={scope}
          name="next_service_due"
          label="Neste frist"
          type="date"
          hint="Tom: beregnes fra leiderens serviceintervall."
        />
      </div>
      <Textarea
        scope={scope}
        name="findings"
        label="Funn"
        rows={4}
        maxLength={4000}
        placeholder="Tilstand, utskiftede deler, avvik."
      />
    </>
  );
}
