/**
 * FR2.1 / US0.4: run the Coroner over the real openFDA recall records in the fixtures and publish what it extracted.
 *
 *   pnpm evidence:accuracy            regex only (the default, no LLM)
 *   LLM_PROVIDER=bedrock pnpm ...     regex + LLM, with the verbatim gate counting every LLM lot it drops
 *
 * Writes docs/evidence/accuracy.json and docs/evidence/accuracy.md. The text fed to the Coroner is the same as in the
 * app's recall lookup: product_description + code_info.
 */
import fs from "node:fs";
import path from "node:path";
import { autopsy, createLlmFromEnv } from "@chimera-rx/coroner";

const root = path.resolve(import.meta.dirname, "../../..");
const src = path.join(root, "apps/api/fixtures/recalls/real-2025.json");
const outDir = path.join(root, "docs/evidence");

const raw = JSON.parse(fs.readFileSync(src, "utf8"));
const records: any[] = Array.isArray(raw) ? raw : raw.results;
const llm = createLlmFromEnv();

let withLot = 0, lots = 0, rejected = 0, withNdc = 0, needsReview = 0, withExpiry = 0;
const rows: { recall: string; lots: string[]; ndcs: string[]; rejected: number; review: boolean }[] = [];
for (const r of records) {
  const text = `${r.product_description ?? ""}\n${r.code_info ?? ""}`;
  const a = await autopsy(text, { llm });
  const drop = a.warnings.filter((w) => w.startsWith("Dropped LLM lot")).length;
  if (a.lots.length) withLot++;
  if (a.ndcs.length) withNdc++;
  if (a.needsReview) needsReview++;
  withExpiry += a.lots.filter((l) => l.expiry).length;
  lots += a.lots.length;
  rejected += drop;
  rows.push({ recall: r.recall_number, lots: a.lots.map((l) => l.value), ndcs: a.ndcs.map((n) => n.value), rejected: drop, review: a.needsReview });
}

const report = {
  generated: new Date().toISOString(),
  source: "apps/api/fixtures/recalls/real-2025.json (real openFDA /drug/enforcement records, 2025)",
  mode: llm ? `regex + LLM (${llm.name})` : "regex only (no LLM configured)",
  records: records.length,
  recordsWithLot: withLot,
  recordsWithNdc: withNdc,
  lotsExtracted: lots,
  lotsWithExpiry: withExpiry,
  lotsRejectedByVerbatimCheck: rejected,
  recordsNeedingPharmacistReview: needsReview,
  rows
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "accuracy.json"), JSON.stringify(report, null, 2) + "\n");

const pct = (n: number) => `${((100 * n) / Math.max(1, records.length)).toFixed(0)}%`;
const md = `# Coroner extraction on real openFDA recalls

Generated ${report.generated.slice(0, 10)} by \`pnpm evidence:accuracy\`. Mode: **${report.mode}**.

Source: ${report.source}. The Coroner reads the same text the app reads at recall lookup (product description and code info).

| Measure | Value |
| --- | --- |
| Records | ${records.length} |
| Records with at least one lot extracted | ${withLot} (${pct(withLot)}) |
| Records with an NDC extracted | ${withNdc} (${pct(withNdc)}) |
| Lots extracted | ${lots} |
| Lots with an expiry | ${withExpiry} |
| Lots rejected by the verbatim check | ${rejected} |
| Records sent to a pharmacist for per-lot review | ${needsReview} (${pct(needsReview)}) |

What this does and does not show:

- Every lot reported here appears verbatim in its source text (COR-3). In regex-only mode the verbatim check has nothing to reject; run with an LLM configured to count LLM lots it drops.
- This counts what was extracted, not whether each lot is right. There is no hand-labelled answer key, so precision and recall are not claimed. Per-record output is in \`accuracy.json\` for anyone to check.
- Records flagged for review need a pharmacist to confirm each lot before anything is quarantined. The recall records are real public openFDA data; no patient data is involved. Not for clinical use.
`;
fs.writeFileSync(path.join(outDir, "accuracy.md"), md);
console.log(md);
