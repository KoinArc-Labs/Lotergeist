---
inclusion: fileMatch
fileMatchPattern: "packages/gs1/**"
---

# GS1 standards used here

## Application identifiers
| AI | Meaning | Format |
| --- | --- | --- |
| 01 | GTIN | 14 digits, fixed |
| 10 | Lot | 1-20 chars, variable |
| 17 | Expiry | YYMMDD, fixed (DD=00 means end of month) |
| 21 | Serial | 1-20 chars, variable |

Variable-length AIs are followed by FNC1 (ASCII GS, 0x1d) unless last. Scanners may prefix `]d2`. Human-readable form is `(01)...(21)...`.

## NDC to GTIN-14
- 10-digit FDA NDC layouts: 4-4-2, 5-3-2, 5-4-1. The 11-digit HIPAA form is 5-4-2 (zero-padded).
- GTIN-14 = `00` + `3` + NDC10 digits + mod-10 check digit. Example: `70004-417-05` -> `00370004417051`.
- An 11-digit NDC maps back to up to three GTINs, one per segment that could have lost a leading zero (`ndcToGtin14Candidates`).
- Check digit: weights 3,1,3,1 from the right of the body, `(10 - sum % 10) % 10`.

## Supplier transaction data (DSCSA TI/TS)
Each delivery carries the supplier's list of `(GTIN, lot, serial, expiry)` it shipped (`ti_records`). At receiving, a scanned serial must appear in that list with the same lot, or the TI/TS check fails and the package can only be reported and quarantined. A label with no serial (read by OCR) gets an internal `NOSN-` ID and a TI/TS warning, never a pass.

Invariant: a package reaches `on_shelf` only after receiving checks pass; the ledger property test enforces on hand = received − dispensed − returned − adjusted.
