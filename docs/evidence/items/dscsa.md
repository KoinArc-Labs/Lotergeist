# Evidence: DSCSA traceability with GS1 EPCIS (R1-C)

Sandbox, not a filing. No compliance is claimed.

## What changed
- New package `packages/epcis` (`@chimera-rx/epcis`): SGTIN/LGTIN URNs, GS1 Digital Link, CBV mapping, EPCIS 2.0 ObjectEvent builder, zod validator, parser. Imports only `@chimera-rx/gs1` and zod.
- `apps/api/src/epcis.ts`: export, import (dry run, pharmacist confirm, advisory only), sandbox verifier, verification log, suspect cases with plain-text draft, recall trace export, `lotTrace`. Routes registered with one line in `app.ts`.
- `db.ts`: tables `verification_requests`, `suspect_cases`, `trace_imports`. `partner-api.ts`: MCP tool `lot_trace` (scope `inventory.read`). Fixture `apps/api/fixtures/dscsa-verifier.json`.
- Web: `screens/Dscsa.tsx` (export form with preview, import dropzone with dry run, verification log, cases), `components/VerifyPanel.tsx` (Receiving hook), "Export trace (EPCIS)" in the recall review, nav entry in `Shell.tsx`, route in `App.tsx`.
- `docs/DSCSA.md`.

## Commands run and results
- `pnpm install --offline`: linked the new workspace package, lockfile gained only the epcis importer entries.
- `pnpm test`: 12 files, 268 tests passed (includes 17 epcis package tests and 23 `dscsa.test.ts` tests; all earlier tests still pass).
- `pnpm typecheck`: no errors in any workspace project.
- `pnpm build:web`: built.
- Live smoke on port 4417 with a temp data dir: `/api/health` ok, pharmacist login, `GET /api/epcis/export?lot=GX4471C` returned an EPCIS 2.0 document, `/dscsa` served the app shell. Server stopped afterwards. Ports 4000, 5173, 5174 untouched.

## What the tests prove
- `packages/epcis/test/epcis.test.ts`: worked-example URN; URN well-formedness and parse-back for any GTIN and serial (property, 300 runs); URN escaping round trip; every kind maps to a CBV bizStep that reads back to the same kind; holding carries non_conformant or recalled; build, validate, parse round trip for random event lists (property, 200 runs); an event with neither lot nor serial is refused unless marked inferred (property, 400 runs); an inferred NOSN serial never appears in `epcList`; validator rejects 8 kinds of bad document.
- `apps/api/test/dscsa.test.ts`: export is valid EPCIS and covers receiving, storing, dispensing, holding (recalled disposition); lot, gtin and date filters; bad filters give 422; cashier and admin get 403, technician cannot request patient ids; NOSN serial exported as inferred; exports audited. Import: dry run changes no package, lot or ledger row and stores nothing; invalid docs are explained and cannot be committed; technician cannot commit; confirmed import adds only `trace_imports` rows, creates no package, drops patient ids, and a second run is all duplicates. Verifier: verified, serial_not_commissioned, lot_mismatch, expiry_mismatch, lot_recalled, input validation, role checks, log and audit rows. A failed verification at receiving leaves the package pending and put-away still refused; the existing problem path still quarantines it. Cases: opening rules, 403 for technician writes, draft starts with "DRAFT, not a filing, nothing is sent" and sends nothing, quarantine writes a Quarantined lot event and moves the unit to Q-1, a recalled lot's case cannot be closed as cleared (409 `recalled_blocked`), and after closing, the lot is still `recalled` and receiving still fails the recall check. Recall trace: only confirmed recalled lots, patient ids only and no patient names, phones or emails in the document, pharmacist only, audited. `lot_trace` MCP tool: read-only annotation, valid EPCIS, no patient ids, unknown lot and bad args handled. The audit hash chain still verifies at the end.

## Skipped or not verified
- I did not click through the new web screens in a browser; only typecheck, the production build and the served shell were checked. The screens have no component tests.
- The CBV bizStep and disposition choices for Released (inspecting/conformant) and Adjusted (cycle_counting/active) are my sandbox mapping, not checked against the current GS1 CBV text. The 7-digit company prefix is an assumption.
- ObjectEvents carry lot and expiry as `cbvmda:lotNumber` and `cbvmda:itemExpirationDate` on every event (ilmd is only allowed for ADD actions), so the output is a sandbox profile and has not been run through a GS1 conformance validator.
- Fill events whose serial was inferred at the counter are not marked inferred, because the ledger does not store that flag. Only NOSN serials are.
- Verification at Receiving is offered only when the TI/TS check fails and the label has a serial.
