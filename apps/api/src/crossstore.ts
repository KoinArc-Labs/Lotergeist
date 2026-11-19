import { activeRecallFor, audit, ensureLot, HttpError, lotEvent, type Actor, type Ctx } from "./core";
import { suggestLocation } from "./domain";

/**
 * What crosses between the two stores, and nothing else (FR4.3, Q4):
 *  - a pharmacist can move on-shelf packages to the other store; each package keeps its lot and serial;
 *  - a recall confirmed in one store is mirrored to the other, so the lot is blocked at receiving, fill, the register
 *    and transfers in both. Each store still lists only its own units and patients.
 */

export function otherStores(ctx: Ctx, actor: Actor): { id: string; name: string }[] {
  const reg = ctx.stores;
  if (!reg) return [];
  return reg.others(actor.storeId).map((id) => reg.run(id, () => ctx.db.get<{ id: string; name: string }>("SELECT id, name FROM stores")!));
}

export interface TransferInput { toStore: string; lotId: number; qty: number }

export function transferPackages(ctx: Ctx, actor: Actor, input: TransferInput) {
  const reg = ctx.stores;
  if (!reg) throw new HttpError(501, "Only one store is set up.", "single_store");
  if (actor.role !== "pharmacist") throw new HttpError(403, "Only a pharmacist can move stock between stores.", "forbidden");
  if (!reg.others(actor.storeId).includes(input.toStore)) throw new HttpError(422, "Choose the other store.", "bad_store");
  if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > 100) throw new HttpError(422, "Move 1 to 100 packages.", "bad_qty");
  const lot = ctx.db.get<any>("SELECT l.*, p.ndc10, p.name, p.storage FROM lots l JOIN products p ON p.ndc11 = l.ndc11 WHERE l.id = ?", input.lotId);
  if (!lot) throw new HttpError(404, "Unknown lot.");
  // Recalled or quarantined stock never leaves (FR4.3); the same rule blocks a lot recalled in either store.
  if (lot.status === "recalled" || activeRecallFor(ctx, lot.ndc11, lot.lot)) throw new HttpError(409, `Lot ${lot.lot} is in a recall and cannot be moved.`, "recalled");
  const pkgs = ctx.db.all<any>("SELECT * FROM packages WHERE lot_id = ? AND status = 'on_shelf' ORDER BY id LIMIT ?", lot.id, input.qty);
  if (pkgs.length < input.qty) throw new HttpError(409, `Only ${pkgs.length} package${pkgs.length === 1 ? "" : "s"} of lot ${lot.lot} are on the shelf.`, "not_enough");
  const dest = reg.db(input.toStore).get<{ name: string }>("SELECT name FROM stores");
  const from = ctx.db.get<{ name: string }>("SELECT name FROM stores WHERE id = ?", actor.storeId)?.name ?? actor.storeId;
  const note = (dir: string, other: string) => `${dir} ${other} · ${pkgs.length} units`;

  // Check the destination first, so a refusal there leaves the source untouched.
  reg.run(input.toStore, () => {
    if (activeRecallFor(ctx, lot.ndc11, lot.lot)) throw new HttpError(409, `Lot ${lot.lot} is in a recall at ${dest?.name}, so it cannot be moved there.`, "recalled");
    if (!ctx.db.get("SELECT 1 FROM products WHERE ndc11 = ?", lot.ndc11)) throw new HttpError(409, `${dest?.name} does not stock ${lot.name}.`, "no_product");
  });
  reg.run(input.toStore, () => ctx.db.tx(() => {
    const lotId = ensureLot(ctx, lot.ndc11, lot.lot, lot.expiry);
    const loc = suggestLocation({ ndc11: lot.ndc11, name: lot.name, storage: lot.storage });
    const who = { ...actor, storeId: input.toStore };
    for (const k of pkgs) {
      const have = ctx.db.get<{ id: number }>("SELECT id FROM packages WHERE gtin = ? AND serial = ?", k.gtin, k.serial);
      let id: number;
      if (have) { id = have.id; ctx.db.run("UPDATE packages SET status = 'on_shelf', lot_id = ?, location = ?, zone = ?, note = NULL WHERE id = ?", lotId, loc.location, loc.zone, id); }
      else id = Number(ctx.db.run("INSERT INTO packages (serial, lot_id, gtin, expiry, location, zone, status, delivery_id, received_at, received_by, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        k.serial, lotId, k.gtin, k.expiry, loc.location, loc.zone, "on_shelf", null, ctx.now(), actor.name, `Transferred from ${from}`).lastInsertRowid);
      lotEvent(ctx, "Transfer in", lotId, actor.name, `From ${from}`, id);
    }
    audit(ctx, who, "stock.transfer_in", "lot", lotId, undefined, { lot: lot.lot, units: pkgs.length, from });
  }));
  ctx.db.tx(() => {
    for (const k of pkgs) {
      ctx.db.run("UPDATE packages SET status = 'adjusted', note = ? WHERE id = ?", `Transferred to ${dest?.name}`, k.id);
      lotEvent(ctx, "Transfer out", lot.id, actor.name, `To ${dest?.name}`, k.id);
    }
    audit(ctx, actor, "stock.transfer_out", "lot", lot.id, undefined, { lot: lot.lot, units: pkgs.length, to: dest?.name });
  });
  return { moved: pkgs.length, lot: lot.lot, product: lot.name, from, to: dest?.name ?? input.toStore, serials: pkgs.map((k) => k.serial), summary: note("To", dest?.name ?? "") };
}

/** Mirror a recall confirmed here into the other store(s), then quarantine what that store holds of the lots. */
export function propagateRecall(ctx: Ctx, recallId: string, quarantine: (ctx: Ctx, actor: Actor | null, recallId: string) => number) {
  const reg = ctx.stores;
  if (!reg) return;
  const me = reg.current;
  const r = ctx.db.get<any>("SELECT * FROM recalls WHERE id = ?", recallId);
  if (!r || r.source === "other-store") return;
  const lots = ctx.db.all<any>("SELECT * FROM recall_lots WHERE recall_id = ? AND confirmed_at IS NOT NULL", recallId);
  if (!lots.length) return;
  const fromName = ctx.db.get<{ name: string }>("SELECT name FROM stores WHERE id = ?", me)?.name ?? me;
  for (const other of reg.others(me)) {
    reg.run(other, () => {
      const now = ctx.now();
      if (!ctx.db.get("SELECT 1 FROM recalls WHERE id = ?", recallId)) {
        ctx.db.run(
          `INSERT INTO recalls (id, step, status, classification, level, reason, firm, initiated, product, code_info, product_description, raw_json, source, fax_text, created_at, created_by, cached)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          recallId, "impact", "reviewing", r.classification, r.level, r.reason, r.firm, r.initiated, r.product, r.code_info, r.product_description, r.raw_json, "other-store", null, now, `Confirmed at ${fromName}`, r.cached);
      }
      for (const l of lots) {
        ctx.db.run("INSERT OR IGNORE INTO recall_lots (recall_id, lot, ndc11, expiry, confidence, source, confirmed_by, confirmed_at) VALUES (?,?,?,?,?,?,?,?)",
          recallId, l.lot, l.ndc11, l.expiry, l.confidence, "other-store", `Confirmed at ${fromName}`, now);
      }
      audit(ctx, null, "recall.mirrored", "recall", recallId, undefined, { from: fromName, lots: lots.map((l) => l.lot) });
      quarantine(ctx, null, recallId);
    });
  }
}
