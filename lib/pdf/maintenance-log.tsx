import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { ORG } from '@/lib/site';

/**
 * Vedlikeholdslogg som PDF.
 *
 * Dette er dokumentet fartøyet viser ved tilsyn, så det prioriterer
 * etterprøvbarhet framfor pynt: dokumentreferanse, genereringstidspunkt,
 * sidetall, og tydelig skille mellom fagmessig service og mannskapets
 * egenrapportering.
 *
 * Skrifttype: innebygde Helvetica framfor husskriftene. @react-pdf må hente
 * registrerte fonter over nettverk ved render, og et compliance-dokument skal
 * ikke kunne feile fordi en font-CDN er nede. Helvetica dekker æ, ø og å.
 */

export type PdfServiceReport = {
  performed_at: string;
  performed_by: string;
  result: 'ok' | 'ok_with_remarks' | 'failed';
  findings: string | null;
  next_service_due: string | null;
};

export type PdfMaintenanceEntry = {
  performed_at: string;
  reporter_name: string | null;
  notes: string | null;
  photoCount: number;
};

export type PdfPhoto = {
  dataUri: string;
  capturedAt: string | null;
  logDate: string;
};

export type MaintenanceLogData = {
  reference: string;
  generatedAt: Date;
  ladder: {
    serial_number: string;
    product_name: string | null;
    product_number: string | null;
    length_m: number | null;
    steps: number | null;
    produced_at: string | null;
    installed_at: string | null;
    next_service_due: string | null;
  };
  vessel: { name: string; imo: string | null; company: string | null } | null;
  services: PdfServiceReport[];
  maintenance: PdfMaintenanceEntry[];
  photos: PdfPhoto[];
  photosOmitted: number;
};

const RESULT_LABEL: Record<PdfServiceReport['result'], string> = {
  ok: 'Godkjent',
  ok_with_remarks: 'Godkjent med anmerkning',
  failed: 'Ikke godkjent',
};

const dato = (value: string | null | undefined) => {
  if (!value) return '–';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '–';
  return parsed.toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const tidspunkt = (value: Date) =>
  value.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const NAVY = '#0a1628';
const BORDER = '#c9d1da';
const MUTED = '#5a6b7d';

const s = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 58,
    paddingHorizontal: 44,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1a2634',
    // MERK: lineHeight må IKKE settes her. På Page-stilen får @react-pdf 4.9
    // til å droppe alt dynamisk innhold (render-propen) uten feilmelding –
    // sidetallet forsvant sporløst. Settes på tekststilene i stedet.
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: NAVY, letterSpacing: 0.5 },
  brandSub: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  headerRight: { textAlign: 'right' },
  docTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: NAVY },
  docRef: { fontSize: 7.5, color: MUTED, marginTop: 2 },

  section: { marginBottom: 14 },
  h2: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hint: { fontSize: 7.5, color: MUTED, marginBottom: 5, lineHeight: 1.4 },

  // Nøkkel/verdi i to kolonner
  kvWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  kv: { width: '50%', flexDirection: 'row', paddingVertical: 1.5 },
  kvKey: { width: 78, color: MUTED },
  kvVal: { flex: 1 },

  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 2 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  trLast: { flexDirection: 'row' },
  th: {
    backgroundColor: '#eef2f6',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: NAVY,
    paddingVertical: 4,
    paddingHorizontal: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  td: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 8, lineHeight: 1.4 },

  empty: {
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 2,
    color: MUTED,
    fontSize: 8,
  },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  photoCell: { width: '33.333%', paddingHorizontal: 4, marginBottom: 10 },
  photo: { width: '100%', height: 92, objectFit: 'cover', borderWidth: 1, borderColor: BORDER },
  photoCaption: { fontSize: 6.5, color: MUTED, marginTop: 2 },

  footerRule: {
    position: 'absolute',
    bottom: 52,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerNote: {
    position: 'absolute',
    bottom: 26,
    left: 44,
    right: 110,
    fontSize: 6.5,
    color: MUTED,
    lineHeight: 1.4,
  },
  footerPage: {
    position: 'absolute',
    bottom: 26,
    right: 44,
    fontSize: 6.5,
    color: MUTED,
  },
});

function Row({
  cells,
  widths,
  header = false,
  last = false,
}: {
  cells: string[];
  widths: string[];
  header?: boolean;
  last?: boolean;
}) {
  return (
    <View style={last ? s.trLast : s.tr} wrap={false}>
      {cells.map((cell, i) => (
        <Text
          key={i}
          style={[header ? s.th : s.td, { width: widths[i] }]}
        >
          {cell}
        </Text>
      ))}
    </View>
  );
}

export default function MaintenanceLogDocument({ data }: { data: MaintenanceLogData }) {
  const { ladder, vessel, services, maintenance, photos } = data;

  return (
    <Document
      title={`Vedlikeholdslogg ${ladder.serial_number}`}
      author={ORG.name}
      subject={`Argostep ${ladder.serial_number}`}
    >
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View>
            <Text style={s.brand}>NORTHWEST COAST</Text>
            <Text style={s.brandSub}>
              {ORG.legalName} · Org.nr {ORG.orgNumber}
            </Text>
            <Text style={s.brandSub}>
              {ORG.street}, {ORG.postalCode} {ORG.city} · {ORG.phoneDisplay}
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Vedlikeholdslogg</Text>
            <Text style={s.docRef}>Ref. {data.reference}</Text>
            <Text style={s.docRef}>Generert {tidspunkt(data.generatedAt)}</Text>
          </View>
        </View>

        {/* Fartøy og leider */}
        <View style={s.section}>
          <Text style={s.h2}>Fartøy og utstyr</Text>
          <View style={s.kvWrap}>
            <View style={s.kv}>
              <Text style={s.kvKey}>Fartøy</Text>
              <Text style={s.kvVal}>{vessel?.name ?? 'Ikke tilknyttet'}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvKey}>IMO</Text>
              <Text style={s.kvVal}>{vessel?.imo ?? '–'}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvKey}>Rederi</Text>
              <Text style={s.kvVal}>{vessel?.company ?? '–'}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvKey}>Serienummer</Text>
              <Text style={s.kvVal}>{ladder.serial_number}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvKey}>Produkt</Text>
              <Text style={s.kvVal}>
                {ladder.product_name ?? '–'}
                {ladder.product_number ? ` (${ladder.product_number})` : ''}
              </Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvKey}>Lengde</Text>
              <Text style={s.kvVal}>
                {ladder.length_m ? `${ladder.length_m} m` : '–'}
                {ladder.steps ? ` · ${ladder.steps} trinn` : ''}
              </Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvKey}>Produsert</Text>
              <Text style={s.kvVal}>{dato(ladder.produced_at)}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvKey}>Installert</Text>
              <Text style={s.kvVal}>{dato(ladder.installed_at)}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvKey}>Neste service</Text>
              <Text style={s.kvVal}>{dato(ladder.next_service_due)}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvKey}>Sertifisering</Text>
              <Text style={s.kvVal}>ISO 799-1:2019</Text>
            </View>
          </View>
        </View>

        {/* Service – det som teller ved tilsyn */}
        <View style={s.section}>
          <Text style={s.h2}>Servicehistorikk</Text>
          <Text style={s.hint}>
            Fagmessig kontroll utført av {ORG.name} eller godkjent partner.
          </Text>
          {services.length > 0 ? (
            <View style={s.table}>
              <Row
                header
                widths={['14%', '22%', '22%', '14%', '28%']}
                cells={['Dato', 'Utført av', 'Resultat', 'Neste frist', 'Funn']}
              />
              {services.map((r, i) => (
                <Row
                  key={i}
                  last={i === services.length - 1}
                  widths={['14%', '22%', '22%', '14%', '28%']}
                  cells={[
                    dato(r.performed_at),
                    r.performed_by,
                    RESULT_LABEL[r.result],
                    dato(r.next_service_due),
                    r.findings ?? '–',
                  ]}
                />
              ))}
            </View>
          ) : (
            <Text style={s.empty}>
              Ingen service registrert. Neste frist er beregnet fra installasjonsdato.
            </Text>
          )}
        </View>

        {/* Mannskapets egenrapportering */}
        <View style={s.section}>
          <Text style={s.h2}>Vedlikehold utført om bord</Text>
          <Text style={s.hint}>Egenrapportering fra mannskapet.</Text>
          {maintenance.length > 0 ? (
            <View style={s.table}>
              <Row
                header
                widths={['14%', '24%', '50%', '12%']}
                cells={['Dato', 'Utført av', 'Kommentar', 'Bilder']}
              />
              {maintenance.map((r, i) => (
                <Row
                  key={i}
                  last={i === maintenance.length - 1}
                  widths={['14%', '24%', '50%', '12%']}
                  cells={[
                    dato(r.performed_at),
                    r.reporter_name ?? '–',
                    r.notes ?? '–',
                    r.photoCount > 0 ? String(r.photoCount) : '–',
                  ]}
                />
              ))}
            </View>
          ) : (
            <Text style={s.empty}>Ingen egenrapportering registrert.</Text>
          )}
        </View>

        {/* Bilder */}
        {photos.length > 0 && (
          <View style={s.section} break={photos.length > 6}>
            <Text style={s.h2}>Bildedokumentasjon</Text>
            <Text style={s.hint}>
              Tidspunktet er når bildet ble tatt, ikke når det ble lastet opp.
              {data.photosOmitted > 0
                ? ` ${data.photosOmitted} eldre bilde(r) er utelatt – de ligger i sin helhet på Min side.`
                : ''}
            </Text>
            <View style={s.photoGrid}>
              {photos.map((photo, i) => (
                <View key={i} style={s.photoCell} wrap={false}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text --
                      @react-pdf sin Image er ikke et HTML-element og har
                      ingen alt-prop; regelen treffer feil her. */}
                  <Image style={s.photo} src={photo.dataUri} />
                  <Text style={s.photoCaption}>
                    {photo.capturedAt
                      ? `Tatt ${dato(photo.capturedAt)}`
                      : `Registrert ${dato(photo.logDate)}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={s.footerRule} fixed />
        <Text style={s.footerNote} fixed>
          Dokumentet er generert fra {ORG.name} sitt vedlikeholdsregister og
          gjenspeiler registrerte opplysninger på genereringstidspunktet. Det
          erstatter ikke skipsførerens plikt etter SOLAS kap. V regel 23 til å
          sørge for en forskriftsmessig ombordstigningsordning.
        </Text>
        <Text
          style={s.footerPage}
          fixed
          render={({ pageNumber, totalPages }) => `Side ${pageNumber} av ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
