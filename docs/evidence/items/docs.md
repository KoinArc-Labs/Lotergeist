# R4-J: README and docs rewrite (DOCS)

Owner ask, one line: a judge-ready pilot of the pharmacy tool that works end to end, with encryption, patient-data care, working AI agents (Bedrock plus swappable placeholders), clean docs, and no bugs.

## What changed

- `README.md`: rewritten (pitch, gap, screenshots, 60-second start for Docker and no-Docker, demo accounts for both stores, three scenarios, gap-to-feature table, Mermaid architecture, AI agents with the provider table, security and privacy, safety rules, measured test counts, full env table, layout, Kiro, limitations, licence).
- `docs/DEMO.md`: 3-minute path on the current UI (Start here row, AI draft, AI agents, DSCSA, Refills), 8-minute path, "if something fails" table. Timestamps are labelled as targets.
- `docs/ARCHITECTURE.md`: new diagram (encryption, agents, EPCIS, refills, register, two stores), agent run description, tables, routes, partner and MCP tools, serving and deployment.
- `docs/SAFETY.md`: eleven rules, each mapped to enforcing file paths and the test that proves it, plus other controls.
- `docs/SUBMISSION.md`: new. Devpost write-up, 3-minute shot list, owner checklist.
- `docs/index.html`: landing page updated, two images, no external requests, no scripts.
- `docs/KIRO_USAGE.md`: e2e count updated (13 to 40) only.
- `docs/img/sign-in.jpg`, `today.jpg`, `agents.jpg`: screenshots from a running instance (Playwright, 81 KB, 112 KB, 93 KB).
- `.env.example`: added `DATASET`, `MFA`, `TWO_STORES`, `NIGHT_WATCH`, `MIN_EXPIRY_MONTHS`, `REFILL_GRACE_DAYS`, `SANDBOX_DELAY_MS`, `OFFLINE`, `API_URL` with comments.
- No application code changed.

## Commands run and results

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Lockfile up to date, done |
| `pnpm setup` | OCR assets present, fax image written |
| `pnpm typecheck` | clean (web, api, coroner, epcis, others) |
| `pnpm test` | 19 files, 336 tests passed |
| `pnpm build:web` | built in 1.4 s |
| API on `API_PORT=4530`, temp `DATA_DIR`, `LLM_PROVIDER=mock`, `CORS_ORIGINS=http://localhost:5530` | `/api/health` ok, serves the web build |
| Vite on 5530 with `API_URL=http://127.0.0.1:4530` | proxy works; `/api/auth/config` returns both stores and the demo account |
| Playwright through Vite: sign-in page, `class1-recall` scenario, lookup `D-0611-2026`, Today, AI agents, run an agent | all rendered; screenshots saved |
| `BASE=http://localhost:5530 pnpm e2e` | 40 of 40 on a fresh data directory (MFA check skipped without `MFA=1`). An earlier run on a used data directory stopped at 31 of 32 with one check failing; not investigated. The second run, against a fresh directory, passed fully |
| `keys:status` on the temp data directory | both stores on one key, 0 plaintext, 0 unreadable |
| Mermaid render check (mermaid 11 in Chromium) | README and ARCHITECTURE diagrams both render |
| `docker-compose config` | valid; prints the resolved file (project name `kiroween`) |
| Link check (README, `docs/*.md` except plan.md, `docs/index.html`; href, src and markdown links) | 41 relative links, 0 broken |
| Grep for company and employer names in README, docs, `.env.example` | none |

Ports 4000, 5173 and 5174 were not touched; the demo API on 4000 still answered after my servers were stopped.

## Findings that shaped the docs

- With the web app on a port other than a dev default, every browser POST fails with "That origin is not allowed." until `CORS_ORIGINS` includes that origin. Documented in the README configuration table and in DEMO "if something fails".
- The Vite dev server binds to `localhost` (IPv6), so `127.0.0.1:<port>` refuses connections; the docs use `localhost`.
- `pnpm e2e` and scenarios reset data and invalidate sessions, so a script must sign in again after a scenario call.
- Six scenarios exist (the review notes and KIROWEEN.md say five).

## Not verified

- `docker compose up` and the Docker image build (no Docker daemon reachable; the `docker compose` plugin is also not installed here, so `docker-compose config` was used to validate).
- Live Bedrock, Anthropic or OpenAI-compatible calls. Only the mock and `none` providers ran.
- `pnpm evidence` (rewrites `docs/evidence/accuracy.*` and `timing.*`, which I do not own); the counts there are as the earlier workers left them.
- `MFA=1` end to end.
- The 3-minute path timings: nobody ran it against a clock.
- `docs/KIROWEEN.md` (not mine) still says five scenarios and "296 tests (13 files)".
- `docs/plan.md` was not edited or link-checked; it is a plan with a status note.
- The e2e failure on a used data directory.
