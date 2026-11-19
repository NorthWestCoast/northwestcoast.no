import type { Json } from '@/lib/supabase/database.types';

/**
 * Svaret fra get_ladder_share() er rå JSON. Her leses det forsiktig inn i en
 * kjent form, så siden aldri krasjer på et felt som mangler eller har endret
 * type. Ukjente verdier blir null eller tom liste.
 */
export type SharePayload =
  | { state: 'invalid' }
  | { state: 'revoked' }
  | { state: 'expired' }
  | {
      state: 'active';
      shareId: string | null;
      title: string | null;
      note: string | null;
      recipient: string | null;
      checklist: { label: string; checked: boolean }[];
      createdAt: string | null;
      createdByName: string | null;
      expiresAt: string | null;
      ladder: {
        serialNumber: string | null;
        productName: string | null;
        productNumber: string | null;
        lengthM: number | null;
        steps: number | null;
        producedAt: string | null;
        installedAt: string | null;
      };
      vessel: { name: string | null; imo: string | null; callSign: string | null } | null;
      lastService: {
        performedAt: string | null;
        result: string | null;
        nextServiceDue: string | null;
        performedBy: string | null;
      } | null;
      recentLogs: { performedAt: string | null; kind: string | null; title: string | null; reporterName: string | null }[];
      photos: { path: string; capturedAt: string | null; caption: string | null }[];
    };

type Obj = { [key: string]: Json | undefined };

const obj = (value: Json | undefined): Obj | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;

const list = (value: Json | undefined): Json[] => (Array.isArray(value) ? value : []);

const str = (value: Json | undefined): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const num = (value: Json | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function parseSharePayload(data: Json | null | undefined): SharePayload {
  const root = obj(data ?? undefined);
  if (!root) return { state: 'invalid' };
  if (root.state === 'revoked') return { state: 'revoked' };
  if (root.state === 'expired') return { state: 'expired' };
  if (root.state !== 'active') return { state: 'invalid' };

  const ladder = obj(root.ladder) ?? {};
  const vessel = obj(root.vessel);
  const service = obj(root.last_service);

  return {
    state: 'active',
    shareId: str(root.share_id),
    title: str(root.title),
    note: str(root.note),
    recipient: str(root.recipient),
    checklist: list(root.checklist).flatMap((item) => {
      const row = obj(item);
      const label = row ? str(row.label) : null;
      return row && label ? [{ label, checked: row.checked === true }] : [];
    }),
    createdAt: str(root.created_at),
    createdByName: str(root.created_by_name),
    expiresAt: str(root.expires_at),
    ladder: {
      serialNumber: str(ladder.serial_number),
      productName: str(ladder.product_name),
      productNumber: str(ladder.product_number),
      lengthM: num(ladder.length_m),
      steps: num(ladder.steps),
      producedAt: str(ladder.produced_at),
      installedAt: str(ladder.installed_at),
    },
    vessel: vessel
      ? { name: str(vessel.name), imo: str(vessel.imo), callSign: str(vessel.call_sign) }
      : null,
    lastService: service
      ? {
          performedAt: str(service.performed_at),
          result: str(service.result),
          nextServiceDue: str(service.next_service_due),
          performedBy: str(service.performed_by),
        }
      : null,
    recentLogs: list(root.recent_logs).flatMap((item) => {
      const row = obj(item);
      return row
        ? [{
            performedAt: str(row.performed_at),
            kind: str(row.kind),
            title: str(row.title),
            reporterName: str(row.reporter_name),
          }]
        : [];
    }),
    photos: list(root.photos).flatMap((item) => {
      const row = obj(item);
      const path = row ? str(row.path) : null;
      return row && path ? [{ path, capturedAt: str(row.captured_at), caption: str(row.caption) }] : [];
    }),
  };
}
