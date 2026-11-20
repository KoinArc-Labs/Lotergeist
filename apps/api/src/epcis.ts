import fs from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import path from "node:path";
import { z } from "zod";
import { isValidGtin } from "@chimera-rx/gs1";
import {
  buildEpcisDocument, isIsoDate, parseEpcisDocument, toObjectEvent, SANDBOX_NOTICE, type HoldReason, type TraceEvent, type TraceKind
} from "@chimera-rx/epcis";
import { activeRecallFor, audit, HttpError, type Actor, type Ctx } from "./core";

/**
 * DSCSA trace in the open EPCIS 2.0 format: ledger events out, advisory events in, a SANDBOX verifier and suspect-product cases.
 * Nothing here is a filing and nothing is sent anywhere. Imported events never touch stock.
 */

export const SANDBOX_LABEL = "Sandbox, not a filing. Nothing is sent to anyone.";
const MAX_EVENTS = 5000;

const KIND: Record<string, TraceKind> = {
  Received: "receiving", "Transfer in": "receiving", Shelved: "storing", Moved: "storing", Filled: "picking", Sold: "dispensing",
  Returned: "returning", Destroyed: "destroying", Quarantined: "holding", Released: "releasing", "Transfer out": "shipping", Adjusted: "adjusting"
};

export interface TraceFilter {
  from?: string; to?: string; lot?: string; gtin?: string;
  /** restrict to these lot ids (recall export) */
  lotIds?: number[];
  /** include patient ids on picking/dispensing events. Ids only, never names. */
  includePatients?: boolean;
  recallId?: string;
  storeId?: string;
}

export interface TraceResult { events: TraceEvent[]; skipped: number; truncated: boolean }

const dayStart = (d: string) => Date.parse(`${d}T00:00:00Z`);
const dayEnd = (d: string) => Date.parse(`${d}T00:00:00Z`) + 86_400_000 - 1;

/** The ledger as neutral trace events. No notes, no staff names. Serials that are internal NOSN ids are marked inferred. */
export function traceEvents(ctx: Ctx, f: TraceFilter): TraceResult {
  const where: string[] = [], args: unknown[] = [];
  if (f.from) { where.push("e.at >= ?"); args.push(dayStart(f.from)); }
  if (f.to) { where.push("e.at <= ?"); args.push(dayEnd(f.to)); }
  if (f.lot) { where.push("upper(l.lot) = upper(?)"); args.push(f.lot); }
  if (f.gtin) { where.push("p.gtin = ?"); args.push(f.gtin); }
  if (f.lotIds) {
    if (!f.lotIds.length) return { events: [], skipped: 0, truncated: false };
    where.push(`e.lot_id IN (${f.lotIds.map(() => "?").join(",")})`); args.push(...f.lotIds);
  }
  const rows = ctx.db.all<any>(
    `SELECT e.id, e.at, e.kind, e.note, e.package_id, l.lot, l.ndc11, l.expiry AS lot_expiry, p.gtin AS pgtin, k.serial, k.manual, k.expiry AS pkg_expiry, k.gtin AS kgtin
     FROM lot_events e JOIN lots l ON l.id = e.lot_id LEFT JOIN products p ON p.ndc11 = l.ndc11 LEFT JOIN packages k ON k.id = e.package_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY e.at, e.id LIMIT ${MAX_EVENTS + 1}`, ...args);
  const truncated = rows.length > MAX_EVENTS;
  const events: TraceEvent[] = [];
  let skipped = 0;
  for (const r of rows.slice(0, MAX_EVENTS)) {
    const kind = KIND[r.kind as string];
    const gtin = r.kgtin ?? r.pgtin;
    if (!kind || !gtin || !isValidGtin(gtin) || gtin.length !== 14 || !r.lot) { skipped++; continue; }
    const nosn = !!r.serial && (!!r.manual || /^NOSN-/.test(r.serial));
    const expiry = [r.pkg_expiry, r.lot_expiry].find((x) => typeof x === "string" && isIsoDate(x));
    const hold: HoldReason | undefined = kind === "holding" ? (/recall/i.test(r.note ?? "") || activeRecallFor(ctx, r.ndc11, r.lot) ? "recalled" : "non_conformant") : undefined;
    const recallId = kind === "holding" ? /recall\s+([A-Za-z0-9-]+)/i.exec(r.note ?? "")?.[1] : undefined;
    let patientId: string | undefined;
    if (f.includePatients && r.package_id && (kind === "picking" || kind === "dispensing")) {
      patientId = ctx.db.get<{ patient_id: string }>("SELECT r.patient_id FROM dispenses d JOIN prescriptions r ON r.id = d.rx_id WHERE d.package_id = ? ORDER BY d.id DESC LIMIT 1", r.package_id)?.patient_id;
    }
    const ev: TraceEvent = {
      id: `urn:chimera-rx:lot-event:${f.storeId ?? "store"}:${r.id}`, at: r.at, kind, ...(hold ? { hold } : {}), gtin, lot: r.lot,
      ...(r.serial ? { serial: r.serial } : {}), ...(expiry ? { expiry } : {}), ...(nosn ? { inferred: true } : {}),
      ...(f.storeId ? { location: f.storeId } : {}), ...(patientId ? { patientId } : {}), ...(recallId ? { recallId } : {})
    };
    try { toObjectEvent(ev); events.push(ev); } catch { skipped++; }
  }
  return { events, skipped, truncated };
}

export function exportDocument(ctx: Ctx, actor: Actor, f: TraceFilter, extra: Record<string, unknown> = {}) {
  const t = traceEvents(ctx, { ...f, storeId: actor.storeId });
  const doc = buildEpcisDocument(t.events, { creationDate: ctx.now(), extra: { "chimera:filters": { from: f.from, to: f.to, lot: f.lot, gtin: f.gtin, patients: !!f.includePatients }, "chimera:skippedEvents": t.skipped, "chimera:truncated": t.truncated, ...extra } });
  return { doc, count: t.events.length, skipped: t.skipped, truncated: t.truncated };
}

export const exportQuery = z.object({
  from: z.string().refine(isIsoDate, "from must be YYYY-MM-DD").optional(),
  to: z.string().refine(isIsoDate, "to must be YYYY-MM-DD").optional(),
  lot: z.string().min(1).max(20).optional(),
  gtin: z.string().regex(/^\d{14}$/, "gtin must be 14 digits").refine(isValidGtin, "gtin has a bad check digit").optional(),
  patients: z.enum(["0", "1"]).optional()
});

// ------------------------------------------------------------------ import (advisory only)

export interface ImportPreview { id: string | null; at: string; kind: TraceKind; gtin: string; lot: string | null; serial: string | null; known: boolean; duplicate: boolean }

/** Validate and, only when `commit` is set, store the events as advisory trace data. Lots, packages and the ledger are never touched. */
export function importEpcis(ctx: Ctx, actor: Actor, document: unknown, o: { commit: boolean; label?: string }) {
  const parsed = parseEpcisDocument(document);
  if (!parsed.ok) {
    if (o.commit) throw new HttpError(422, `The document is not valid EPCIS: ${parsed.errors.slice(0, 3).map((e) => e.message).join("; ")}`, "invalid_epcis");
    return { valid: false, dryRun: true, errors: parsed.errors.slice(0, 50), counts: { events: 0, new: 0, duplicates: 0, unknownProduct: 0, skipped: 0 }, preview: [] as ImportPreview[], changesStock: false, label: SANDBOX_LABEL };
  }
  const seen = new Set<string>();
  const rows = parsed.events.map((e) => {
    const id = e.id ?? `urn:chimera-rx:import:${e.at}:${e.kind}:${e.gtin}:${e.lot ?? ""}:${e.serial ?? ""}`;
    const duplicate = seen.has(id) || !!ctx.db.get("SELECT 1 FROM trace_imports WHERE event_id = ?", id);
    seen.add(id);
    // patient ids in an imported file are dropped: advisory trace data never carries them in
    const { patientId: _drop, ...clean } = e;
    return { id, e: { ...clean, id }, duplicate, known: !!ctx.db.get("SELECT 1 FROM products WHERE gtin = ?", e.gtin) };
  });
  const fresh = rows.filter((r) => !r.duplicate);
  const counts = { events: rows.length, new: fresh.length, duplicates: rows.length - fresh.length, unknownProduct: rows.filter((r) => !r.known).length, skipped: parsed.skipped.length };
  if (o.commit) {
    ctx.db.tx(() => {
      for (const r of fresh) ctx.db.run(
        "INSERT OR IGNORE INTO trace_imports (at, by_name, event_id, kind, gtin, lot, serial, expiry, event_at, source_label, event_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ctx.now(), actor.name, r.id, r.e.kind, r.e.gtin, r.e.lot ?? null, r.e.serial ?? null, r.e.expiry ?? null, r.e.at, (o.label ?? "").slice(0, 80), JSON.stringify(r.e));
    });
    audit(ctx, actor, "epcis.import", "epcis", "import", undefined, { ...counts, label: (o.label ?? "").slice(0, 80) });
  }
  return {
    valid: true, dryRun: !o.commit, errors: [], counts, changesStock: false, label: SANDBOX_LABEL,
    note: "Imported events are advisory trace data. They never add, move or release stock.",
    preview: rows.slice(0, 50).map((r): ImportPreview => ({ id: r.id, at: new Date(r.e.at).toISOString(), kind: r.e.kind, gtin: r.e.gtin, lot: r.e.lot ?? null, serial: r.e.serial ?? null, known: r.known, duplicate: r.duplicate }))
  };
}

export const listImports = (ctx: Ctx) => ctx.db.all("SELECT id, at, by_name, kind, gtin, lot, serial, event_at, source_label FROM trace_imports ORDER BY id DESC LIMIT 200");

// ------------------------------------------------------------------ the sandbox verifier

interface VerifierFixture { label: string; commissioned: { gtin: string; serial: string; lot: string; expiry: string }[]; notCommissionedSerialPrefixes: string[] }

function fixture(ctx: Ctx): VerifierFixture {
  try { return JSON.parse(fs.readFileSync(path.join(ctx.cfg.fixturesDir, "dscsa-verifier.json"), "utf8")); }
  catch { return { label: "SANDBOX verifier", commissioned: [], notCommissionedSerialPrefixes: [] }; }
}

export const verifyBody = z.object({
  gtin: z.string().regex(/^\d{14}$/, "gtin must be 14 digits").refine(isValidGtin, "gtin has a bad check digit"),
  serial: z.string().min(1).max(20),
  lot: z.string().min(1).max(20),
  expiry: z.string().refine((s) => s === "" || isIsoDate(s), "expiry must be YYYY-MM-DD").optional(),
  packageId: z.number().int().optional()
});

export type VerifyResult = "verified" | "not_verified" | "lot_recalled";

export interface Verification {
  id: number; result: VerifyResult; reason: string; message: string; sandbox: true; label: string; at: number;
  request: { gtin: string; serial: string; lot: string; expiry: string }
}

/**
 * Synthetic verifier. "Commissioned" data comes from the bundled fixture plus this store's supplier transaction records (ti_records),
 * standing in for the manufacturer's serial database. A lot in a confirmed recall answers lot_recalled.
 */
export function verifyProduct(ctx: Ctx, actor: Actor, b: z.infer<typeof verifyBody>): Verification {
  const fx = fixture(ctx);
  const expiry = b.expiry ?? "";
  const lotEq = (a: string, c: string) => a.toUpperCase() === c.toUpperCase();
  const known = [...fx.commissioned, ...ctx.db.all<any>("SELECT gtin, serial, lot, expiry FROM ti_records WHERE gtin = ? AND serial = ?", b.gtin, b.serial)]
    .filter((c) => c.gtin === b.gtin && c.serial === b.serial);
  let result: VerifyResult, reason: string, message: string;
  const prefixHit = fx.notCommissionedSerialPrefixes.some((p) => b.serial.toUpperCase().startsWith(p));
  const product = ctx.db.get<{ ndc11: string }>("SELECT ndc11 FROM products WHERE gtin = ?", b.gtin);
  if (prefixHit || !known.length) { result = "not_verified"; reason = "serial_not_commissioned"; message = "The sandbox verifier has no record of this serial for this product. Treat the package as suspect: quarantine it and report it."; }
  else if (!known.some((c) => lotEq(c.lot, b.lot))) { result = "not_verified"; reason = "lot_mismatch"; message = `The serial is known but with a different lot (${known[0]!.lot}). Treat the package as suspect.`; }
  else if (expiry && !known.some((c) => !c.expiry || c.expiry === expiry)) { result = "not_verified"; reason = "expiry_mismatch"; message = "The serial and lot are known but the expiry differs. Treat the package as suspect."; }
  else if (product && activeRecallFor(ctx, product.ndc11, b.lot)) { result = "lot_recalled"; reason = "lot_in_confirmed_recall"; message = "The serial is genuine but its lot is in a confirmed recall. The lot stays blocked."; }
  else { result = "verified"; reason = "serial_lot_expiry_match"; message = "Serial, lot and expiry match the sandbox record."; }
  const at = ctx.now();
  const delivery = b.packageId ? ctx.db.get<{ delivery_id: string }>("SELECT delivery_id FROM packages WHERE id = ?", b.packageId)?.delivery_id ?? null : null;
  const request = { gtin: b.gtin, serial: b.serial, lot: b.lot, expiry };
  const body = { result, reason, message, sandbox: true, label: `${fx.label} ${SANDBOX_LABEL}` };
  const id = Number(ctx.db.run("INSERT INTO verification_requests (at, by_name, gtin, serial, lot, expiry, result, reason, response_json, package_id, delivery_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    at, actor.name, b.gtin, b.serial, b.lot, expiry, result, reason, JSON.stringify(body), b.packageId ?? null, delivery).lastInsertRowid);
  audit(ctx, actor, "dscsa.verify", "verification", id, undefined, { ...request, result, reason, sandbox: true });
  return { id, ...body, sandbox: true, at, request } as Verification;
}

export const listVerifications = (ctx: Ctx) => ctx.db.all<any>("SELECT * FROM verification_requests ORDER BY id DESC LIMIT 200").map(shapeVerification);
const shapeVerification = (r: any) => ({ id: r.id, at: r.at, by: r.by_name, gtin: r.gtin, serial: r.serial, lot: r.lot, expiry: r.expiry, result: r.result as VerifyResult, reason: r.reason, packageId: r.package_id, deliveryId: r.delivery_id, response: safeJson(r.response_json) });
const safeJson = (s: string | null) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

// ------------------------------------------------------------------ suspect product cases

export const CASE_STATUSES = ["open", "quarantined", "closed_cleared", "closed_confirmed"] as const;

export const caseBody = z.object({
  verificationId: z.number().int().optional(),
  recallId: z.string().max(40).optional(),
  lot: z.string().max(20).optional(),
  packageId: z.number().int().optional(),
  note: z.string().max(500).optional()
});

export function openCase(ctx: Ctx, actor: Actor, b: z.infer<typeof caseBody>) {
  let source: "verification" | "recall", gtin: string, lot: string, serial: string | null = null, packageId: number | null = b.packageId ?? null, recallId: string | null = null;
  if (b.verificationId) {
    const v = ctx.db.get<any>("SELECT * FROM verification_requests WHERE id = ?", b.verificationId);
    if (!v) throw new HttpError(404, "Unknown verification request.");
    if (v.result === "verified") throw new HttpError(422, "A verified package is not a suspect product. Open a case from a failed verification or a recalled lot.", "not_suspect");
    ({ gtin, lot } = v); serial = v.serial; packageId = packageId ?? v.package_id ?? null; source = "verification";
    if (v.result === "lot_recalled") {
      const p = ctx.db.get<{ ndc11: string }>("SELECT ndc11 FROM products WHERE gtin = ?", gtin);
      recallId = (p && activeRecallFor(ctx, p.ndc11, lot)?.recall_id) || null;
    }
  } else if (b.recallId && b.lot) {
    const rl = ctx.db.get<any>("SELECT * FROM recall_lots WHERE recall_id = ? AND upper(lot) = upper(?) AND confirmed_at IS NOT NULL", b.recallId, b.lot);
    if (!rl) throw new HttpError(422, "That lot is not a confirmed recalled lot of this recall.", "not_suspect");
    const lotRow = ctx.db.get<any>("SELECT l.lot, p.gtin FROM lots l JOIN products p ON p.ndc11 = l.ndc11 WHERE upper(l.lot) = upper(?) AND (? = '' OR l.ndc11 = ?) LIMIT 1", b.lot, rl.ndc11 ?? "", rl.ndc11 ?? "");
    gtin = lotRow?.gtin ?? ""; lot = rl.lot; source = "recall"; recallId = b.recallId;
    if (!gtin) throw new HttpError(422, "This store has no product record for that lot.", "unknown_product");
    if (packageId) { const pk = ctx.db.get<any>("SELECT serial FROM packages WHERE id = ?", packageId); serial = pk?.serial ?? null; }
  } else throw new HttpError(422, "Open a case from a verification request (verificationId) or a confirmed recalled lot (recallId and lot).", "bad_source");
  if (packageId && !ctx.db.get("SELECT 1 FROM packages WHERE id = ?", packageId)) throw new HttpError(404, "Unknown package.");
  const open = ctx.db.get<{ id: number }>("SELECT id FROM suspect_cases WHERE gtin = ? AND lot = ? AND COALESCE(serial,'') = ? AND status IN ('open','quarantined')", gtin, lot, serial ?? "");
  if (open) throw new HttpError(409, `Case ${open.id} is already open for this package.`, "duplicate_case");
  const id = Number(ctx.db.run("INSERT INTO suspect_cases (opened_at, opened_by, source, verification_id, recall_id, gtin, lot, serial, package_id, status, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ctx.now(), actor.name, source, b.verificationId ?? null, recallId, gtin, lot, serial, packageId, "open", b.note ?? "").lastInsertRowid);
  audit(ctx, actor, "dscsa.case_open", "suspect_case", id, undefined, { source, gtin, lot, serial, recallId });
  return caseView(ctx, id);
}

/** Quarantine uses the existing path: a Quarantined lot event, the package moved to Q-1. A recalled lot is never released here. */
export function quarantineCase(ctx: Ctx, actor: Actor, id: number) {
  const c = ctx.db.get<any>("SELECT * FROM suspect_cases WHERE id = ?", id);
  if (!c) throw new HttpError(404, "Unknown case.");
  if (c.status.startsWith("closed")) throw new HttpError(409, "This case is closed.", "closed");
  let moved = 0;
  ctx.db.tx(() => {
    const pkgs = c.package_id
      ? ctx.db.all<any>("SELECT k.id, k.lot_id, k.status FROM packages k WHERE k.id = ?", c.package_id)
      : ctx.db.all<any>("SELECT k.id, k.lot_id, k.status FROM packages k JOIN lots l ON l.id = k.lot_id JOIN products p ON p.ndc11 = l.ndc11 WHERE p.gtin = ? AND upper(l.lot) = upper(?) AND (? = '' OR k.serial = ?)", c.gtin, c.lot, c.serial ?? "", c.serial ?? "");
    for (const k of pkgs) {
      if (!["on_shelf", "pending_putaway"].includes(k.status)) continue;
      ctx.db.run("UPDATE packages SET status = 'quarantined', location = 'Quarantine Q-1', zone = 'quarantine' WHERE id = ?", k.id);
      ctx.db.run("INSERT INTO lot_events (at, kind, lot_id, package_id, user_name, note) VALUES (?,?,?,?,?,?)", ctx.now(), "Quarantined", k.lot_id, k.id, actor.name, `Suspect product case ${id}`);
      moved++;
    }
    ctx.db.run("UPDATE suspect_cases SET status = 'quarantined' WHERE id = ?", id);
  });
  audit(ctx, actor, "dscsa.case_quarantine", "suspect_case", id, { status: c.status }, { status: "quarantined", units: moved });
  return caseView(ctx, id);
}

export function closeCase(ctx: Ctx, actor: Actor, id: number, status: "closed_cleared" | "closed_confirmed", note: string) {
  const c = ctx.db.get<any>("SELECT * FROM suspect_cases WHERE id = ?", id);
  if (!c) throw new HttpError(404, "Unknown case.");
  if (c.status.startsWith("closed")) throw new HttpError(409, "This case is already closed.", "closed");
  const p = ctx.db.get<{ ndc11: string }>("SELECT ndc11 FROM products WHERE gtin = ?", c.gtin);
  // rule 8: a recalled lot stays blocked, even when its suspect case is closed as cleared
  if (status === "closed_cleared" && (c.recall_id || (p && activeRecallFor(ctx, p.ndc11, c.lot)))) throw new HttpError(409, "This lot is in a confirmed recall. A recalled lot stays blocked, so the case cannot be cleared.", "recalled_blocked");
  if (status === "closed_cleared" && !note.trim()) throw new HttpError(422, "Say why the package is cleared.", "reason");
  ctx.db.run("UPDATE suspect_cases SET status = ?, closed_at = ?, closed_by = ?, close_note = ? WHERE id = ?", status, ctx.now(), actor.name, note, id);
  audit(ctx, actor, "dscsa.case_close", "suspect_case", id, { status: c.status }, { status }, note || undefined);
  return caseView(ctx, id);
}

export function listCases(ctx: Ctx) {
  return ctx.db.all<any>("SELECT * FROM suspect_cases ORDER BY id DESC LIMIT 200").map(shapeCase);
}
const shapeCase = (c: any) => ({ id: c.id, openedAt: c.opened_at, openedBy: c.opened_by, source: c.source, verificationId: c.verification_id, recallId: c.recall_id, gtin: c.gtin, lot: c.lot, serial: c.serial, packageId: c.package_id, status: c.status as (typeof CASE_STATUSES)[number], note: c.note, closedAt: c.closed_at, closedBy: c.closed_by, closeNote: c.close_note });

export function caseView(ctx: Ctx, id: number) {
  const row = ctx.db.get<any>("SELECT * FROM suspect_cases WHERE id = ?", id);
  if (!row) throw new HttpError(404, "Unknown case.");
  const c = shapeCase(row);
  const events = traceEvents(ctx, { gtin: c.gtin, lot: c.lot }).events.filter((e) => !c.serial || !e.serial || e.serial === c.serial);
  const verifications = ctx.db.all<any>("SELECT * FROM verification_requests WHERE gtin = ? AND upper(lot) = upper(?) AND (? = '' OR serial = ?) ORDER BY id", c.gtin, c.lot, c.serial ?? "", c.serial ?? "").map(shapeVerification);
  const imported = ctx.db.all<any>("SELECT event_json FROM trace_imports WHERE gtin = ? AND upper(COALESCE(lot,'')) = upper(?) ORDER BY event_at LIMIT 50", c.gtin, c.lot).map((r) => safeJson(r.event_json));
  const product = ctx.db.get<{ name: string; maker: string; ndc10: string }>("SELECT name, maker, ndc10 FROM products WHERE gtin = ?", c.gtin);
  const pkg = c.packageId ? ctx.db.get<{ status: string; location: string }>("SELECT status, location FROM packages WHERE id = ?", c.packageId) : undefined;
  return { ...c, product: product ?? null, package: pkg ?? null, evidence: { events: events.slice(-100), verifications, imported }, draft: caseDraft(ctx, c, product, events, verifications) };
}

/** Plain-text draft for the pharmacist to read. It is text on a screen: nothing is sent, nothing is filed. */
export function caseDraft(ctx: Ctx, c: ReturnType<typeof shapeCase>, product: { name: string; maker: string; ndc10: string } | undefined, events: TraceEvent[], verifications: ReturnType<typeof shapeVerification>[]): string {
  const iso = (ms: number) => new Date(ms).toISOString();
  return [
    "DRAFT, not a filing, nothing is sent",
    SANDBOX_NOTICE,
    "",
    `Suspect product case ${c.id}  (${c.status.replace("_", " ")})`,
    `Opened ${iso(c.openedAt)} by ${c.openedBy}, from ${c.source === "recall" ? `confirmed recall ${c.recallId}` : "a failed verification"}`,
    "",
    "Package",
    `  Product: ${product ? `${product.name} (NDC ${product.ndc10}, ${product.maker})` : "unknown to this store"}`,
    `  GTIN: ${c.gtin}`,
    `  Lot: ${c.lot}`,
    `  Serial: ${c.serial ?? "not recorded"}`,
    c.recallId ? `  Recall: ${c.recallId} (the lot stays blocked)` : "",
    "",
    "Verification responses (sandbox)",
    ...(verifications.length ? verifications.map((v) => `  #${v.id} ${iso(v.at)} ${v.result.replace("_", " ")}: ${v.response?.message ?? v.reason}`) : ["  none on record"]),
    "",
    "Ledger events",
    ...(events.length ? events.slice(-20).map((e) => `  ${iso(e.at)} ${e.kind}${e.hold ? ` (${e.hold})` : ""}${e.inferred ? " [inferred serial]" : ""}`) : ["  none on record"]),
    "",
    `Pharmacist note: ${c.note || "none"}`,
    "",
    "This draft is for a pharmacist to read and decide on. Chimera Rx does not file, send or submit it, and makes no compliance claim."
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

// ------------------------------------------------------------------ recall tie-in and lot trace (MCP)

/** Every ledger event for the confirmed recalled lots of one recall, with patient ids (never names) on dispensing events. */
export function recallTrace(ctx: Ctx, actor: Actor, recallId: string) {
  const r = ctx.db.get<any>("SELECT id FROM recalls WHERE id = ?", recallId);
  if (!r) throw new HttpError(404, "Unknown recall.");
  const lots = ctx.db.all<any>("SELECT lot, ndc11 FROM recall_lots WHERE recall_id = ? AND confirmed_at IS NOT NULL", recallId);
  if (!lots.length) throw new HttpError(409, "No lot of this recall is confirmed yet. Confirm a lot first.", "no_confirmed_lots");
  const lotIds = lots.flatMap((rl) => ctx.db.all<{ id: number }>("SELECT id FROM lots WHERE upper(lot) = upper(?) AND (? = '' OR ndc11 = ?)", rl.lot, rl.ndc11 ?? "", rl.ndc11 ?? "").map((x) => x.id));
  const out = exportDocument(ctx, actor, { lotIds: [...new Set(lotIds)], includePatients: true }, { "chimera:recallId": recallId, "chimera:purpose": "Recall trace. Patient ids only, never names." });
  audit(ctx, actor, "epcis.export", "recall", recallId, undefined, { events: out.count, patients: true, lots: lots.length });
  return out;
}

/** Read-only: the EPCIS events of one lot. Used by the MCP tool lot_trace; no patient ids. */
export function lotTrace(ctx: Ctx, ndc11: string, lot: string, limit = 200) {
  const lotIds = ctx.db.all<{ id: number }>("SELECT id FROM lots WHERE ndc11 = ? AND upper(lot) = upper(?)", ndc11, lot).map((x) => x.id);
  if (!lotIds.length) return { lot, found: false, events: 0, document: null };
  const t = traceEvents(ctx, { lotIds });
  const events = t.events.slice(-limit);
  return { lot, found: true, events: events.length, truncated: t.truncated || t.events.length > limit, document: buildEpcisDocument(events, { creationDate: ctx.now() }) };
}

// ------------------------------------------------------------------ routes

export function registerEpcisRoutes(app: FastifyInstance, ctx: Ctx) {
  const A = (req: FastifyRequest): Actor => req.actor!;
  const only = (req: FastifyRequest, ...roles: Actor["role"][]) => {
    if (!roles.includes(A(req).role)) throw new HttpError(403, `A ${A(req).role} cannot do that.`, "forbidden");
  };
  const id = (req: FastifyRequest) => Number((req.params as { id: string }).id);

  app.get("/api/epcis/export", async (req, reply) => {
    only(req, "pharmacist", "technician");
    const q = exportQuery.parse(req.query);
    if (q.patients === "1") only(req, "pharmacist");
    const out = exportDocument(ctx, A(req), { from: q.from, to: q.to, lot: q.lot, gtin: q.gtin, includePatients: q.patients === "1" });
    audit(ctx, A(req), "epcis.export", "epcis", "ledger", undefined, { filters: { from: q.from, to: q.to, lot: q.lot, gtin: q.gtin }, events: out.count, patients: q.patients === "1" });
    return reply.type("application/ld+json").header("Content-Disposition", 'attachment; filename="chimera-rx-epcis-sandbox.jsonld"').send(JSON.stringify(out.doc, null, 2));
  });
  app.get("/api/recalls/:id/trace-export", async (req, reply) => {
    only(req, "pharmacist");
    const rid = (req.params as { id: string }).id;
    const out = recallTrace(ctx, A(req), rid);
    return reply.type("application/ld+json").header("Content-Disposition", `attachment; filename="recall-${rid.replace(/[^A-Za-z0-9-]/g, "")}-trace-sandbox.jsonld"`).send(JSON.stringify(out.doc, null, 2));
  });
  app.post("/api/epcis/import", async (req) => {
    const b = z.object({ document: z.unknown(), dryRun: z.boolean().default(true), label: z.string().max(80).optional() }).parse(req.body);
    only(req, "pharmacist", "technician");
    if (!b.dryRun) only(req, "pharmacist");
    return importEpcis(ctx, A(req), b.document, { commit: !b.dryRun, label: b.label });
  });
  app.get("/api/epcis/imports", async (req) => { only(req, "pharmacist", "technician"); return { imports: listImports(ctx) }; });

  app.post("/api/dscsa/verify", async (req) => { only(req, "pharmacist", "technician"); return verifyProduct(ctx, A(req), verifyBody.parse(req.body)); });
  app.get("/api/dscsa/verifications", async (req) => { only(req, "pharmacist", "technician"); return { verifications: listVerifications(ctx) }; });
  app.get("/api/dscsa/cases", async (req) => { only(req, "pharmacist", "technician"); return { cases: listCases(ctx) }; });
  app.get("/api/dscsa/cases/:id", async (req) => { only(req, "pharmacist", "technician"); return caseView(ctx, id(req)); });
  app.post("/api/dscsa/cases", async (req) => { only(req, "pharmacist"); return openCase(ctx, A(req), caseBody.parse(req.body)); });
  app.post("/api/dscsa/cases/:id/quarantine", async (req) => { only(req, "pharmacist"); return quarantineCase(ctx, A(req), id(req)); });
  app.post("/api/dscsa/cases/:id/close", async (req) => {
    only(req, "pharmacist");
    const b = z.object({ status: z.enum(["closed_cleared", "closed_confirmed"]), note: z.string().max(500).default("") }).parse(req.body);
    return closeCase(ctx, A(req), id(req), b.status, b.note);
  });
}
