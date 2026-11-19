import { z } from "zod";
import type { Ctx } from "../core";
import { expiryRisks, shortageFlags } from "../stockhelp";
import { findPhi, numbersIn, parseJsonObject, registerAgent, type AgentResult, type Dropped, type LlmCall } from "./agent";

/**
 * Night Watch. Core: an overnight digest of open recalls, shortages, expiring lots and held orders, all from SQL and rules.
 * Advisory: the model writes the two-sentence summary. Gate: every number in the summary must exist in the digest, no patient
 * data, and no claim that anything was confirmed, sent or ordered. Night Watch never auto-confirms a lot.
 */

const SYSTEM = `You write the overnight digest summary for a pharmacist. Facts are in <digest>; use only those facts and numbers.
Return ONLY JSON: {"summary": string}. Two or three plain sentences. Do not claim anything was confirmed, sent, ordered or fixed.
Do not give clinical advice. Patients appear only as IDs.`;

const CLAIM = /\b(confirmed|sent|ordered|approved|placed|fixed|resolved|quarantined)\b/i;
const NEGATED = /\b(nothing|no|not|never|n't|until|before|without|awaits?|waiting)\b/i;

export async function buildDigest(ctx: Ctx) {
  const recalls = ctx.db.all<{ id: string; status: string; product: string }>("SELECT id, status, product_description AS product FROM recalls WHERE status <> 'closed' ORDER BY created_at")
    .map((r) => ({
      id: r.id, status: r.status, product: r.product.split(",")[0]!.slice(0, 80),
      unconfirmedLots: ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM recall_lots WHERE recall_id = ? AND confirmed_at IS NULL", r.id)!.n
    }));
  const shortages = (await shortageFlags(ctx)).map((s) => ({ product: s.product.split(" · ")[0]!, status: s.status }));
  const expiring = expiryRisks(ctx).slice(0, 10).map((e) => ({ product: e.product.split(" · ")[0]!, lot: e.lot, onHand: e.onHand, daysToExpiry: e.daysToExpiry }));
  const held = ctx.db.all<{ rx: string; patient_id: string; review: string; drug: string }>("SELECT rx, patient_id, review, drug FROM prescriptions WHERE status = 'to_fill' AND review IN ('pending','on_hold') ORDER BY rx")
    .map((h) => ({ rx: h.rx, patient: h.patient_id, review: h.review, drug: h.drug.split(" · ")[0]! }));
  const counts = { newRecalls: recalls.length, shortages: shortages.length, expiringLots: expiring.length, heldOrders: held.length };
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const summary = `Overnight: ${plural(counts.newRecalls, "open recall")}${recalls.some((r) => r.unconfirmedLots) ? ` (${recalls.reduce((a, r) => a + r.unconfirmedLots, 0)} lot(s) await a pharmacist's confirmation)` : ""}, ${plural(counts.shortages, "shortage")} on products you stock, ${plural(counts.expiringLots, "lot")} at risk of expiring unused, ${plural(counts.heldOrders, "order")} held for review. Nothing was confirmed or sent; a pharmacist decides each item.`;
  return { counts, recalls, shortages, expiring, held, summary };
}

/** Sentences that claim an action happened (without a negation) are not allowed. */
export function claimsAction(text: string): boolean {
  return text.split(/(?<=[.!?])\s+/).some((s) => CLAIM.test(s) && !NEGATED.test(s));
}

registerAgent({
  id: "night-watch",
  name: "Night Watch",
  purpose: "Overnight digest of new recalls, shortages, expiring lots and held orders. It reads and reports; it never confirms a lot or sends anything.",
  roles: ["pharmacist", "admin"],
  guardrails: [
    "The digest is built from SQL and rules. The model only writes the summary sentence.",
    "Every number in the summary must appear in the digest; a summary with an unknown number is dropped.",
    "A summary that says something was confirmed, sent, ordered or fixed is dropped. Night Watch never auto-confirms a recall lot.",
    "The prompt has product names, lot numbers, Rx numbers and patient IDs only."
  ],
  input: z.object({}).default({}),
  sample: () => ({}),
  async run(ctx: Ctx, _actor, _input, llm: LlmCall): Promise<AgentResult> {
    const d = await buildDigest(ctx);
    const dropped: Dropped[] = [];
    const rules = { counts: d.counts, recalls: d.recalls, shortages: d.shortages, expiring: d.expiring, held: d.held, summary: d.summary };
    let summary = d.summary;
    let source = "rules";
    if (llm.client) {
      const raw = await llm.ask(SYSTEM, `<digest>${JSON.stringify({ counts: d.counts, recalls: d.recalls, shortages: d.shortages, expiring: d.expiring, held: d.held })}</digest>`);
      const obj = parseJsonObject(raw);
      if (raw !== null && !obj) dropped.push({ what: "summary", why: "The answer was not valid JSON; the rule summary is shown." });
      if (obj && typeof obj.summary === "string") {
        const s = obj.summary.trim().slice(0, 700);
        const allowed = new Set(numbersIn(JSON.stringify({ counts: d.counts, recalls: d.recalls, shortages: d.shortages, expiring: d.expiring, held: d.held })));
        const stray = numbersIn(s).find((n) => !allowed.has(n));
        const leak = findPhi(ctx, s);
        if (stray) dropped.push({ what: "summary", why: `Contains the number ${stray}, which is not in the digest.` });
        else if (leak) dropped.push({ what: "summary", why: `Contained ${leak}.` });
        else if (claimsAction(s)) dropped.push({ what: "summary", why: "Claims something was confirmed, sent or ordered. Night Watch only reports." });
        else if (!s) dropped.push({ what: "summary", why: "Empty." });
        else { summary = s; source = "ai"; }
      }
    }
    return { ruleOutput: rules, gatedOutput: { ...rules, summary, source, autoConfirmed: 0 }, dropped };
  }
});
