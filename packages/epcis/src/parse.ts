import { kindFromCbv } from "./cbv";
import { parseEpc } from "./identifiers";
import { validateEpcisDocument } from "./validate";
import type { TraceEvent } from "./types";

export interface ParseOutcome { ok: boolean; events: TraceEvent[]; errors: { index: number | null; message: string }[]; skipped: { index: number; type: string }[] }

/** Read an EPCIS 2.0 JSON document back into neutral events. One neutral event per EPC or per class in the quantityList. */
export function parseEpcisDocument(doc: unknown): ParseOutcome {
  const v = validateEpcisDocument(doc);
  if (!v.ok) return { ok: false, events: [], errors: v.errors, skipped: [] };
  const events: TraceEvent[] = [];
  const errors: ParseOutcome["errors"] = [];
  v.events.forEach((e, index) => {
    const k = kindFromCbv(e.bizStep, e.disposition);
    if (!k) { errors.push({ index, message: `bizStep ${String(e.bizStep).slice(0, 80)} is not one this pilot reads` }); return; }
    const base = {
      at: Date.parse(e.eventTime), kind: k.kind, ...(k.hold ? { hold: k.hold } : {}),
      ...(e["cbvmda:itemExpirationDate"] ? { expiry: e["cbvmda:itemExpirationDate"] } : {}),
      ...(e["chimera:inferred"] ? { inferred: true } : {}),
      ...(typeof e["chimera:patientId"] === "string" ? { patientId: e["chimera:patientId"] } : {}),
      ...(typeof e["chimera:recallId"] === "string" ? { recallId: e["chimera:recallId"] } : {})
    } satisfies Partial<TraceEvent>;
    const loc = (e as any).bizLocation?.id ?? (e as any).readPoint?.id;
    const location = typeof loc === "string" ? /\/location\/([^/]+)$/.exec(loc)?.[1] : undefined;
    const lotExt = e["cbvmda:lotNumber"];
    const items = [
      ...(e.epcList ?? []).map((x) => ({ p: parseEpc(x)!, quantity: undefined as number | undefined })),
      ...(e.quantityList ?? []).map((c) => ({ p: parseEpc(c.epcClass)!, quantity: c.quantity }))
    ];
    items.forEach(({ p, quantity }, n) => {
      const id = typeof e.eventID === "string" ? (items.length > 1 ? `${e.eventID}#${n + 1}` : e.eventID) : undefined;
      const lot = lotExt ?? p.lot;
      const inferredSerial = e["chimera:inferredSerial"];
      events.push({
        ...base, ...(id ? { id } : {}), gtin: p.gtin, ...(lot ? { lot } : {}),
        ...(p.serial ? { serial: p.serial } : inferredSerial ? { serial: inferredSerial } : {}),
        ...(quantity && quantity !== 1 ? { quantity } : {}),
        ...(location ? { location: decodeURIComponent(location) } : {})
      });
    });
  });
  return { ok: errors.length === 0, events, errors, skipped: v.skipped };
}
