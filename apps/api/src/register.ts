import { audit, HttpError, type Actor, type Ctx } from "./core";
import { sell } from "./fill";

/**
 * Front-store register (FR3, US4.1 to US4.3). One sale can mix over-the-counter items and a patient's verified
 * prescriptions. Prescriptions go through the existing pickup checks and `sell()`; nothing here processes payment:
 * "paid" is a label. Over-the-counter items are not tracked in stock (Q3): the register only records the sale.
 * A cashier never sees allergies or date of birth.
 */

export const OTC_ITEMS: { upc: string; name: string; price: number }[] = [
  { upc: "036000291452", name: "Acetaminophen 500 mg · 100 ct", price: 899 },
  { upc: "036000291469", name: "Ibuprofen 200 mg · 100 ct", price: 949 },
  { upc: "036000291476", name: "Loratadine 10 mg · 30 ct", price: 1299 },
  { upc: "036000291483", name: "Cetirizine 10 mg · 45 ct", price: 1449 },
  { upc: "036000291490", name: "Antacid chewables · 96 ct", price: 749 },
  { upc: "036000291506", name: "Cough drops, honey lemon · 80 ct", price: 399 },
  { upc: "036000291513", name: "Adhesive bandages · 100 ct", price: 549 },
  { upc: "036000291520", name: "Hand sanitizer 8 oz", price: 349 },
  { upc: "036000291537", name: "Vitamin D3 2000 IU · 120 ct", price: 1199 },
  { upc: "036000291544", name: "Saline nasal spray 1.5 oz", price: 599 },
  { upc: "036000291551", name: "Digital thermometer", price: 1599 },
  { upc: "036000291568", name: "Sunscreen SPF 50 · 3 oz", price: 1099 }
];

/** Synthetic copay, the same for every prescription: there is no payer or price data in the demo. */
export const RX_COPAY_CENTS = 1000;

const need = (actor: Actor) => { if (actor.role !== "cashier" && actor.role !== "pharmacist") throw new HttpError(403, `A ${actor.role} cannot use the register.`, "forbidden"); };
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function seedOtc(ctx: Ctx) {
  for (const i of OTC_ITEMS) ctx.db.run("INSERT OR IGNORE INTO otc_items (upc, name, price_cents) VALUES (?,?,?)", i.upc, i.name, i.price);
}

/** Scan a retail UPC (USB scanner or webcam) or search by name (US4.1, Q6). */
export function findItems(ctx: Ctx, actor: Actor, q: string) {
  need(actor);
  seedOtc(ctx);
  const t = q.trim();
  if (!t) return ctx.db.all<{ upc: string; name: string; price_cents: number }>("SELECT * FROM otc_items ORDER BY name LIMIT 30");
  if (/^\d{8,14}$/.test(t)) {
    const hit = ctx.db.all<any>("SELECT * FROM otc_items WHERE upc = ? OR upc = ?", t, t.padStart(12, "0"));
    if (hit.length) return hit;
  }
  return ctx.db.all<any>("SELECT * FROM otc_items WHERE name LIKE ? ORDER BY name LIMIT 30", `%${t.replace(/[%_]/g, "")}%`);
}

/** A patient's prescriptions: only what the cashier needs. No allergies, no date of birth (US4.2). */
export function readyForPatient(ctx: Ctx, actor: Actor, patientId: string) {
  need(actor);
  const p = ctx.db.get<{ id: string; name: string }>("SELECT id, name FROM patients WHERE id = ?", patientId);
  if (!p) throw new HttpError(404, "Unknown patient.");
  const rows = ctx.db.all<any>(
    `SELECT d.id AS dispense_id, d.state, r.rx, r.drug, l.status AS lot_status
     FROM dispenses d JOIN prescriptions r ON r.id = d.rx_id LEFT JOIN packages k ON k.id = d.package_id LEFT JOIN lots l ON l.id = k.lot_id
     WHERE r.patient_id = ? AND d.state IN ('filled','verified') ORDER BY d.id`, patientId);
  return {
    patient: p,
    prescriptions: rows.map((r) => ({
      dispenseId: r.dispense_id, rx: r.rx, drug: r.drug, copayCents: RX_COPAY_CENTS,
      blocked: r.lot_status === "recalled" ? "This package is from a recalled lot." : r.state !== "verified" ? "A pharmacist has not verified this fill yet." : null
    }))
  };
}

export interface SaleInput { patientId?: string; items: { upc: string; qty: number }[]; dispenseIds: number[]; idChecked?: boolean; counseled?: boolean; signature?: boolean }

export function completeSale(ctx: Ctx, actor: Actor, input: SaleInput) {
  need(actor);
  seedOtc(ctx);
  if (!input.items.length && !input.dispenseIds.length) throw new HttpError(422, "The sale is empty.", "empty_sale");
  const lines: { kind: "otc" | "rx"; upc?: string; dispenseId?: number; name: string; qty: number; price: number; rx?: string }[] = [];
  for (const it of input.items) {
    const o = ctx.db.get<{ upc: string; name: string; price_cents: number }>("SELECT * FROM otc_items WHERE upc = ?", it.upc);
    if (!o) throw new HttpError(422, `Unknown item ${it.upc}.`, "unknown_item");
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 20) throw new HttpError(422, `Quantity for ${o.name} must be 1 to 20.`, "bad_qty");
    lines.push({ kind: "otc", upc: o.upc, name: o.name, qty: it.qty, price: o.price_cents });
  }
  // Check every prescription line before anything is written, so a blocked line never leaves a half-finished sale (FR3.5).
  if (input.dispenseIds.length) {
    if (!input.patientId) throw new HttpError(422, "Choose the patient before adding prescriptions.", "patient_required");
    if (!input.idChecked || !input.counseled || !input.signature) throw new HttpError(422, "Photo ID, counseling offer and signature are all required for prescriptions.", "pickup_checklist");
    const ready = readyForPatient(ctx, actor, input.patientId).prescriptions;
    for (const id of new Set(input.dispenseIds)) {
      const r = ready.find((x) => x.dispenseId === id);
      if (!r) throw new HttpError(409, `Fill ${id} is not ready for this patient.`, "not_ready");
      if (r.blocked) throw new HttpError(409, `Rx ${r.rx} (${r.drug}) cannot be sold: ${r.blocked}`, "blocked_line");
      lines.push({ kind: "rx", dispenseId: id, name: r.drug, qty: 1, price: RX_COPAY_CENTS, rx: r.rx });
    }
  }
  const at = ctx.now();
  const total = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const done: Record<number, { lot: string; serial: string; rx: string }> = {};
  let saleId = 0;
  ctx.db.tx(() => {
    for (const l of lines.filter((x) => x.kind === "rx")) {
      const s = sell(ctx, actor, l.dispenseId!, { idChecked: true, counseled: true, signature: true });
      done[l.dispenseId!] = { lot: s.lot, serial: s.serial, rx: s.rx };
    }
    saleId = Number(ctx.db.run("INSERT INTO sales (at, cashier, store_id, patient_id, status, total_cents) VALUES (?,?,?,?,?,?)", at, actor.name, actor.storeId, input.patientId ?? null, "paid", total).lastInsertRowid);
    for (const l of lines) {
      const d = l.dispenseId ? done[l.dispenseId] : undefined;
      ctx.db.run("INSERT INTO sale_lines (sale_id, kind, upc, dispense_id, name, qty, price_cents, rx, lot, serial) VALUES (?,?,?,?,?,?,?,?,?,?)", saleId, l.kind, l.upc ?? null, l.dispenseId ?? null, l.name, l.qty, l.price, l.rx ?? null, d?.lot ?? null, d?.serial ?? null);
    }
    audit(ctx, actor, "register.sale", "sale", saleId, undefined, { lines: lines.length, total, rx: lines.filter((x) => x.kind === "rx").length });
  });
  return receipt(ctx, saleId);
}

export function receipt(ctx: Ctx, saleId: number) {
  const s = ctx.db.get<any>("SELECT * FROM sales WHERE id = ?", saleId)!;
  const store = ctx.db.get<{ name: string }>("SELECT name FROM stores WHERE id = ?", s.store_id);
  const lines = ctx.db.all<any>("SELECT * FROM sale_lines WHERE sale_id = ? ORDER BY id", saleId);
  return {
    saleId, at: s.at, store: store?.name ?? "", cashier: s.cashier, status: "paid" as const, note: "Marked paid. No payment was processed (demo).",
    totalCents: s.total_cents, total: money(s.total_cents),
    lines: lines.map((l) => ({ kind: l.kind, name: l.name, qty: l.qty, priceCents: l.price_cents, rx: l.rx ?? undefined, lot: l.lot ?? undefined, serial: l.serial ?? undefined }))
  };
}

/** Patient picker for the register: id and name only, so a cashier never reaches clinical fields. */
export function findPatients(ctx: Ctx, actor: Actor, q: string) {
  need(actor);
  const t = q.trim().replace(/[%_]/g, "");
  if (t.length < 2) return [];
  return ctx.db.all<{ id: string; name: string }>("SELECT id, name FROM patients WHERE name LIKE ? OR id LIKE ? ORDER BY name LIMIT 10", `%${t}%`, `%${t}%`);
}
