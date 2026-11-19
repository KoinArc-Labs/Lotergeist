# Team Practices

Confirmed by the person in the practices-discovery interview (practices-discovery-questions.md, Q1 to Q9). Evidence sources: code-structure.md, technology-stack.md, dependencies.md, code-quality-assessment.md, architecture.md, business-overview.md (codekb/Kiroween/), plus git history, `.github/workflows/ci.yml`, `package.json`, `vitest.config.ts`, `tsconfig.base.json`, `.githooks/pre-commit`, `scripts/`.

## Way of Working

- **Integration branch**: main
- We work solo. We commit straight to `main` on this machine, with no feature branches and no merges (Q1, Q8).
- Nothing goes to GitHub: no push, no pull request, no CI run. That changes only when the person does it together with the agent (Q1, Q8; project rule, learned 2026-11-16).
- The existing `.github/workflows/ci.yml` stays in the repo but never runs, because nothing is pushed.
- Every commit message starts with a type prefix (`feat`, `fix`, `chore`, `docs`, `test`), plus the requirement ID when there is one, for example `COR-3: ...` (Q7).
- The existing `.githooks/pre-commit` file (PHI guard, installed by `pnpm hooks:install`) is left as it is. We add no new hook or check (see evidence.md, uncertainty 5).

## Walking Skeleton

- We build a thin end-to-end slice first (Q2). A walking skeleton is a minimal version that runs the whole way through, built first to prove the pieces connect before the real features go in.
- The first piece of new work is one register sale, one second-factor sign-in and two stores, wired end to end.
- Chimera Rx already runs end to end (scan, receive, fill, recall, notify, audit). The slice proves the new pieces (front-store register, second factor, several stores) connect to it.

## Testing Posture

- **Methodology**: test-after
- **Methodology evidence**: The person chose to keep writing tests after the code (Q3). Existing tests in `apps/*/test` and `packages/*/test` sit beside finished modules, with fast-check property tests for the ledger invariant and the verbatim lot gate (COR-3). No feature files or BDD tooling exist.
- **Ordering**: Implement each testable layer first, then write and run that layer's tests, with property tests for safety invariants such as the verbatim lot gate.
- No coverage floor. No coverage tool is added (Q4, Q9). The person's answer replaces the earlier 80% floor.
- No automated checks of any kind: no lint, format, coverage or CI gate (Q6, Q8, Q9).
- The existing tests keep passing. We run them ourselves with `pnpm test` when we choose to.
- Tooling in place: Vitest 3.2.7, fast-check 4.10.2, Playwright 1.65.0 for `pnpm e2e` (needs the stack running).

## Deployment

- No hosted deploy (Q5). Judges run Chimera Rx with one local command (Docker Compose), and we also supply the recorded demo video.
- One environment: local. No staging or production, no release cadence, no tags beyond `0.1.0`.
- The Docker Compose setup does not exist yet and is new work.
- No real services sit behind it: no real messaging, telephony or pharmacy connections (pharmacy-safety.md).

## Code Style

- TypeScript 5.9.3, strict mode, ES2022 target, ESM (`"type": "module"`), `isolatedModules`, `noEmit` (tsconfig.base.json). Packages are consumed as TypeScript source with no build step.
- No Prettier and no ESLint (Q6, Q9). We rely on TypeScript strict mode and review.
- Package names are `@chimera-rx/<name>` and each package exports from `src/index.ts`. `packages/gs1`, `packages/summoner` and `packages/coroner` stay pure and never import from `apps/*` (tech.md, architecture.md).
- Dependencies are pinned to exact versions, no ranges (tech.md).
- Every person-initiated state change goes through `audit()`; every lot movement goes through `lotEvent()`. Role checks happen on the server (tech.md).
- Web inline styles follow the `prototype/*.dc.html` mockups; shared tokens live in `apps/web/src/components/kit.tsx`.
- Known debt: `app.ts` holds about 80 routes in one file, and recall fixtures are duplicated in two folders (code-quality-assessment.md).
