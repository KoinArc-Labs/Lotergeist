# Code Quality Assessment

## Tests
- About 97 `it()` cases: `apps/api/test/store-flow.test.ts` (40), `platform.test.ts` (23), coroner (17), gs1 (10), summoner (7).
- Property tests via fast-check cover the ledger invariant (on hand = received − dispensed − returned − adjusted) and the verbatim lot gate.
- `scripts/e2e/demo-e2e.mjs` is a Playwright script that needs the stack running.
- No tests for `apps/web`. No coverage provider configured, so the 80% floor in the mvp scope cannot be measured today.
- These counts come from reading files; tests were not run in this scan.

## Lint and format
None. No ESLint, Prettier or editor config found.

## CI
`.github/workflows/ci.yml` on push to main and pull requests: PHI guard (`scripts/phi-guard.sh --all`), typecheck, test, `build:web`. No deploy or coverage step.

## Documentation
README plus five docs files; steering files hold product, tech and safety rules. Architecture doc matches the code structure read.

## Technical Debt
- Duplicate fixtures: `fixtures/recalls/` and `apps/api/fixtures/recalls/`; `demo-synthetic.json` differs between them.
- `app.ts` holds about 80 routes in one file.
- Single SQLite file, one store, no tenant isolation.
- LLM paths tested with doubles only; camera path rehearsed with a fake camera.
- Demo sign-in credentials are in `app.ts` (synthetic; hidden when `LG_DEMO=0`).
- CI Node 24 against steering "22.5+".
- No hosted demo, container, published accuracy or timing numbers.

## Safety conformance (spot checks)
Verbatim gate present in `reconcile.ts`; audit chain in `core.ts`; role checks in `app.ts`; PHI guard script and CI step present.
