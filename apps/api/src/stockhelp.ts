import fs from "node:fs";
import path from "node:path";
import { audit, HttpError, todayIso, type Actor, type Ctx } from "./core";
import { DAY } from "./domain";

/**
 * AI stock help (FR8, US3.1 to US3.4). Every suggestion comes from a rule with its numbers shown. An LLM, when one is
 * configured, only adds a plain-words explanation; it never changes a number (FR8.4). The pharmacist decides: accepting
 * or dismissing is recorded, and nothing is ordered, moved or changed automatically (pharmacy-safety.md rules 3 and 6).
 */

const WINDOW_DAYS = 28;
const COVER_WEEKS = 2;

export interface Reorder { key: string; product: string; ndc11: string; onHand: number; fills4w: number; weeklyRate: number; reorderPoint: number; target: number; suggestedQty: number; reason: string; decision: string | null; explanation?: string }
export interface ExpiryRisk { key: string; product: string; lot: string; expiry: string; onHand: number; dailyRate: number; daysToUse: number | null; daysToExpiry: number; reason: string; decision: string | null; explanation?: string }
export interface Shortage { key: string; product: string; ndc11: string; status: string; generic: string; source: "openfda" | "cached"; synthetic: boolean; reason: string; decision: string | null }

const dayStart = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function reorderSuggestions(ctx: Ctx): Reorder[] {
  const now = dayStart(todayIso(ctx)) + DAY;
  const since = now - WINDOW_DAYS * DAY;
  const rows = ctx.db.all<any>(
    `SELECT p.ndc11, p.name, p.reorder_point,
       (SELECT count(*) FROM packages k JOIN lots l ON l.id = k.lot_id WHERE l.ndc11 = p.ndc11 AND k.status = 'on_shelf' AND l.status <> 'recalled') AS on_hand,
       (SELECT count(*) FROM dispenses d JOIN prescriptions r ON r.id = d.rx_id WHERE r.ndc11 = p.ndc11 AND d.state = 'sold' AND d.sold_at >= ?) AS fills
     FROM products p`, since);
  const out: Reorder[] = [];
  for (const r of rows) {
    const weekly = r.fills / (WINDOW_DAYS / 7);
    const target = Math.max(r.reorder_point, Math.ceil(weekly * COVER_WEEKS));
    if (r.on_hand >= target) continue;
    const qty = target - r.on_hand;
    out.push({
      key: r.ndc11, product: r.name, ndc11: r.ndc11, onHand: r.on_hand, fills4w: r.fills, weeklyRate: +weekly.toFixed(1), reorderPoint: r.reorder_point, target, suggestedQty: qty,
      reason: `${r.on_hand} on hand; ${r.fills} fills in the last 4 weeks (${weekly.toFixed(1)} a week); aim for ${COVER_WEEKS} weeks of cover or the reorder point ${r.reorder_point}, whichever is higher (${target}); order ${qty}.`,
      decision: null
    });
  }
  return out.sort((a, b) => b.suggestedQty - a.suggestedQty);
}

export function expiryRisks(ctx: Ctx): ExpiryRisk[] {
  const today = dayStart(todayIso(ctx));
  const since = today + DAY - WINDOW_DAYS * DAY;
  const out: ExpiryRisk[] = [];
  const lots = ctx.db.all<any>(
    `SELECT l.id, l.lot, l.expiry, l.ndc11, p.name,
       (SELECT count(*) FROM packages k WHERE k.lot_id = l.id AND k.status = 'on_shelf') AS on_hand,
       (SELECT count(*) FROM dispenses d JOIN prescriptions r ON r.id = d.rx_id WHERE r.ndc11 = l.ndc11 AND d.state = 'sold' AND d.sold_at >= ?) AS fills
     FROM lots l JOIN products p ON p.ndc11 = l.ndc11 WHERE l.status <> 'recalled'`, since);
  for (const l of lots) {
    if (!l.on_hand || !l.expiry) continue;
    const exp = l.expiry.length === 7 ? dayStart(`${l.expiry}-28`) : dayStart(l.expiry);
    const daysToExpiry = Math.floor((exp - today) / DAY);
    if (daysToExpiry < 0) continue; // already expired: receiving and the return flow handle those
    const daily = l.fills / WINDOW_DAYS;
    const daysToUse = daily > 0 ? Math.ceil(l.on_hand / daily) : null;
    const risky = daysToUse === null ? daysToExpiry <= 90 : daysToUse > daysToExpiry;
    if (!risky) continue;
    out.push({
      key: `${l.ndc11}|${l.lot}`, product: l.name, lot: l.lot, expiry: l.expiry, onHand: l.on_hand, dailyRate: +daily.toFixed(2), daysToUse, daysToExpiry,
      reason: daysToUse === null
        ? `${l.on_hand} on hand, no fills in the last 4 weeks, and the lot expires in ${daysToExpiry} days. Dispense this lot first.`
        : `${l.on_hand} on hand at ${daily.toFixed(2)} fills a day takes about ${daysToUse} days to use; the lot expires in ${daysToExpiry} days. Dispense this lot first.`,
      decision: null
    });
  }
  return out.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
}

// ---- shortages (FR8.3): openFDA drug shortages when online, a cached copy when offline

interface ShortageRec { package_ndc: string[]; status: string; generic_name: string; synthetic?: boolean }

async function loadShortages(ctx: Ctx): Promise<{ recs: ShortageRec[]; source: "openfda" | "cached" }> {
  const cacheFile = path.join(ctx.cfg.dataDir, "shortages-cache.json");
  const fixture = path.join(ctx.cfg.fixturesDir, "shortages.json");
  if (process.env.OFFLINE !== "1") {
    try {
      const u = new URL("https://api.fda.gov/drug/shortages.json");
      u.searchParams.set("search", "status:\"Current\"");
      u.searchParams.set("limit", "1000");
      if (ctx.cfg.openfdaKey) u.searchParams.set("api_key", ctx.cfg.openfdaKey);
      const res = await fetch(u, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const recs = ((await res.json()) as { results?: any[] }).results?.map((r) => ({ package_ndc: r.openfda?.package_ndc ?? [], status: r.status ?? "Current", generic_name: r.generic_name ?? "" })) ?? [];
        fs.mkdirSync(ctx.cfg.dataDir, { recursive: true });
        fs.writeFileSync(cacheFile, JSON.stringify(recs));
        return { recs, source: "openfda" };
      }
    } catch { /* fall through to the cache */ }
  }
  const read = (f: string) => (fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as ShortageRec[]) : []);
  return { recs: [...read(cacheFile), ...read(fixture)], source: "cached" };
}

export async function shortageFlags(ctx: Ctx): Promise<Shortage[]> {
  const { recs, source } = await loadShortages(ctx);
  const products = ctx.db.all<any>("SELECT ndc11, ndc10, name FROM products");
  const out: Shortage[] = [];
  for (const p of products) {
    const hit = recs.find((r) => r.status === "Current" && r.package_ndc.some((n) => n.replace(/-/g, "").padStart(11, "0") === p.ndc11 || n.replace(/-/g, "") === p.ndc10.replace(/-/g, "")));
    if (!hit) continue;
    out.push({
      key: p.ndc11, product: p.name, ndc11: p.ndc11, status: hit.status, generic: hit.generic_name, source: hit.synthetic ? "cached" : source, synthetic: !!hit.synthetic,
      reason: `${hit.synthetic ? "Synthetic demo record: " : ""}openFDA drug shortages lists this product's NDC as "${hit.status}"${source === "cached" || hit.synthetic ? " (from the cached copy: no internet or demo data)" : ""}. Check supply before promising a fill date.`,
      decision: null
    });
  }
  return out;
}

// ---- decisions and the view

function withDecisions<T extends { key: string; decision: string | null }>(ctx: Ctx, kind: string, list: T[]): T[] {
  for (const x of list) x.decision = ctx.db.get<{ decision: string }>("SELECT decision FROM stock_decisions WHERE kind = ? AND item_key = ?", kind, x.key)?.decision ?? null;
  return list;
}

/** Plain-words explanation from the LLM, when there is one. Numbers are never taken from it (FR8.4). Best effort. */
async function explain(ctx: Ctx, items: { reason: string; explanation?: string }[]) {
  if (!ctx.llm) return;
  const system = "You explain pharmacy stock suggestions to a pharmacist in one short plain sentence. Use only the facts and numbers given. Never add or change a number. No clinical advice.";
  await Promise.all(items.slice(0, 8).map(async (it) => {
    try { it.explanation = (await ctx.llm!.complete(system, it.reason)).trim().slice(0, 300); } catch { /* the rule's reason is shown instead */ }
  }));
}

export async function stockHelp(ctx: Ctx, actor: Actor) {
  if (actor.role !== "pharmacist" && actor.role !== "technician") throw new HttpError(403, `A ${actor.role} cannot see stock suggestions.`, "forbidden");
  const reorder = withDecisions(ctx, "reorder", reorderSuggestions(ctx));
  const expiry = withDecisions(ctx, "expiry", expiryRisks(ctx));
  const shortages = withDecisions(ctx, "shortage", await shortageFlags(ctx));
  await explain(ctx, [...reorder, ...expiry]);
  return {
    advisory: "Advice only. Nothing is ordered, moved or changed automatically; a pharmacist decides.",
    llm: ctx.llm?.name ?? null,
    canAct: actor.role === "pharmacist",
    reorder, expiry, shortages
  };
}

export function decide(ctx: Ctx, actor: Actor, b: { kind: "reorder" | "expiry" | "shortage"; key: string; decision: "accepted" | "dismissed" }) {
  if (actor.role !== "pharmacist") throw new HttpError(403, "Only a pharmacist can accept or dismiss a stock suggestion.", "forbidden");
  ctx.db.run("INSERT INTO stock_decisions (kind, item_key, decision, by, at) VALUES (?,?,?,?,?) ON CONFLICT(kind, item_key) DO UPDATE SET decision = excluded.decision, by = excluded.by, at = excluded.at", b.kind, b.key, b.decision, actor.name, ctx.now());
  audit(ctx, actor, `stock.${b.decision}`, "stock-suggestion", `${b.kind}:${b.key}`);
  return { ok: true };
}
