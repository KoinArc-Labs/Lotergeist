# Coroner extraction on real openFDA recalls

Generated 2026-11-19 by `pnpm evidence:accuracy`. Mode: **regex only (no LLM configured)**.

Source: apps/api/fixtures/recalls/real-2025.json (real openFDA /drug/enforcement records, 2025). The Coroner reads the same text the app reads at recall lookup (product description and code info).

| Measure | Value |
| --- | --- |
| Records | 50 |
| Records with at least one lot extracted | 50 (100%) |
| Records with an NDC extracted | 41 (82%) |
| Lots extracted | 755 |
| Lots with an expiry | 721 |
| Lots rejected by the verbatim check | 0 |
| Records sent to a pharmacist for per-lot review | 9 (18%) |

What this does and does not show:

- Every lot reported here appears verbatim in its source text (COR-3). In regex-only mode the verbatim check has nothing to reject; run with an LLM configured to count LLM lots it drops.
- This counts what was extracted, not whether each lot is right. There is no hand-labelled answer key, so precision and recall are not claimed. Per-record output is in `accuracy.json` for anyone to check.
- Records flagged for review need a pharmacist to confirm each lot before anything is quarantined. The recall records are real public openFDA data; no patient data is involved. Not for clinical use.
