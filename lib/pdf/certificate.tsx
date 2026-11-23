import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { CERTIFICATE_NAME, type CertificateState, serviceResult } from '@/lib/portal/labels';
import { ORG } from '@/lib/site';

/**
 * Servicesertifikatet som PDF.
 *
 * Dokumentet sier det det kan stå inne for, og ikke mer: at NorthWestCoast
 * har utført service på leideren, når, og med hvilket resultat. Det er ikke
 * en godkjenning fra myndighetene, og det viser ikke til standarder.
 *
 * Opplysningene om leideren og eieren er de som ble kopiert inn i
 * sertifikatet da det ble utstedt, ikke dagens. Er sertifikatet utløpt,
 * erstattet eller trukket tilbake når PDF-en lages, står det øverst.
 *
 * Svart tekst, hårlinjer og ingen fargeflater: tåler svart/hvitt-utskrift.
 * Skrifttype: innebygde Helvetica, av samme grunn som i vedlikeholdsloggen
 * (ingen font hentes over nettverk når dokumentet lages).
 */

export type CertificateData = {
  number: string;
  state: CertificateState;
  issuedOn: string;
  validUntil: string;
  issuedByName: string;
  result: string | null;
  remarks: string | null;
  /** Fra servicerapporten sertifikatet ble utstedt fra. Null hvis den er slettet. */
  serviceDate: string | null;
  servicePerformedBy: string | null;
  ladder: { serialNumber: string; productName: string; lengthM: number | null };
  owner: { company: string | null; vessel: string | null; project: string | null };
  revokedAt: string | null;
  revokedReason: string | null;
  replacedByNumber: string | null;
  /** Kontrollsiden: <origin>/sertifikat/<verify_token>. */
  verifyUrl: string;
  generatedAt: Date;
};

const dato = (value: string | null | undefined) => {
  if (!value) return '–';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '–';
  return parsed.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Oslo' });
};

const tidspunkt = (value: Date) =>
  value.toLocaleString('nb-NO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo',
  });

const INK = '#111111';
const MUTED = '#4d4d4d';
const LINE = '#8c8c8c';
const NAVY = '#0a1628';
const MARGIN = 62;

const s = StyleSheet.create({
  // MERK: lineHeight må ikke settes på Page-stilen (se lib/pdf/maintenance-log.tsx).
  page: {
    paddingTop: 58,
    paddingBottom: 112,
    paddingHorizontal: MARGIN,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: INK,
  },
  frame: { position: 'absolute', top: 26, left: 26, right: 26, bottom: 26, borderWidth: 0.75, borderColor: NAVY },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1.5,
    borderBottomColor: NAVY,
    paddingBottom: 10,
  },
  brand: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: NAVY, letterSpacing: 0.6 },
  org: { fontSize: 8, color: MUTED, textAlign: 'right', lineHeight: 1.45 },

  titleBlock: { marginTop: 42, marginBottom: 34, alignItems: 'center' },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: NAVY, letterSpacing: 1.2, textTransform: 'uppercase' },
  number: { fontSize: 12, marginTop: 8, letterSpacing: 0.5 },

  notice: { borderWidth: 1.5, borderColor: INK, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 20 },
  noticeTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.6 },
  noticeText: { fontSize: 9.5, marginTop: 3, lineHeight: 1.45 },

  intro: { fontSize: 10.5, lineHeight: 1.5, marginBottom: 26 },

  columns: { flexDirection: 'row', marginHorizontal: -12, marginBottom: 26 },
  column: { width: '50%', paddingHorizontal: 12 },
  h2: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    paddingBottom: 4,
    borderBottomWidth: 0.75,
    borderBottomColor: INK,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6.5,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  key: { width: 88, fontSize: 8.5, color: MUTED, paddingTop: 1.5 },
  value: { flex: 1, fontSize: 10.5 },
  strong: { fontFamily: 'Helvetica-Bold' },

  block: { marginBottom: 26 },
  body: { fontSize: 10, lineHeight: 1.5, paddingTop: 6 },
  link: { fontFamily: 'Courier', fontSize: 9.5, color: INK, textDecoration: 'none', paddingTop: 5 },

  footer: { position: 'absolute', left: MARGIN, right: MARGIN, bottom: 46 },
  footerRule: { borderTopWidth: 0.5, borderTopColor: LINE, marginBottom: 6 },
  footerText: { fontSize: 7.5, color: MUTED, lineHeight: 1.45 },
});

/**
 * Tekst uten orddeling. @react-pdf deler ord etter engelske regler, og det
 * gir «anmerkn-ing» i smale kolonner. Her brytes linjene bare mellom ord.
 */
const whole = (word: string) => [word];

function T(props: React.ComponentProps<typeof Text>) {
  return <Text hyphenationCallback={whole} {...props} />;
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.row}>
      <T style={s.key}>{label}</T>
      <T style={strong ? [s.value, s.strong] : s.value}>{value}</T>
    </View>
  );
}

function notice(data: CertificateData): { title: string; text: string } | null {
  switch (data.state) {
    case 'revoked':
      return {
        title: `Trukket tilbake ${dato(data.revokedAt)}`,
        text: [data.revokedReason, 'Dokumentet gjelder ikke lenger.'].filter(Boolean).join(' '),
      };
    case 'replaced':
      return {
        title: data.replacedByNumber ? `Erstattet av ${data.replacedByNumber}` : 'Erstattet av et nyere',
        text: 'Dokumentet gjelder ikke lenger. Bruk det nyeste.',
      };
    case 'expired':
      return {
        title: `Utløpt ${dato(data.validUntil)}`,
        text: 'Gyldigheten er gått ut. Leideren må til ny service.',
      };
    default:
      return null;
  }
}

export default function CertificateDocument({ data }: { data: CertificateData }) {
  const { ladder, owner } = data;
  const warning = notice(data);
  const length = ladder.lengthM === null ? '–' : `${ladder.lengthM.toLocaleString('nb-NO')} m`;

  return (
    <Document
      title={`${CERTIFICATE_NAME} ${data.number}`}
      author={ORG.name}
      subject={`Leider ${ladder.serialNumber}`}
    >
      <Page size="A4" style={s.page}>
        <View style={s.frame} fixed />

        <View style={s.header}>
          <T style={s.brand}>NORTHWEST COAST</T>
          <View>
            <T style={s.org}>{ORG.legalName} · Org.nr {ORG.orgNumber}</T>
            <T style={s.org}>{ORG.street}, {ORG.postalCode} {ORG.city}</T>
            <T style={s.org}>{ORG.phoneDisplay} · {ORG.email}</T>
          </View>
        </View>

        <View style={s.titleBlock}>
          <T style={s.title}>{CERTIFICATE_NAME}</T>
          <T style={s.number}>Nr. {data.number}</T>
        </View>

        {warning && (
          <View style={s.notice}>
            <T style={s.noticeTitle}>{warning.title}</T>
            <T style={s.noticeText}>{warning.text}</T>
          </View>
        )}

        <T style={s.intro}>
          {ORG.name} bekrefter at leideren under har vært til service, med resultatet som står her.
        </T>

        <View style={s.columns}>
          <View style={s.column}>
            <T style={s.h2}>Leider</T>
            <Row label="Produksjonsnummer" value={ladder.serialNumber} strong />
            <Row label="Produkt" value={ladder.productName} />
            <Row label="Lengde" value={length} />
          </View>
          <View style={s.column}>
            <T style={s.h2}>Eier og plassering ved utstedelsen</T>
            <Row label="Eier" value={owner.company ?? '–'} />
            <Row label="Fartøy" value={owner.vessel ?? '–'} />
            {owner.project && <Row label="Prosjekt" value={owner.project} />}
          </View>
        </View>

        <View style={s.columns}>
          <View style={s.column}>
            <T style={s.h2}>Service</T>
            <Row label="Dato for service" value={dato(data.serviceDate)} />
            {data.servicePerformedBy && <Row label="Utført av" value={data.servicePerformedBy} />}
            <Row label="Resultat" value={data.result ? serviceResult(data.result).label : '–'} strong />
          </View>
          <View style={s.column}>
            <T style={s.h2}>Gyldighet</T>
            <Row label="Utstedt" value={dato(data.issuedOn)} />
            <Row label="Gyldig til" value={dato(data.validUntil)} strong />
            <Row label="Utstedt av" value={data.issuedByName} />
          </View>
        </View>

        {data.remarks && (
          <View style={s.block}>
            <T style={s.h2}>Merknad</T>
            <T style={s.body}>{data.remarks}</T>
          </View>
        )}

        <View style={s.block} wrap={false}>
          <T style={s.h2}>Kontroll</T>
          <T style={s.body}>
            På adressen under vises det om dokumentet er ekte og fortsatt gjelder, eller om det er erstattet eller
            trukket tilbake.
          </T>
          <Link src={data.verifyUrl} style={s.link}>{data.verifyUrl}</Link>
        </View>

        <View style={s.footer} fixed>
          <View style={s.footerRule} />
          <T style={s.footerText}>
            Dokumentet bekrefter service utført av {ORG.name}, og gjelder leideren slik den var på servicedatoen.
            Det er ikke en godkjenning fra offentlige myndigheter.
          </T>
          <T style={s.footerText}>Skrevet ut {tidspunkt(data.generatedAt)}.</T>
        </View>
      </Page>
    </Document>
  );
}
