import { z } from "zod";
import { appearsVerbatim, autopsy, parseLlmJson, type Autopsy, type LlmClient } from "@chimera-rx/coroner";
import { registerAgent, type AgentResult, type Dropped, type LlmCall } from "./agent";

/**
 * Coroner (recall reader). Core: the regex pass over the notice. Advisory: the model reads the same text. Gate: the
 * verbatim check (COR-3). A lot the model returns that is not in the source text is dropped, never "fixed".
 */

export const SAMPLE_NOTICE = `Methylprednisolone Acetate Injectable Suspension, 40 mg/mL, 5 mL vial
Lot PRORX050925-1, EXP 09/30/2027; Lot PRORX050925-3, EXP 09/30/2027; NDC 70004-417-05`;

const view = (a: Autopsy) => ({
  ndcs: a.ndcs.map((n) => ({ value: n.value, confidence: n.confidence, source: n.source })),
  lots: a.lots.map((l) => ({ value: l.value, expiry: l.expiry ?? null, confidence: l.confidence, source: l.source })),
  notes: a.notes, warnings: a.warnings, needsReview: a.needsReview
});

/** Adapts the agent's LLM handle to the Coroner's `LlmClient`, so the existing autopsy() (and its gate) is what runs. */
function asClient(llm: LlmCall): LlmClient {
  return {
    name: llm.client?.name ?? "none",
    async complete(system: string, user: string) {
      const raw = await llm.ask(system, user, { publicSource: true });
      if (raw == null) throw new Error(llm.error ?? "no answer");
      return raw;
    }
  };
}

registerAgent({
  id: "coroner",
  name: "Coroner",
  purpose: "Reads a recall notice and lists its lot numbers and NDCs. Regex first; the model is a second opinion; a lot not printed in the notice is dropped.",
  roles: ["pharmacist", "technician", "admin"],
  guardrails: [
    "Regex runs first and always runs.",
    "A lot the model returns must appear verbatim in the notice (case and spacing ignored). Otherwise it is dropped and listed.",
    "A lot under 0.95 confidence, or with no expiry, is confirmed by a pharmacist one lot at a time. This agent confirms nothing.",
    "The prompt is the public notice text only. No patient data."
  ],
  input: z.object({ text: z.string().min(10).max(20_000) }),
  sample: () => ({ text: SAMPLE_NOTICE }),
  async run(_ctx, _actor, input: { text: string }, llm: LlmCall): Promise<AgentResult> {
    const rules = await autopsy(input.text, { llm: null });
    let gated = rules;
    const dropped: Dropped[] = [];
    if (llm.client) {
      gated = await autopsy(input.text, { llm: asClient(llm) });
      // Report every lot the model proposed that the source text does not back up.
      for (const raw of llm.raws) {
        const out = parseLlmJson(raw);
        for (const l of out?.lots ?? []) {
          if (!appearsVerbatim(input.text, l.value)) dropped.push({ what: `lot ${l.value}`, why: "Not printed in the notice (verbatim check)." });
        }
      }
      if (!llm.raws.length) gated = rules;
      else if (gated.warnings.some((w) => /schema validation|LLM call failed/.test(w))) dropped.push({ what: "model answer", why: "It was not valid JSON for the Coroner schema; the regex result is shown." });
    }
    return { ruleOutput: view(rules), gatedOutput: view(gated), dropped: dedupe(dropped) };
  }
});

const dedupe = (d: Dropped[]) => d.filter((x, i) => d.findIndex((y) => y.what === x.what && y.why === x.why) === i);
