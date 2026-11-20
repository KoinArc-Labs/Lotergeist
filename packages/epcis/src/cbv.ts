/**
 * Core Business Vocabulary (CBV) mapping for pharmacy lot movements.
 * Sandbox mapping chosen for this pilot. Check it against the current GS1 CBV before trading data with anyone.
 */
export const TRACE_KINDS = ["receiving", "storing", "picking", "dispensing", "returning", "destroying", "holding", "releasing", "shipping", "adjusting"] as const;
export type TraceKind = (typeof TRACE_KINDS)[number];
export const HOLD_REASONS = ["non_conformant", "recalled"] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

const BIZ = "https://ref.gs1.org/cbv/BizStep-";
const DISP = "https://ref.gs1.org/cbv/Disp-";

interface Map1 { bizStep: string; disposition: string }
const BASE: Record<Exclude<TraceKind, "holding">, Map1> = {
  receiving: { bizStep: "receiving", disposition: "in_progress" },
  storing: { bizStep: "storing", disposition: "sellable_accessible" },
  picking: { bizStep: "picking", disposition: "in_progress" },
  dispensing: { bizStep: "dispensing", disposition: "dispensed" },
  returning: { bizStep: "returning", disposition: "returned" },
  destroying: { bizStep: "destroying", disposition: "destroyed" },
  releasing: { bizStep: "inspecting", disposition: "conformant" },
  shipping: { bizStep: "shipping", disposition: "in_transit" },
  adjusting: { bizStep: "cycle_counting", disposition: "active" }
};

export function cbvFor(kind: TraceKind, hold: HoldReason = "non_conformant"): { bizStep: string; disposition: string } {
  const m = kind === "holding" ? { bizStep: "holding", disposition: hold } : BASE[kind];
  return { bizStep: BIZ + m.bizStep, disposition: DISP + m.disposition };
}

const short = (uri: string, prefix: string) => (uri.startsWith(prefix) ? uri.slice(prefix.length) : uri.replace(/^urn:epcglobal:cbv:(bizstep|disp):/, ""));

/** Reverse lookup. Accepts both the https://ref.gs1.org/cbv/ form and the older urn:epcglobal:cbv: form. */
export function kindFromCbv(bizStep: string | undefined, disposition: string | undefined): { kind: TraceKind; hold?: HoldReason } | null {
  if (!bizStep) return null;
  const b = short(bizStep, BIZ), d = disposition ? short(disposition, DISP) : "";
  if (b === "holding") return { kind: "holding", hold: d === "recalled" ? "recalled" : "non_conformant" };
  for (const [kind, m] of Object.entries(BASE) as [Exclude<TraceKind, "holding">, Map1][]) if (m.bizStep === b && (!d || m.disposition === d)) return { kind };
  for (const [kind, m] of Object.entries(BASE) as [Exclude<TraceKind, "holding">, Map1][]) if (m.bizStep === b) return { kind };
  return null;
}

export const KNOWN_BIZSTEPS = new Set([...Object.values(BASE).map((m) => BIZ + m.bizStep), BIZ + "holding"]);
