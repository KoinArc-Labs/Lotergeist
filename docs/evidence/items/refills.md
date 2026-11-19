# Evidence: R2-D recall-aware refills and adherence, AI drafts in the recall send flow

## What changed
- `apps/api/src/refills.ts`: deterministic core. Run-out date with carry-forward, worklist states (upcoming, due, overdue) with a grace window (`REFILL_GRACE_DAYS` or `?grace=`), PDC over 180 days (flag below 0.80), medication sync with short fills, recalled/quarantined lot block, Schedule II and no-refills handling.
- `apps/api/src/agents/refills.ts`: the seventh agent, Refill Outreach. Works under `mock` and `none`. Template gate plus a per-draft gate. No send path.
- `apps/api/src/refills-routes.ts`: `GET /api/refills`, `GET /api/refills/drafts`, `POST /api/refills/draft`, `POST /api/refills/send`. Cashier 403, technician drafts but cannot send, every draft and send audited.
- Small shared edits: `apps/api/src/app.ts` (import and one register call), `apps/api/src/agents/routes.ts`, `agents/index.ts`, `agents/outreach.ts` (export `namesOtherPatient`, draft queue merges `REFILL` rows), `agents/providers.ts` (mock answer for the new agent), `apps/api/src/scenarios.ts` (scenario "Recall-aware refill").
- Web: `apps/web/src/screens/Refills.tsx` (worklist, adherence bars, sync cards, red recall rows, Draft reminders, attest and send), nav entry in `components/Shell.tsx`, route in `App.tsx`, count tile on `screens/Today.tsx`, "Use AI draft" in the Notify step of `screens/Recalls.tsx`.
- Docs: `docs/REFILLS.md`, `docs/AGENTS.md` (agent count and row).
- Tests: `apps/api/test/refills.test.ts` (26 new), `apps/api/test/agents.test.ts` (agent list now has 7).

## Commands run
- `pnpm typecheck`: all four packages pass.
- `pnpm test`: 13 files, 296 tests pass (270 existing, 26 new).
- `pnpm build:web`: built.
- `bash scripts/phi-guard.sh`: no output, no findings.

## What the tests prove
- PDC: worked example (90/91 days), carry-forward of early pickups, a gap falling below 0.80, fast-check properties (0 to 1; more days of supply never lowers it; adding a fill on or after the first fill never lowers it; future fills ignored).
- Due dates: run-out = last fill + days supply, grace window moves "due" to "overdue", lookahead brings "upcoming" in.
- Sync: pickup day, full vs short fills (20 and 14 day examples), single-drug patients get none.
- Recall block: offered before recall; blocked with lot and recall id after lookup; still blocked after the recall is closed; a reminder drafted earlier is skipped at send time; a blocked row gets no new draft; blocked and Schedule II rows are left out of sync.
- Schedule II shows "needs a new prescription" and is never eligible.
- Roles: cashier 403 on all four routes; technician can list and draft, cannot send; audit rows `refill.draft` and `refill.send` exist.
- Agent: mock gives AI wording that passes the gate; none gives approved templates ("rules only"); prompt holds patient ids and counts only; a lying provider (names another patient, no phone or STOP, voicemail naming the drug) is rejected and the defaults are used; the per-draft gate drops each bad kind; send needs attestation (422 `attest`), reads consent at send time, writes to the sandbox outbox only, and a second send returns 409.
- Recall send flow: with the AI drafter's templates loaded, sending without attestation still returns 422 `attest` and sends nothing; a technician gets 403; with attestation it goes to the sandbox outbox.

## Skipped or not verified
- The web screens were type-checked and built, not clicked through in a browser or covered by a UI test. The "Use AI draft" button and Refills screen are untested at the DOM level.
- Voicemail drafts are only rendered (status `rendered`), not played back through the voice provider.
- The "Use AI draft" button substitutes the pharmacy phone into text and email wording on the client, because the existing recall send route requires a literal phone number in the text.
- `.env.example` is not updated: `REFILL_GRACE_DAYS` is documented in `docs/REFILLS.md` only.
- The seeded history has few fills with a days supply, so the default demo shows only a short worklist; the scenario adds the full demonstration data.
