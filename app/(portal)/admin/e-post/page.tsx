import { requireStaff } from '@/lib/supabase/staff';
import { Card, PageHeader } from '@/components/portal/ui';
import { mailPreviews, type MailPreview } from '@/lib/mail/previews';
import { sender } from '@/lib/mail/config';

export const metadata = { title: 'E-post' };

/**
 * Forhåndsvisning av alle e-postene nettstedet sender, med eksempeldata.
 * Ingenting sendes herfra. Tekstene endres i lib/mail/templates.ts
 * (innlogging: lib/mail/auth-templates.ts).
 */
export default async function EpostPage() {
  await requireStaff();

  const previews = mailPreviews();
  const groups = [...new Set(previews.map((preview) => preview.group))];
  const configured = Boolean(process.env.RESEND_API_KEY);

  return (
    <>
      <PageHeader
        title="E-post"
        description="Slik ser e-postene fra nettstedet ut. Dataene er eksempler, og ingenting sendes herfra."
      />

      <Card title="Avsender">
        <p>
          E-postene sendes fra <strong>{sender()}</strong>. Svar går til postkassen som behandler saken,
          ikke til avsenderadressen.
        </p>
        {!configured && (
          <p>
            Utsending er ikke satt opp i dette miljøet (mangler RESEND_API_KEY), så bestillinger og henvendelser
            lagres og varsles i portalen, men ingen får e-post.
          </p>
        )}
      </Card>

      {groups.map((group) => (
        <section key={group}>
          <h2 className="pt-section-title" style={{ margin: '2rem 0 0.75rem' }}>{group}</h2>
          {previews.filter((preview) => preview.group === group).map((preview) => (
            <Preview key={preview.id} preview={preview} />
          ))}
        </section>
      ))}
    </>
  );
}

function Preview({ preview }: { preview: MailPreview }) {
  return (
    <Card id={preview.id} title={preview.name} description={preview.when}>
      <p style={{ margin: '0 0 0.25rem' }}><strong>Til:</strong> {preview.to}</p>
      <p style={{ margin: '0 0 0.75rem' }}><strong>Emne:</strong> {preview.subject}</p>
      {/* sandbox uten tillatelser: e-posten vises, men kan verken kjøre skript
          eller navigere siden rundt seg. */}
      <iframe
        title={`Forhåndsvisning: ${preview.name}`}
        srcDoc={preview.html}
        sandbox=""
        loading="lazy"
        style={{ width: '100%', height: 620, border: '1px solid #d9d4ca', borderRadius: 3, background: '#f2ece4' }}
      />
    </Card>
  );
}
