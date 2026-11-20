import type { HoldReason, TraceKind } from "./cbv";

/** A neutral trace event: what the ledger knows about one package or lot at one moment. No names, no staff, no notes. */
export interface TraceEvent {
  /** stable event URI; made from the other fields when absent */
  id?: string;
  /** epoch milliseconds */
  at: number;
  kind: TraceKind;
  hold?: HoldReason;
  /** GTIN-14 */
  gtin: string;
  lot?: string;
  /** a serial read from the label or the supplier record */
  serial?: string;
  /** ISO date YYYY-MM-DD */
  expiry?: string;
  /**
   * True when the identity was not scanned: the serial is an internal NOSN id or an assumed unit, or the event has neither
   * lot nor serial. An inferred serial is never written as an EPC (pharmacy-safety rule 7).
   */
  inferred?: boolean;
  /** location label, e.g. a store id */
  location?: string;
  /** patient id such as S-0417, never a name; only set when the caller asks for it */
  patientId?: string;
  recallId?: string;
  quantity?: number;
}

export interface EpcisDocument {
  "@context": unknown;
  type: "EPCISDocument";
  schemaVersion: string;
  creationDate: string;
  epcisBody: { eventList: Record<string, unknown>[] };
  [k: string]: unknown;
}
