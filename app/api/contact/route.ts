import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, langOf, line, rateLimit, readBody, rejected, tr } from '@/lib/api-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { CONTACT_EMAIL, SUPPORT_PHONE, sendMail } from '@/lib/mail';
import { contactInternal, contactReceipt } from '@/lib/mail/templates';

export async function POST(req: NextRequest) {
  const body = await readBody(req);
  if (!body) return rejected();
  const lang = langOf(body);

  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`contact:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: tr(lang, `For mange forespørsler. Prøv igjen om noen minutter, eller ring ${SUPPORT_PHONE}.`, `Too many requests. Please try again in a few minutes, or call ${SUPPORT_PHONE}.`) },
      { status: 429 },
    );
  }

  const name = line(body.name, 120);
  const email = line(body.email, 160);
  const phone = line(body.phone, 40);
  const company = line(body.company, 160);
  const product = line(body.product, 120);
  const message = clean(body.message, 4000);

  if (!name || !email) {
    return NextResponse.json({ error: tr(lang, 'Navn og e-post er påkrevd', 'Name and email are required') }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: tr(lang, 'E-postadressen ser ikke gyldig ut.', 'The email address does not look valid.') }, { status: 400 });
  }

  // Lagre først. En henvendelse som ligger i databasen er ikke tapt selv om
  // e-postleverandøren er nede. Lagringen går gjennom submit_contact_request()
  // med besøkerens egen (anonyme) sesjon; funksjonen varsler også admin.
  let requestId: string | undefined;
  let stored = false;

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('submit_contact_request', {
      payload: { name, email, phone, company, product, message },
    });

    if (error?.code === 'P0001') {
      // Databasens egne avslag (for mange henvendelser, ugyldig e-post).
      return NextResponse.json(
        { error: tr(lang, error.message, `We could not send your message right now. Please try again later, or call us on ${SUPPORT_PHONE}.`) },
        { status: 400 },
      );
    }
    if (error) {
      console.error('[contact] Kunne ikke lagre henvendelse:', error.code, error.message);
    } else {
      stored = true;
      requestId = data ?? undefined;
    }
  } catch (error) {
    // Supabase er ikke konfigurert eller svarer ikke: e-posten under er reserven.
    console.error('[contact] Kunne ikke lagre henvendelse:', error);
  }

  const mail = contactInternal({ name, email, phone, company, product, message });
  const result = await sendMail(
    { to: CONTACT_EMAIL, replyTo: email, ...mail },
    { template: 'contact_internal', relatedType: 'contact_request', relatedId: requestId },
  );

  // Kun hvis BEGGE veier feilet er henvendelsen faktisk borte. Da skal
  // kunden få vite det, ikke en falsk kvittering.
  if (!stored && !result.ok) {
    return NextResponse.json(
      { error: tr(lang, `Vi klarte ikke å sende meldingen nå. Ring oss på ${SUPPORT_PHONE}.`, `We could not send your message right now. Please call us on ${SUPPORT_PHONE}.`) },
      { status: 502 },
    );
  }

  // Bekreftelsen til avsenderen sendes bare når henvendelsen faktisk ligger
  // lagret: da har databasens egne grenser (per adresse og totalt per time)
  // sluppet den gjennom, og skjemaet kan ikke brukes til å pepre en fremmed
  // adresse med e-post. Feiler bekreftelsen, er henvendelsen likevel mottatt.
  if (stored) {
    await sendMail(
      { to: email, replyTo: CONTACT_EMAIL, ...contactReceipt({ name, lang }) },
      { template: 'contact_receipt', relatedType: 'contact_request', relatedId: requestId },
    );
  }

  return NextResponse.json({ ok: true });
}
