# Code Structure

## Layout
| Path | Role |
| --- | --- |
| `apps/api/src/` | 25 TypeScript modules: one per domain area plus `app.ts` (routes), `core.ts` (audit, lotEvent, scan resolve), `db.ts` (schema), `server.ts` (entry and cron) |
| `apps/api/test/` | `store-flow.test.ts` (ledger and property tests), `platform.test.ts` (partner, webhooks, auth), `helpers.ts` |
| `apps/api/fixtures/` | recall fixtures served to Night Watch and tests |
| `apps/web/src/screens/` | 10 screens: SignIn, Today, Receiving, Inventory, Fill, Patients, Recalls, Integrations, Labels, Outbox |
| `apps/web/src/components/` | Shell, ScanPanel, RxReview, DataMatrix, kit (shared style tokens) |
| `apps/web/src/lib/` | api client, scanner (BarcodeDetector + zxing), ocr (tesseract.js), gs1, sound, speech |
| `packages/gs1/src/` | `check.ts`, `ndc.ts`, `elements.ts`, `index.ts` |
| `packages/coroner/src/` | `regex-pass.ts`, `llm.ts`, `reconcile.ts`, `dates.ts`, `types.ts`, `index.ts` |
| `packages/summoner/src/` | `openfda.ts`, `normalize.ts`, `limiter.ts`, `types.ts` |
| `fixtures/recalls/` | root copy of recall fixtures (duplicate of `apps/api/fixtures/recalls/`) |
| `scripts/` | `dev.sh`, `phi-guard.sh`, `install-hooks.sh`, `refresh-fixtures.sh`, `usage-log.sh`, `e2e/demo-e2e.mjs` |
| `prototype/` | design source of truth `*.dc.html` mockups |
| `docs/` | ARCHITECTURE, SAFETY, DEMO, KIRO_USAGE, plan |
| `.github/workflows/ci.yml` | CI |

## File Classification
- Source: `apps/*/src`, `packages/*/src`. Tests: `*/test`. Config: root `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `turbo.json`, `pnpm-workspace.yaml`. Generated or ignored: `data/`, `apps/web/public/ocr/`, `dist/`.
- Largest source files: `apps/web/src/screens/Recalls.tsx` (382), `apps/api/src/recall.ts` (372), `apps/api/src/seed.ts` (332), `partner-api.ts` (322), `app.ts` (318).

## Code Patterns
- One exported function per use case taking `ctx: Ctx` first (`Ctx` holds cfg, db, notify, now, llm, voice).
- `HttpError(status, message, code)` for domain failures; zod `.parse` for bodies; a single error handler in `app.ts`.
- Packages export from `src/index.ts` and never import from apps.
- Raw SQL through a thin `Db` wrapper (`run`, `get`, `all`); no ORM.
- Inline styles in the web app with shared tokens in `components/kit.tsx`.
