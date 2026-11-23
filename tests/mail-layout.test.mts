import { readFileSync } from 'node:fs';
import { button, details, esc, html, link, oneLine, p, safeLabel, safeName, shell, unlink } from '../lib/mail/layout.ts';
import { AUTH_TEMPLATES } from '../lib/mail/auth-templates.ts';

let failed = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) { failed += 1; console.error(`FEILET: ${what}`); }
};
const ZW = String.fromCharCode(0x200b);

// Alt som settes inn escapes, også i attributter.
const evil = '<img src=x onerror=alert(1)>"\'&';
ok(!html`<p>${evil}</p>`.value.includes('<img'), 'html`` escaper tekst');
ok(html`<a title="${evil}">x</a>`.value.includes('&quot;'), 'html`` escaper anførselstegn i attributter');
ok(!p(evil).value.includes('<img'), 'p() escaper');
ok(!details([['Navn', evil]]).value.includes('<img'), 'details() escaper');
ok(esc(null) === '' && esc(5) === '5', 'esc() tåler null og tall');
ok(html`${html`<b>ok</b>`}`.value === '<b>ok</b>', 'ferdig HTML escapes ikke på nytt');

// Lenker: bare adresser vi har bygget selv.
ok(link('x', 'javascript:alert(1)').value.includes('href="#"'), 'javascript: slipper ikke inn i en lenke');
ok(button('x', 'data:text/html,hei').value.includes('href="#"'), 'data: slipper ikke inn i en knapp');
ok(button('x', 'https://northwestcoast.no/logg-inn').value.includes('href="https://northwestcoast.no/logg-inn"'), 'https-adresser beholdes');
ok(button('x', '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email').value.includes('{{ .SiteURL }}/auth/confirm'), 'Supabase-plassholderen for nettadressen beholdes');

// Enlinjefelt.
ok(oneLine('Ola\nTOTALSUM: 0 kr\r\nBcc: x') === 'Ola TOTALSUM: 0 kr Bcc: x', 'oneLine() fjerner linjeskift');
ok(!oneLine(`a${String.fromCharCode(0x202e)}b${ZW}c`).includes(String.fromCharCode(0x202e)), 'oneLine() fjerner retningsbytte');
ok(Array.from(oneLine('😀'.repeat(10), 3)).length === 3, 'oneLine() kutter per tegn, ikke midt i et');

// Navn i hilsenen til en ukjent adresse.
for (const good of ['Kari', 'Kari Hansen', 'Jean-Luc Ørnes', "Anne O'Neil"]) ok(safeName(good) === good, `navnet «${good}» godtas`);
for (const bad of ['Betaling feilet – se nwc-pay.cc', 'Ring 21 00 00 00', 'http://evil.example', 'a@b.no', 'En to tre fire fem', '<b>x</b>', '']) {
  ok(safeName(bad) === '', `«${bad}» brukes ikke som navn`);
}

// Betegnelser og fritekst som ikke skal bli lenker.
ok(safeLabel('M/S Nordkapp II') === `M/${ZW}S Nordkapp II`, 'fartøysnavn med skråstrek beholdes, uten å bli en lenke');
ok(safeLabel('Se https://evil.example/x') === '', 'en betegnelse med adresse i forkastes');
ok(safeLabel('evil.cc/x') === `evil.${ZW}cc/${ZW}x`, 'et domene i en betegnelse kan ikke klikkes');
ok(unlink('Byttet 2 trinn.Se bilde') === `Byttet 2 trinn.${ZW}Se bilde`, 'unlink() endrer ikke teksten synlig');
ok(unlink('kari@rederi.no') === `kari@${ZW}rederi.${ZW}no`, 'unlink() bryter e-postadresser');
ok(unlink('Ca. 2,5 m. Ingen avvik.') === 'Ca. 2,5 m. Ingen avvik.', 'unlink() rører ikke vanlig tegnsetting');

// Rammen.
const doc = shell({
  title: 'Emne <x>', preheader: 'Forhåndstekst', heading: 'Overskrift', body: [p('Hei')], reason: 'Derfor',
  brand: {
    siteUrl: 'https://portal.northwestcoast.no',
    homeUrl: 'https://northwestcoast.no',
    phone: '+47 904 07 341',
    email: 'post@northwestcoast.no',
  },
});
ok(doc.startsWith('<!doctype html>') && doc.includes('lang="nb"'), 'shell() gir et helt dokument på norsk');
ok(doc.includes('<title>Emne &lt;x&gt;</title>'), 'tittelen escapes');
ok(!/<script/i.test(doc) && !/ on[a-z]+=/i.test(doc), 'ingen skript eller hendelsesattributter i rammen');
ok(doc.includes('src="https://portal.northwestcoast.no/images/logo/'), 'logoen hentes fra siteUrl');
ok(/>northwestcoast\.no<\/a>/.test(doc) && !/>portal\.northwestcoast\.no</.test(doc), 'bunnteksten viser homeUrl, ikke siteUrl');

// Filene i supabase/templates/ er de som limes inn i Supabase, og
// forhåndsvisningen i admin bygges av AUTH_TEMPLATES. De må være like, og
// README-en må ha emnefeltene malene har (npm run mail:auth).
const root = new URL('../', import.meta.url);
const readme = readFileSync(new URL('supabase/templates/README.md', root), 'utf8');
for (const template of AUTH_TEMPLATES) {
  const file = readFileSync(new URL(`supabase/templates/${template.file}`, root), 'utf8');
  ok(file === template.html, `supabase/templates/${template.file} er bygget fra malen (kjør npm run mail:auth)`);
  ok(readme.includes(`| \`${template.file}\` | ${template.supabaseName} | ${template.subject} |`), `README-en har emnefeltet til ${template.file}`);
}

if (failed) { console.error(`${failed} test(er) feilet.`); process.exit(1); }
console.log('E-posttestene består.');
