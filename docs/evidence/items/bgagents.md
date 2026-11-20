# Evidence: R5-K background agents and the Rx Guardian patient-history checker

## What changed
- `apps/api/src/agents/guardian.ts` (new): the Rx Guardian. Pure rule core `guardianHits` (reuses `runRules` from Rx Watcher with the same severity, adds duplicate same-medicine from another prescriber, demo-table interactions, allergy class codes, non-adherence via `pdc()`, early refill, recalled/quarantined lot in history via `lotBlock`, Schedule II prescriber pattern, demo age-band ceiling). Gate `gateGuardian`, suggestion store, accept (order on hold), dismiss (reason required), change request (existing `decide()` path). Registered as the eighth agent.
- `apps/api/src/agents/background.ts` (new): per-agent enabled flag in the DB, `backgroundTick`, Run now, status (enabled, last run, next run, runs today), kill switch `AGENTS_BACKGROUND=0`.
- Shared files, small additive edits: `db.ts` (tables suggestions, agent_settings, guardian_state), `protect.ts` (suggestions title, evidence, explanation, decision_reason encrypted), `seed.ts` (demo seed enables the Guardian), `server.ts` (minute tick calls `backgroundTick`), `app.ts` (`/api/rx` carries suggestion counts, not for cashier), `today.ts` (suggestions card data, `agentsOn`), `agents/routes.ts` (enable, disable, run-now, `/api/suggestions*`), `agents/providers.ts` (mock answer), `agents/index.ts`, `scenarios.ts` (scenario "Agent catches it", async apply).
- Web: `components/Suggestions.tsx` (card, Fill inline block, Today card), `screens/AIAgents.tsx` (Agents and Suggestions tabs, background row with switch, last/next run, runs today, Run now), `screens/Today.tsx`, `screens/Fill.tsx` (queue badge, inline evidence), `components/Shell.tsx` ("Agents on: N").
- Docs: `docs/AGENTS.md` (section and 60-second path), `docs/DEMO.md` (one beat). README and DEMO_SCRIPT.md untouched.
- Tests: `apps/api/test/guardian.test.ts` (26 new); `agents.test.ts` roster now 8 agents; `review-matrix.test.ts` allows enable/disable for pharmacist and admin.
- e2e: `scripts/e2e/demo-e2e.mjs` section 13b.

## Commands run
- `pnpm typecheck`: pass. `pnpm build:web`: built. `bash scripts/phi-guard.sh`: no findings.
- `pnpm test`: 20 files, 364 tests pass (338 before, 26 new).
- Isolated stack (API_PORT=4310, temp DATA_DIR, OFFLINE=1, mock provider; stopped by PID): `BASE=http://localhost:4310 node scripts/e2e/demo-e2e.mjs` gave 49/49 passed, 1 skipped (MFA off). The Guardian raised the scenario's suggestions in the background with no button pressed.

## What the tests prove
- Each rule fires on a crafted history and not on a clean one; Watcher findings are never softened (severity match).
- A lying provider (undo wording, foreign numbers, invented fact id F99, extra fields) cannot remove a rule hit or add an unbacked note; a truthful note becomes a monitor-level "ai-note".
- Prompts contain patient id, drugs, dates, age band and class codes; an allergy appears as PCN, never as text; no names, DOB, phone, email.
- Background loop runs an enabled agent, skips a disabled one, re-runs the Guardian on a new order, survives a throwing agent and a failing provider, and stops under `AGENTS_BACKGROUND=0`.
- Roles: pharmacist and technician read suggestions; cashier and admin 403; only a pharmacist decides or runs now; pharmacist and admin switch.
- Order rows are byte-identical after a Guardian run; accept puts the order on hold and the scan is refused; audit chain verifies; raw sqlite values of suggestions start with `enc:v1:`.

## Skipped or not verified
- No live Bedrock call (mock and none only). Explanations under the mock are terse by design.
- Two-store mode was exercised only through the e2e stack (TWO_STORES default); no dedicated two-store Guardian test.
- Suggestions auto-closed as "resolved" is a fourth status beyond open/accepted/dismissed.
- A "late-refill" rule maps from Rx Watcher's late-refill finding; no separate Guardian late threshold.
