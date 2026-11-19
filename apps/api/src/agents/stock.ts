import { z } from "zod";
import type { Ctx } from "../core";
import { expiryRisks, reorderSuggestions, shortageFlags } from "../stockhelp";
import { findPhi, numbersIn, parseJsonObject, registerAgent, type AgentResult, type Dropped, type LlmCall } from "./agent";

/**
 * Stock and Shortage Advisor. Core: stockhelp.ts (reorder, expiry risk, shortages) with its numbers. Advisory: one plain sentence
 * per item. Gate: the sentence may not contain a number that is not already in that item; the numbers themselves are never read
 * back from the model.
 */

const SYSTEM = `You explain pharmacy stock suggestions to a pharmacist, one short plain sentence each.
Return ONLY JSON: {"explanations": [{"key": string, "text": string}]}. Use only the facts and numbers in each item's "reason".
Never add, change or round a number. No clinical advice. Do not tell anyone to order or move stock; the suggestion already says so.`;

registerAgent({
  id: "stock-advisor",
  name: "Stock and Shortage Advisor",
  purpose: "Explains reorder, expiry-risk and shortage suggestions in plain words. The numbers come from rules and never change.",
  roles: ["pharmacist", "technician"],
  guardrails: [
    "Every suggestion and every number comes from the stock rules (stockhelp.ts).",
    "An explanation with a number that is not in its item is dropped, and the rule's own reason is shown.",
    "Nothing is ordered, moved or changed. A pharmacist accepts or dismisses suggestions on the Stock help screen.",
    "The prompt has product names, lot numbers and counts. No patient data."
  ],
  input: z.object({}).default({}),
  sample: () => ({}),
  async run(ctx: Ctx, _actor, _input, llm: LlmCall): Promise<AgentResult> {
    const reorder = reorderSuggestions(ctx).slice(0, 8);
    const expiry = expiryRisks(ctx).slice(0, 8);
    const shortages = (await shortageFlags(ctx)).slice(0, 8);
    const items = [
      ...reorder.map((r) => ({ kind: "reorder", key: r.key, product: r.product, reason: r.reason, suggestedQty: r.suggestedQty })),
      ...expiry.map((e) => ({ kind: "expiry", key: e.key, product: e.product, reason: e.reason, lot: e.lot })),
      ...shortages.map((s) => ({ kind: "shortage", key: s.key, product: s.product, reason: s.reason }))
    ];
    const dropped: Dropped[] = [];
    const explained = new Map<string, string>();

    if (llm.client && items.length) {
      const raw = await llm.ask(SYSTEM, JSON.stringify({ items: items.map((i) => ({ key: i.key, product: i.product, reason: i.reason })) }));
      const obj = parseJsonObject(raw);
      if (raw !== null && !obj) dropped.push({ what: "explanations", why: "The answer was not valid JSON; the rule reasons are shown." });
      for (const e of Array.isArray(obj?.explanations) ? obj.explanations : []) {
        const item = items.find((i) => i.key === e?.key);
        const text = typeof e?.text === "string" ? e.text.trim() : "";
        if (!item) { dropped.push({ what: `explanation for "${String(e?.key).slice(0, 30)}"`, why: "No such suggestion." }); continue; }
        if (!text || text.length > 300) { dropped.push({ what: `explanation for ${item.product}`, why: "Empty or too long." }); continue; }
        const allowed = new Set(numbersIn(`${item.reason} ${item.product} ${"lot" in item ? item.lot : ""} ${item.key}`));
        const stray = numbersIn(text).find((n) => !allowed.has(n));
        if (stray) { dropped.push({ what: `explanation for ${item.product}`, why: `Contains the number ${stray}, which is not in the rule's reason.` }); continue; }
        if (findPhi(ctx, text)) { dropped.push({ what: `explanation for ${item.product}`, why: "Contained patient data." }); continue; }
        explained.set(item.key, text);
      }
    }
    const withText = (i: (typeof items)[number]) => ({ ...i, explanation: explained.get(i.key) ?? null });
    return {
      ruleOutput: { items },
      gatedOutput: { items: items.map(withText), advisory: "Advice only. Nothing is ordered, moved or changed automatically." },
      dropped
    };
  }
});
