# Evidence: repo cleanup and Kiroween criteria map (R2-G)

Pilot sandbox, synthetic data. No application behaviour changed.

## What changed

- Added `docs/KIROWEEN.md`: criteria with sources, a criteria-to-repo map, Kiro features actually used, a submission checklist and gaps.
- `.kiro/settings/mcp.json`: removed the `dead-registry` server entry. It pointed at `@chimera-rx/dead-registry-mcp` and tools (`autopsy`, `plan_hearse`) from the removed earlier project; no such package exists in the workspace. The entry was already `disabled`.
- `.gitignore`: added `coverage/`, `*.tsbuildinfo`, `.vite/`, `.eslintcache`.
- `docs/plan.md`: added a status note at the top. The plan names PostgreSQL, Redis, CDK and `services/`, `connectors/`, `infra/` folders that the pilot does not have (it runs on `node:sqlite`). I kept the file because `docs/KIRO_USAGE.md` and other docs cite it as the source plan.
- `docs/DEMO.md`: removed a named manufacturer from one line about the real recall.
- Removed the untracked `docs/evidence/items/.gitkeep`: the folder now holds tracked files, so it is not needed.

## Inventory result

Every other tracked file is referenced by a script, test, doc, CI or `package.json` (checked by grep for `make-fax`, `keys.ts`, the evidence scripts, `run-stack-bg.sh`, `usage-log.sh`, `install-hooks.sh`, `refresh-fixtures`, `ocr-assets`). No empty files. No tracked build output, logs, `.DS_Store` or sqlite files (`git ls-files` filter). `data/`, `dist/` and `apps/web/public/ocr/` are ignored.

## Not removed, and why

- `fixtures/recalls` vs `apps/api/fixtures/recalls`: `real-2025.json` and `real-d0526-2026.json` are byte-identical, but `demo-synthetic.json` differs (the app copy has two extra records and different expiry text). Package tests, the Coroner spec, the refresh scripts and the custom agent read the root folder; the app and the evidence script read the app folder, and each loads its folder whole. Deduping would change test inputs, so I left both.
- `prototype/` (including `prototype/plan.md`), `.kiro/`, `aidlc/`, `LICENSE`: protected.

## Findings from the scans

Scanned the tree without `node_modules`, `.git`, `aidlc/`, built output and `pnpm-lock.yaml`.

- `bash scripts/phi-guard.sh --all`: exit 0.
- Secrets (`AKIA`, `sk-`, private keys, `ghp_`): no real hits. Matches were minified vendor code in `node_modules` and `apps/web/public/ocr` (OCR wasm glue).
- SSN-shaped strings: only a test fixture inside `node_modules`.
- Phones outside `(555) 010-01xx`: all in the reserved fictional `555-010` block (for example `(555) 010-2200` for the demo pharmacy, `555-010-0142` in an SMS test). One real manufacturer address in `fixtures/recalls/real-2025.json` is public openFDA data. No action.
- Emails not at `example.com`: staff and store sign-in addresses use the `.example` top-level domain (`elmstreetrx.example`, `birchavenuerx.example`) in `apps/api/src/seed.ts`, `seed-store2.ts`, `app.ts`, tests, `README.md` and `docs/DEMO.md`. I did not change them: that alters sign-in behaviour and touches files other workers edit. The brief says `example.com`; the owner should decide.
- Company names: no `[a forbidden company name]` in tracked files outside `aidlc/`. Not edited, reported:
  - `aidlc/spaces/default/memory/project.md` line 63 contains the name inside the rule that forbids it. The same text is in ignored copies, `aidlc/active-memory/project.md` and `.kiro/steering/aidlc-active-memory.md` (gitignored, so not committed).
  - `aidlc/spaces/default/intents/261116-judge-ready-pilot/audit/mac-borad-1418-local-fc0935229a00.md` repeats the git name `pjborad-dcli`.
- Git metadata: the commit author name `pjborad-dcli` and an employer-domain email are in every commit. I cannot change that without rewriting history. The owner should decide before the repo goes public.
- The local `origin` remote is `https://github.com/pjborad/Lotergeist.git`, a legacy project name.
- Real third-party names remain where they are factual: openFDA record data in fixtures, and market and standards references in `docs/plan.md` (wholesalers, an e-prescribing network, two recall-service vendors), `README.md` and code comments. I read the "no company name" rule as aimed at the owner's employer and clients, not at product and standards references. The owner should confirm; `docs/plan.md` lines 38, 134, 199, 235, 238 and 380 are the places to edit for a stricter reading.
- A grep for `dcli` matched `InvalidClientTokenId` in `docs/evidence/items/agents.md`: false positive.

## Commands and results

- `pnpm install --frozen-lockfile`: lockfile up to date.
- `pnpm typecheck`: all packages passed.
- `pnpm test`: 13 files, 296 tests passed (includes the original 144).
- `pnpm build:web`: built in 1.4 s.
- Not run: `pnpm e2e` (needs the demo stack; ports 4000 and 5173 belong to the running demo).

## Kiroween research

The 2026 Devpost pages (`/`, `/rules`, forum) returned HTTP 403. The criteria in `docs/KIROWEEN.md` are the 2025 ones, from the Kiro launch post and a community summary, labelled as such, plus two 2026 entrant posts for the Frankenstein wording and the deadline.

## Skipped or unverified

- The 2026 official criteria and rules.
- Whether the GitHub repository is public.
- Fixture dedupe (reason above).
