## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**: apps/api/src/ (app.ts, core.ts, db.ts, server.ts, config.ts routes and ledger core), packages/coroner/src/ (index.ts, reconcile.ts, llm.ts), packages/gs1/src/index.ts, packages/summoner/src/index.ts, apps/web/src/App.tsx, .github/workflows/, scripts/phi-guard.sh, root package.json, pnpm-workspace.yaml, turbo.json, vitest.config.ts, docs/ARCHITECTURE.md
- **Skimmed only**: apps/web/src/screens/, apps/web/src/components/, apps/web/src/lib/, apps/api/test/, packages/*/test/, fixtures/, prototype/, docs/ (other than ARCHITECTURE.md), scripts/e2e/
- **Left out**: node_modules/, dist/, data/ (SQLite files), apps/web/public/ocr/ (generated OCR model), .kiro/, aidlc/

### Packages Found
- @chimera-rx/api — app — TypeScript — Fastify 5 server, SQLite ledger, jobs, partner surfaces
- @chimera-rx/web — app — TypeScript/React — the only staff UI (10 screens)
- @chimera-rx/gs1 — library — TypeScript — GS1 element strings, NDC and GTIN-14 conversion, check digit
- @chimera-rx/summoner — library — TypeScript — openFDA client, rate limiter, normaliser
- @chimera-rx/coroner — library — TypeScript — lot extractor, regex pass, LLM pass, verbatim reconcile

### Build System
- **Type**: pnpm 12.16.1 workspaces; no build step for packages; Vite 7 for web
- **Config Files**: package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, vitest.config.ts, apps/web/vite.config.ts
- **Build Dependencies**: api depends on gs1, coroner, summoner; web depends on gs1; coroner depends on gs1; packages import no app code

### APIs Discovered
- Staff REST (session cookie lg_session, role checks via only()) — apps/api/src/app.ts — about 80 routes under /api
- Partner API (OAuth 2.0 client credentials) — apps/api/src/partner-api.ts — /oauth/token, /v1/*, /mcp, /fhir/r4/*
- Signed webhooks outbound — apps/api/src/webhooks.ts; inbound webhook_inbox table
- 87 route registrations counted by grep across apps/api/src

### Frameworks & Libraries
- fastify 5.12.8, @fastify/cookie 11.1.5, @fastify/cors 11.4.1, @fastify/static 10.1.10 — API
- zod 3.25.76 — validation; node-cron 4.6.0 — jobs; pdfkit 0.20.2, bwip-js 4.11.4 — documents
- @aws-sdk/client-bedrock-runtime 3.1163.0 — optional LLM; node:sqlite built in
- react 18.3.1, react-router-dom 7.18.5, @tanstack/react-query 5.106.1, @zxing/browser 0.2.1, tesseract.js 7.0.0, vite 7.3.7
- vitest 3.2.7, fast-check 4.10.2, playwright 1.65.0, tsx 4.23.15, typescript 5.9.3

### Test Coverage
- **Test Directories**: apps/api/test, packages/gs1/test, packages/coroner/test, packages/summoner/test, scripts/e2e
- **Test Frameworks**: Vitest 3 (pool forks), fast-check, Playwright script (scripts/e2e/demo-e2e.mjs)
- **Coverage Config**: absent (no coverage provider configured); about 97 it() cases (api 63, gs1 10, coroner 17, summoner 7); no web component tests

### Code Quality Indicators
- **Linting**: none configured (no ESLint, no Prettier)
- **CI/CD**: .github/workflows/ci.yml: PHI guard, typecheck, test, build:web on Node 24; no deploy job
- **Documentation**: README, docs/ARCHITECTURE.md, SAFETY.md, DEMO.md, KIRO_USAGE.md, plan.md; steering files under .kiro/steering

### Technical Debt Signals
- No lint or format tooling; no coverage measurement (apps/web has no tests)
- fixtures/recalls and apps/api/fixtures/recalls are duplicated; demo-synthetic.json differs between them
- Single SQLite file, one store, no multi-tenant isolation (documented in ARCHITECTURE.md)
- LLM paths tested with doubles only; camera path rehearsed with a fake camera
- Demo credentials are built into apps/api/src/app.ts auth config (synthetic, shown only when LG_DEMO is not 0)
- No hosted demo, one-command container, or published accuracy and timing numbers yet (the intent's gaps)
- CI runs Node 24 while the steering file says Node 22.5+ (developed on 26)

## Handoff Summary
- **Intent-relevant finding**: The product is feature-complete for the recall flow (apps/api/src/recall.ts, packages/coroner/src/reconcile.ts verbatim gate, apps/api/src/core.ts hash-chained audit). Judge-facing gaps are outside code: no deploy target, no scenario library or large dataset beyond fixtures/recalls/real-2025.json (50 records), no measured accuracy or timing output, and no web tests.
- **Risks / follow-up**: Preserve the pharmacy safety rules in .kiro/steering/pharmacy-safety.md (verbatim gate COR-3, inferredSerial, sandbox-only messages). The duplicated fixtures directory is a drift risk for any dataset work. Packages must stay free of app imports.
