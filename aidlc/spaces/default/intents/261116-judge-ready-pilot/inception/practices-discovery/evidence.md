# Practices Discovery Evidence

## Inspected

- codekb/Kiroween: code-structure.md, technology-stack.md, dependencies.md, code-quality-assessment.md, architecture.md, business-overview.md (code-quality-assessment.md carries most of the practice evidence).
- Git: 4 commits total. Branches `main`, `feat/lotergeist-platform`, `chore/remove-legacy` (current, HEAD c3e3a17). One merge commit, "Merge pull request #1".
- CI: `.github/workflows/ci.yml` (push to main and pull requests; Node 24, pnpm 12.16.1; PHI guard, typecheck, test, build:web).
- Config: `package.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, `tsconfig.base.json`, `.githooks/pre-commit`, `scripts/`, `.kiro/hooks/pbt-on-save.json` (name only).
- Steering: tech.md, product.md, pharmacy-safety.md. Memory: org.md, team.md (empty template), project.md (two Forbidden rules).
- No `.prettierrc`, ESLint config, editor config or coverage provider found.

## Inferred (before the interview)

Integration branch `main`, PR-based branching, merge-commit style, Conventional Commit prefixes, test-after with property tests, no coverage measured, no deployment, strict TypeScript with no linter, no skeleton needed. The interview overrode or confirmed each one below.

## Interview decisions (authoritative)

| Q | Decision |
| --- | --- |
| Q1 | Commit straight to `main` locally, no branches. |
| Q2 | A walking skeleton is wanted: one register sale, one second-factor sign-in and two stores, wired end to end. This overrides the inference that none was needed. |
| Q3 | Test-after. |
| Q4 | First answered 80% line floor with a coverage tool; replaced by Q9. |
| Q5 | One local command (Docker Compose) plus the recorded demo video. No hosted deploy. |
| Q6 | First answered Prettier and ESLint in CI; replaced by Q9. |
| Q7 | Type prefix (feat, fix, chore, docs, test) on every commit, plus the requirement ID when there is one. |
| Q8 | Nothing goes to GitHub (no push, PR or CI run) until done together with the agent. No checks of any kind. |
| Q9 | No coverage floor, no Prettier, no ESLint. The existing tests keep passing. |

## Departure from the org default

org.md sets an 80% line-coverage floor and CI execution before merge for the mvp scope. The person chose no floor and no automated checks (Q9, with Q4, Q6 and Q8), by explicit choice. The team's testing posture and code style record this departure. Build and test verification should not treat the missing floor as a failure.

## Remaining uncertainty

1. Test counts (about 97 `it()` cases) came from reading files in an earlier scan; tests were not run here.
2. Four commits is too little history to show a real cadence or test ordering.
3. The `pbt-on-save` hook's exact behavior was not read.
4. Node version mismatch: CI uses 24, tech.md says 22.5+, package.json says `>=22.5`. CI never runs now, so it has no effect.
5. `.githooks/pre-commit` (PHI guard) is an automated check that already exists, and the person said no automated checks. It was left alone because the pharmacy-safety steering rules say commits that look like PHI are blocked. This needs the person's word if they want it removed.
6. The existing `.github/workflows/ci.yml` stays but never runs while nothing is pushed.
7. Docker Compose is not in the repo yet; the one-command judge run depends on new work.
