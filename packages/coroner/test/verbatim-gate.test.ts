import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { appearsVerbatim, autopsy } from "../src/index";

// REV-API: the COR-3 gate against a hostile model. Every lot the Coroner emits must be a whole token printed in the notice.

const SRC = `Methylprednisolone 40 mg/mL
Lot PRORX050925-1, EXP 09/30/2027; Lot PRORX050925-3, EXP 09/30/2027; NDC 70004-417-05`;
const REAL = ["PRORX050925-1", "PRORX050925-3"];
const ask = (values: string[]) => ({ name: "hostile", complete: async () => JSON.stringify({ ndcs: [], lots: values.map((value) => ({ value, expiry: "2027-09-30", confidence: 0.99 })), notes: "" }) });

describe("COR-3 verbatim gate under hostile model output", () => {
  const hostile = ["PRORX050925-1,EXP", "PRORX0509", "7", "050925", "PRORX050925", "EXP09/30/2027;LotPRORX050925-3", "PRORX050925-1EXP", "\\u0420RORX050925-1", "PRORX0509\\u200B25-1", "PRORX050925\\u00A0-1", "PRORX 050925-1", "PRORX050925-12", "XPRORX050925-1", "PRORX050925-", "70004-417", "FAKE999999"].map((s) => JSON.parse(`"${s.replace(/"/g, '\\"')}"`) as string);
  it.each(hostile)("drops %j", async (v) => {
    const a = await autopsy(SRC, { llm: ask([v]) } as any);
    expect(a.lots.map((l) => l.value).sort()).toEqual(REAL);
  });

  it("keeps a case or whitespace-run variant of a printed lot, as the same lot", async () => {
    const a = await autopsy(SRC, { llm: ask(["prorx050925-1", "  PRORX050925-3  "]) } as any);
    expect(a.lots.map((l) => l.value).sort()).toEqual(REAL);
    expect(appearsVerbatim("Lot  AB12\n 34", "ab12 34")).toBe(true);
  });

  it("property: no emitted lot is ever absent from the notice as a whole token", async () => {
    const piece = fc.oneof(fc.stringMatching(/^[A-Za-z0-9\-\/ ,.;:]{1,20}$/), fc.constantFrom(...REAL), fc.string({ unit: "grapheme", maxLength: 12 }));
    await fc.assert(fc.asyncProperty(fc.array(piece, { maxLength: 6 }), async (vals) => {
      const a = await autopsy(SRC, { llm: ask(vals) } as any);
      for (const l of a.lots) if (l.source === "llm" || l.source === "both") expect(appearsVerbatim(SRC, l.value)).toBe(true);
      const extra = a.lots.filter((l) => !REAL.includes(l.value));
      for (const l of extra) expect(SRC.toUpperCase()).toContain(l.value.toUpperCase());
    }), { numRuns: 300 });
  });
});
