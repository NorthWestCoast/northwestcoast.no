import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, rateLimit } from '@/lib/api-guard';
import { createServiceSupabase, hasServiceRole } from '@/lib/supabase/server';
import { CONTACT_EMAIL, SUPPORT_PHONE, sendMail } from '@/lib/mail';
import { contactInternal } from '@/lib/mail/templates';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`contact:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: `For mange forespørsler. Prøv igjen om noen minutter, eller ring ${SUPPORT_PHONE}.` },
      { status: 429 },
    );
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const phone = clean(body.phone, 40);
  const company = clean(body.company, 160);
  const product = clean(body.product, 120);
  const message = clean(body.message, 4000);

  if (!name || !email) {
    return NextResponse.json({ error: 'Navn og e-post er påkrevd' }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: 'E-postadressen ser ikke gyldig ut.' }, { status: 400 });
  }

  // Lagre først. En henvendelse som ligger i databasen er ikke tapt selv om
  // e-postleverandøren er nede.
  let requestId: string | undefined;
  let stored = false;

  if (hasServiceRole()) {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from('contact_requests')
      .insert({
        name,
        email,
        phone: phone || null,
        company_name: company || null,
        product: product || null,
        message: message || null,
        source: 'web',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[contact] Kunne ikke lagre henvendelse:', error);
    } else {
      stored = true;
      requestId = data.id;
    }
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
      { error: `Vi klarte ikke å sende meldingen nå. Ring oss på ${SUPPORT_PHONE}.` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
