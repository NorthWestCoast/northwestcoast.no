import Link from 'next/link';
import { Disclosure } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { PlacementFields, type PlaceOption } from '@/components/portal/placement';
import {
  installLadder, placeCabinet, takeDownCabinet, takeDownLadder,
} from '@/app/(portal)/minside/actions';
import { type CabinetRow, cabinetName, cabinetPlaceText } from './cabinet-table';

type Options = { vessels: PlaceOption[]; projects: PlaceOption[] };

/** Vises når brukeren ikke har noe å plassere utstyret på ennå. */
function NothingToPlaceOn({ what }: { what: string }) {
  return (
    <p className="pt-hint">
      Du har ingen fartøy eller prosjekter å plassere {what} på ennå. Legg til et{' '}
      <Link href="/minside/fartoy">fartøy</Link>, eller et <Link href="/minside/prosjekter">prosjekt</Link> hvis{' '}
      {what} skal stå på en kai eller et anlegg på land.
    </p>
  );
}

/**
 * Skjema for å plassere eller flytte en leider: fartøy, prosjekt eller begge.
 * Servicefristen regnes fra datoen, så en leider som bare flyttes beholder
 * datoen den ble tatt i bruk.
 */
export function LadderPlacementForm({
  ladder,
  options,
  today,
}: {
  ladder: { id: string; status: string | null; vessel_id: string | null; project_id: string | null; installed_at: string | null };
  options: Options;
  today: string;
}) {
  if (options.vessels.length === 0 && options.projects.length === 0) return <NothingToPlaceOn what="leideren" />;

  const placed = ladder.status === 'installed' && Boolean(ladder.vessel_id || ladder.project_id);

  return (
    <PortalForm
      action={installLadder}
      submitLabel={placed ? 'Lagre plassering' : 'Ta i bruk'}
      tone="green"
      resetOnSuccess={false}
    >
      <input type="hidden" name="ladder_id" value={ladder.id} />
      <PlacementFields
        scope={`place-${ladder.id}`}
        vessels={options.vessels}
        projects={options.projects}
        vesselId={ladder.vessel_id}
        projectId={ladder.project_id}
        date={placed && ladder.installed_at ? ladder.installed_at : today}
        maxDate={today}
        dateLabel="Tatt i bruk"
        dateHint={
          placed
            ? 'Servicefristen regnes fra denne datoen. La den stå når leideren bare flyttes.'
            : 'Servicefristen regnes fra denne datoen.'
        }
      />
    </PortalForm>
  );
}

export function LadderTakeDown({ ladderId }: { ladderId: string }) {
  return (
    <ActionButton
      action={takeDownLadder}
      fields={{ ladder_id: ladderId }}
      label="Ta ned leideren"
      tone="danger"
      confirm="Ta leideren ned? Den står da som levert og er ikke lenger knyttet til fartøyet eller prosjektet."
    />
  );
}

/** Ett skap: plasser, flytt eller ta ned. Ligger sammenslått under tabellen. */
export function CabinetPlacement({
  cabinet,
  options,
  today,
}: {
  cabinet: CabinetRow;
  options: Options;
  today: string;
}) {
  const placed = Boolean(cabinet.vessel_id || cabinet.project_id);
  const label = [
    cabinetName(cabinet),
    cabinet.serial_number ? `nr. ${cabinet.serial_number}` : null,
    cabinetPlaceText(cabinet),
  ].filter(Boolean).join(' · ');

  return (
    <Disclosure summary={`${placed ? 'Flytt' : 'Plasser'}: ${label}`}>
      {options.vessels.length === 0 && options.projects.length === 0 ? (
        <NothingToPlaceOn what="skapet" />
      ) : (
        <div className="pt-form">
          {/* Ny nøkkel når skapet er flyttet eller tatt ned: skjemaet tegnes da
              på nytt med plasseringen som gjelder, ikke det som sist ble valgt. */}
          <PortalForm
            key={`${cabinet.vessel_id ?? ''}|${cabinet.project_id ?? ''}`}
            action={placeCabinet}
            submitLabel={placed ? 'Lagre plassering' : 'Plasser skapet'}
            tone="green"
            resetOnSuccess={false}
          >
            <input type="hidden" name="cabinet_id" value={cabinet.id} />
            <PlacementFields
              scope={`cabinet-${cabinet.id}`}
              vessels={options.vessels}
              projects={options.projects}
              vesselId={cabinet.vessel_id}
              projectId={cabinet.project_id}
              date={cabinet.installed_at ?? today}
              maxDate={today}
              dateLabel="Plassert dato"
              location={{ value: cabinet.location_note }}
            />
          </PortalForm>
          {placed && (
            <div>
              <ActionButton
                action={takeDownCabinet}
                fields={{ cabinet_id: cabinet.id }}
                label="Ta ned skapet"
                tone="danger"
                confirm="Ta skapet ned? Det står da som levert, ikke plassert."
              />
            </div>
          )}
        </div>
      )}
    </Disclosure>
  );
}
