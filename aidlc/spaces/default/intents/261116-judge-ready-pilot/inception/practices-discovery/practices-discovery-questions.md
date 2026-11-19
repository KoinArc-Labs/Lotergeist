# Practices Discovery: Questions

The release engineer drafted the team's practices from the repository (see `team-practices.md` and `evidence.md` in this folder). These questions settle what the evidence could not.

## Q1. [Developer] How work reaches the main branch

You asked that nothing is ever pushed. The history so far used a pull request on GitHub (PR #1) and CI runs on pushes to `main`. How should finished work get onto `main` from now on?

A. Merge each finished branch into `main` locally (no pull requests, nothing pushed; CI only runs if you push yourself later)
B. Commit straight to `main` locally, no branches
C. Keep working on the current branch `chore/remove-legacy` and merge it into `main` locally only at the end
D. Not yet defined
X. Other (please specify)

[Answer]: B. Commit straight to main locally, no branches

## Q2. [Developer] Build a thin end-to-end slice first?

A walking skeleton is a minimal version that runs the whole way through, built first to prove the pieces connect before the real features go in. Chimera Rx already runs end to end, but the new pieces (front-store register, second factor, several stores) do not exist yet. Should the first piece of new work be a thin slice that connects them end to end?

A. No, the app already runs end to end; build the new pieces one by one
B. Yes, start with a thin slice: one register sale, one second-factor sign-in and two stores, wired end to end
C. Not yet defined
X. Other (please specify)

[Answer]: B. Yes, start with a thin slice: one register sale, one second-factor sign-in and two stores, wired end to end

## Q3. [Quality engineer] When tests are written

Today tests are written after the code, with property tests for the ledger and the lot-matching rule. Which way should new work go?

A. Keep writing tests after the code
B. Write the test first (TDD) for the rule-heavy packages (lot extraction, GS1, the ledger), tests after for the rest
C. Write the test first for everything
D. Not yet defined
X. Other (please specify)

[Answer]: A. Keep writing tests after the code

## Q4. [Quality engineer] Test coverage floor

No coverage tool is set up, so coverage cannot be measured. The default for this kind of plan is 80% of lines covered, checked before merge. What should the floor be?

A. 80% of lines, with a coverage tool added and checked before each merge
B. A lower floor (60%), to leave time for features before the deadline
C. No floor; keep the existing test suite passing
D. Not yet defined
X. Other (please specify)

[Answer]: A. 80% of lines, with a coverage tool added and checked before each merge

## Q5. [Release engineer] How judges get to run it

There is no container, hosted demo or deploy step today. Your success metric says a judge can try it in under 5 minutes. How should it be delivered?

A. One command locally (Docker Compose), plus the recorded video
B. A hosted demo on AWS with a judge sign-in, plus the one-command local run
C. Local run with the existing `pnpm` commands only, plus the video
D. Not yet defined
X. Other (please specify)

[Answer]: A. One command locally (Docker Compose), plus the recorded video

## Q6. [Developer] Code style tools

There is no linter or formatter. Should one be added?

A. Add Prettier for formatting and ESLint for common mistakes, run in CI
B. Add Prettier only
C. Keep none; rely on TypeScript strict mode and review
D. Not yet defined
X. Other (please specify)

[Answer]: A. Add Prettier for formatting and ESLint for common mistakes, run in CI

## Q7. [Developer] Commit messages

Commits so far use a type prefix (`feat:`, `chore:`). Should that be a rule?

A. Yes: a type prefix (feat, fix, chore, docs, test) on every commit, plus the requirement ID when there is one (for example `COR-3: ...`)
B. A type prefix only
C. No rule
D. Not yet defined
X. Other (please specify)

[Answer]: A. Yes: a type prefix (feat, fix, chore, docs, test) on every commit, plus the requirement ID when there is one (for example `COR-3: ...`)

## Q8. [Release engineer] Where the checks run (follow-up to Q1, Q4 and Q6)

Three answers do not fit together yet. You chose to commit straight to `main` locally and never push (Q1), so there are no merges, and GitHub CI never runs. But the coverage floor is "checked before each merge" (Q4) and the linter "runs in CI" (Q6). Where should the checks run instead?

A. On every local commit: a git pre-commit hook runs lint, typecheck, tests and the 80% coverage check, and blocks the commit if one fails
B. As one local command you run before committing (`pnpm check`), not enforced
C. Both: the command exists, and the pre-commit hook runs a fast subset (lint and typecheck); the full suite with coverage runs with the command
D. Not yet defined
X. Other (please specify)

[Answer]: X. Other (please specify): no check please

## Q9. [Quality engineer] What "no check" covers (follow-up to Q4, Q6 and Q8)

Earlier you set an 80% coverage floor (Q4) and asked for Prettier and ESLint (Q6). Now you said no checks (Q8). Which do you mean?

A. Nothing runs automatically (no hook, no CI), but the 80% floor, Prettier and ESLint stay; I run them myself when the build is tested
B. Drop the 80% coverage floor too; keep Prettier and ESLint as tools I run by hand
C. Drop all of it: no coverage floor, no Prettier, no ESLint; just keep the existing tests passing
D. Not yet defined
X. Other (please specify)

[Answer]: C. Drop all of it: no coverage floor, no Prettier, no ESLint; just keep the existing tests passing

## Consolidated Summary Confirmation

- Work is committed straight to `main` on this machine, with no branches; nothing goes to GitHub (no push, no pull request, no CI run) until we do it together (Q1, Q8)
- The first piece of new work is a thin end-to-end slice: one register sale, one second-factor sign-in and two stores, wired end to end (Q2)
- Tests are written after the code (Q3)
- No coverage floor, no Prettier, no ESLint and no automated checks; the existing tests keep passing (Q4, Q6, Q8, Q9; Q9 replaces the earlier 80% floor and linter answers)
- Judges run it with one command locally (Docker Compose), plus the recorded video (Q5)
- Every commit message starts with a type prefix (feat, fix, chore, docs, test), plus the requirement ID when there is one (Q7)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
