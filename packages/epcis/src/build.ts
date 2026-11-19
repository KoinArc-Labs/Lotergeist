import { isValidGtin } from "@chimera-rx/gs1";
import { cbvFor } from "./cbv";
import { DEFAULT_COMPANY_PREFIX_LENGTH, gtinToDigitalLink, gtinToLgtinUrn, gtinToProductPattern, gtinToSgtinUrn } from "./identifiers";
import type { EpcisDocument, TraceEvent } from "./types";

export const EPCIS_CONTEXT = [
  "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld",
  { chimera: "https://chimera-rx.example/ns/epcis#", cbvmda: "urn:epcglobal:cbv:mda:" }
];
export const SANDBOX_NOTICE = "Sandbox, not a filing. Synthetic data. Produced by Chimera Rx for a pilot demo; no compliance is claimed.";

const enc = (s: string) => encodeURIComponent(s);
export const eventIdFor = (e: TraceEvent) => e.id ?? `urn:chimera-rx:event:${e.at}:${e.kind}${e.hold ? `-${e.hold}` : ""}:${e.gtin}:${enc(e.lot ?? "")}:${enc(e.serial ?? "")}`;

/** True when an event may be written: it names a lot or a real serial, or it is marked inferred. */
export function isTraceable(e: TraceEvent): boolean {
  const realSerial = !!e.serial && !e.inferred;
  return realSerial || !!e.lot || e.inferred === true;
}

/** ISO calendar date: 2027-03-31 is real, 2027-02-30 is not. */
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export function toObjectEvent(e: TraceEvent, cpLen = DEFAULT_COMPANY_PREFIX_LENGTH): Record<string, unknown> {
  if (!isValidGtin(e.gtin) || e.gtin.length !== 14) throw new Error(`Event has no valid GTIN-14: ${e.gtin}`);
  if (!isTraceable(e)) throw new Error("Refusing to write an event with no lot and no serial that is not marked inferred.");
  if (e.expiry && !isIsoDate(e.expiry)) throw new Error(`Expiry must be an ISO date: ${e.expiry}`);
  const { bizStep, disposition } = cbvFor(e.kind, e.hold);
  const out: Record<string, unknown> = {
    type: "ObjectEvent",
    eventTime: new Date(e.at).toISOString(),
    eventTimeZoneOffset: "+00:00",
    eventID: eventIdFor(e),
    action: "OBSERVE",
    bizStep,
    disposition
  };
  const realSerial = e.serial && !e.inferred ? e.serial : undefined;
  if (realSerial) {
    out.epcList = [gtinToSgtinUrn(e.gtin, realSerial, cpLen)];
    out["chimera:digitalLink"] = gtinToDigitalLink(e.gtin, realSerial);
  } else if (e.lot) out.quantityList = [{ epcClass: gtinToLgtinUrn(e.gtin, e.lot, cpLen), quantity: e.quantity ?? 1 }];
  else out.quantityList = [{ epcClass: gtinToProductPattern(e.gtin, cpLen), quantity: e.quantity ?? 1 }];
  if (e.lot) out["cbvmda:lotNumber"] = e.lot;
  if (e.expiry) out["cbvmda:itemExpirationDate"] = e.expiry;
  if (e.inferred) {
    out["chimera:inferred"] = true;
    // documented extension: the serial was NOT read from a label, so it is never put in epcList
    if (e.serial) out["chimera:inferredSerial"] = e.serial;
  }
  if (e.location) { const id = `https://chimera-rx.example/sandbox/location/${enc(e.location)}`; out.readPoint = { id }; out.bizLocation = { id }; }
  if (e.patientId) out["chimera:patientId"] = e.patientId;
  if (e.recallId) out["chimera:recallId"] = e.recallId;
  return out;
}

export function buildEpcisDocument(events: TraceEvent[], opts: { creationDate?: number; cpLen?: number; extra?: Record<string, unknown> } = {}): EpcisDocument {
  return {
    "@context": EPCIS_CONTEXT,
    type: "EPCISDocument",
    schemaVersion: "2.0",
    creationDate: new Date(opts.creationDate ?? Date.now()).toISOString(),
    "chimera:notice": SANDBOX_NOTICE,
    ...(opts.extra ?? {}),
    epcisBody: { eventList: events.map((e) => toObjectEvent(e, opts.cpLen)) }
  };
}
