# R3-I: independent API safety, security and bug review (REV-API)

Owner ask, one line: a judge-ready pilot of the pharmacy tool that works end to end, with encryption, patient-data care, working AI agents (Bedrock plus swappable placeholders), clean docs, and no bugs.

Scope: apps/api/ and packages/. Sandbox pilot review. Nothing here is a compliance, certification or clinical-validity claim.

## Commits

| Commit | What |
|---|---|
| c8fa5df | fix: encrypt agent records and drafts, fail closed on a wrong key, whole-token lot gate, fill/sell double-submit, admin and cashier PHI reads, 404 for unknown recalls; role-by-route matrix and probes |
| e6134c1 | fix: recall text preview is staff-only; matrix re-signs in after reset so the scenario route is checked |
| 1b62e93 | docs: REV-API evidence |
| (follow-up) | fix: REV-API serve the web build from disk per request (bug 7) |

## Bugs found and fixed

| # | Severity | Bug | How it was found | Fix | Regression test |
|---|---|---|---|---|---|
| 1 | High | `ai_runs` (input, rule_output, raw_output, gated_output, dropped) and `ai_drafts` (subject, body) were stored in plaintext. Agent runs and refill/recall drafts held patient first names, drug names and dates. | Raw SQLite + WAL byte dump after a full scenario: hits in `ai_runs.rule_output` and `ai_runs.gated_output` | Added both tables (and `suspect_cases.note/close_note`) to `PROTECTED` in apps/api/src/protect.ts; declared both tables in apps/api/src/db.ts so a file database seals them on open | apps/api/test/review-encryption.test.ts |
| 2 | High | A wrong or lost key did not fail closed. `openLenient` returned the envelope as text, so the API would show `enc:v1:...` as a patient name and write new rows under a different key. With the file provider, a deleted `data.key` silently made a new key. | Restarted the server with a different key | `Db` now checks every stored key id at open and throws `CryptoError unknown_key` ("refusing to start"). `keys:status` sets `ALLOW_UNREADABLE_KEYS=1` so it can still report | apps/api/test/review-keys.test.ts; live: server on :4520 with a swapped key exits 1 with that error |
| 3 | High (rule 4) | The COR-3 gate stripped all whitespace and did a substring match. It accepted a slice of a lot (`PRORX0509` out of `PRORX050925-1`), a single digit (`7`), tokens joined across punctuation (`PRORX050925-1,EXP`, `EXP09/30/2027;LotPRORX050925-3`) and digits from inside a lot (`050925`). All were emitted as `llm` lots at 0.85. | Fuzz of `autopsy()` with a hostile model | `appearsVerbatim` in packages/coroner/src/reconcile.ts now needs a whole token: case folded, whitespace runs treated as one space, and no lot character (A-Z, 0-9, `-`, `/`) on either side of the match. Unicode lookalikes and zero-width marks were already refused and still are | packages/coroner/test/verbatim-gate.test.ts (16 hostile cases + 300-run property). 8 of its 18 tests fail on the old gate |
| 4 | High | Double submit of a fill scan dispensed two packages for one prescription. `scanFill` checked `status = 'to_fill'` before awaiting the Rx Watcher model call, then wrote without checking again. | Two concurrent scans with a 50 ms model: both returned 200 | Conditional updates inside the transaction (`... AND status = 'to_fill'`, package `... AND status = 'on_shelf'`, sell `... AND state = 'verified'`); the second request gets 409 | review-probes.test.ts "two concurrent fill scans" (fails before the fix with [200, 200]) |
| 5 | Medium | Admin could read the fill queue and any prescription (names, DOB, phone, allergies); admin and cashier could read the sandbox outbox (every message body and address) and the recall message preview (a patient's name and fields); `POST /api/recalls/:id/preview` merged patient fields for any signed-in role. | GET probe per role | `GET /api/rx`, `/api/rx/:rx`: cashier, technician, pharmacist. `GET /api/outbox`, `/api/recalls/:id/messages`, `POST /api/recalls/:id/preview`: technician, pharmacist. Search returns no prescriptions to admin | review-probes.test.ts "least privilege"; review-matrix.test.ts |
| 6 | Low | `POST /api/recalls/<unknown>/manufacturer-response` crashed with 500; `close` and `return-pickup` wrote an audit row for a recall that does not exist. The manufacturer response hard-coded "Elm Street Pharmacy · Store 7" and "J. Rivera", so store 2 sent the wrong store name. | Matrix run (pharmacist 500) | `mustExist()` gives 404; body uses the actor's store name and the pharmacist's own name | review-probes.test.ts "error bodies" |
| 7 | Medium (demo) | The API listed `apps/web/dist` once at start (`@fastify/static` with `wildcard: false`). After `pnpm build:web` with the API running, the new hashed assets fell through to the not-found handler and came back as index.html (`text/html`), so the browser refused the module script and the page was blank until a restart. Reported by the web reviewer (docs/evidence/items/review-web.md, item 6). | Web reviewer's repro; regression test fails on the old code with "expected 'text/html' to match /javascript/" | apps/api/src/app.ts: `wildcard: true`, so each request is looked up on disk. The not-found handler gives a plain 404 to a missing file (any path with an extension), and serves index.html (`Cache-Control: no-cache`) only for app routes. `/api/*` keeps its JSON 404 | apps/api/test/review-static.test.ts (rebuilds a temp dist while the app runs). Live on :4520 with the real dist: asset 200 `application/javascript`, missing asset 404 `text/plain`, `/recalls` 200 `text/html` |

## Role-by-route matrix (state-changing routes)

Generated by apps/api/test/review-matrix.test.ts with the app injected. Route URLs are read from source (`app.post("/api/...")` in apps/api/src and apps/api/src/agents), so a new route is picked up automatically. Each route gets a valid minimal body so a 422 cannot hide a missing role check. The test fails if a role outside the allow list gets anything but 401 or 403. A second test calls every `/api/*` route with no session and expects 401 (all pass, except the public sign-in routes). `/api/transfers` needs the two-store setup and has its own test (anonymous 401; cashier, technician, admin 403; pharmacist 409 `recalled` on a recalled lot). Partner routes (`/v1`, `/mcp`, `/fhir`, `/oauth`) use partner tokens and are covered by apps/api/test/platform.test.ts.

200 marks an allowed role that succeeded; 404, 409 or 422 for an allowed role means the role check passed and the fake id or state stopped it.

| Route (POST) | anon | cashier | technician | admin | pharmacist |
|---|---|---|---|---|---|
| /api/deliveries/:id/scan | 401 | 403 | 404 | 403 | 404 |
| /api/packages/:id/putaway | 401 | 403 | 409 | 403 | 409 |
| /api/packages/:id/problem | 401 | 403 | 409 | 403 | 409 |
| /api/lots/:id/move | 401 | 403 | 200 | 403 | 200 |
| /api/lots/:id/adjust | 401 | 403 | 422 | 403 | 422 |
| /api/rx/:rx/review | 401 | 403 | 404 | 403 | 404 |
| /api/rx/:rx/decision | 401 | 403 | 403 | 403 | 404 |
| /api/prescriber-messages/:id/respond | 401 | 403 | 403 | 403 | 404 |
| /api/rx/:rx/scan | 401 | 403 | 404 | 403 | 404 |
| /api/dispenses/:id/label | 401 | 403 | 409 | 403 | 409 |
| /api/dispenses/:id/verify | 401 | 403 | 403 | 403 | 409 |
| /api/dispenses/:id/sendback | 401 | 403 | 403 | 403 | 409 |
| /api/dispenses/:id/sell | 401 | 409 | 403 | 403 | 409 |
| /api/recalls/lookup | 401 | 403 | 403 | 403 | 422 |
| /api/recalls/:id/confirm-lot | 401 | 403 | 403 | 403 | 404 |
| /api/recalls/:id/preview | 401 | 403 | 200 | 403 | 200 |
| /api/recalls/:id/notifications | 401 | 403 | 403 | 403 | 404 |
| /api/recalls/:id/voicemail/preview | 401 | 403 | 403 | 403 | 200 |
| /api/recalls/:id/voicemail | 401 | 403 | 403 | 403 | 404 |
| /api/outreach/run | 401 | 403 | 403 | 403 | 200 |
| /api/calls/inbound | 401 | 200 | 200 | 200 | 200 |
| /api/recalls/:id/return-pickup | 401 | 403 | 403 | 403 | 404 |
| /api/recalls/:id/manufacturer-response | 401 | 403 | 403 | 403 | 404 |
| /api/recalls/:id/close | 401 | 403 | 403 | 403 | 404 |
| /api/night-watch/run | 401 | 403 | 403 | 403 | 200 |
| /api/ocr/parse | 401 | 200 | 200 | 200 | 200 |
| /api/sms/inbound | 401 | 200 | 200 | 200 | 200 |
| /api/patients/:id/refill-sync | 401 | 403 | 403 | 403 | 200 |
| /api/integrations | 401 | 403 | 403 | 200 | 403 |
| /api/integrations/:id | 401 | 403 | 403 | 404 | 403 |
| /api/integrations/:id/rotate | 401 | 403 | 403 | 404 | 403 |
| /api/integrations/:id/webhooks | 401 | 403 | 403 | 404 | 403 |
| /api/register/sales | 401 | 422 | 403 | 403 | 422 |
| /api/stock-help/decision | 401 | 403 | 403 | 403 | 200 |
| /api/epcis/import | 401 | 403 | 403 | 403 | 422 |
| /api/dscsa/verify | 401 | 403 | 422 | 403 | 422 |
| /api/dscsa/cases | 401 | 403 | 403 | 403 | 422 |
| /api/dscsa/cases/:id/quarantine | 401 | 403 | 403 | 403 | 404 |
| /api/dscsa/cases/:id/close | 401 | 403 | 403 | 403 | 404 |
| /api/refills/draft | 401 | 403 | 200 | 403 | 200 |
| /api/refills/send | 401 | 403 | 403 | 403 | 200 |
| /api/agents/provider | 401 | 403 | 403 | 200 | 200 |
| /api/agents/provider/test | 401 | 403 | 403 | 200 | 200 |
| /api/agents/:id/run | 401 | 403 | 200 | 200 | 200 |
| /api/demo/reset | 401 | 403 | 403 | 403 | 200 |
| /api/demo/scenarios/:id | 401 | 403 | 403 | 403 | 404 |

Notes on this table:
- `/api/sms/inbound` (a patient's STOP reply) and `/api/calls/inbound` (a patient calling back) are sandbox simulators any signed-in role can trigger. They only set an opt-out or a callback time. Not changed.
- `/api/ocr/parse` is a pure parser (no write).
- Coroner and Night Watch agents may be run by admin; both are read-only and confirm nothing.

## Reads that name patients (GET, after the fixes, Class I recall scenario)

| Route | cashier | technician | admin |
|---|---|---|---|
| /api/agents/provider | 200 | 200 | 200 |
| /api/agents/runs | 200 | 200 | 200 |
| /api/audio/1 | 404 | 404 | 404 |
| /api/audit | 403 | 403 | 200 |
| /api/deliveries | 200 | 200 | 200 |
| /api/demo/labels | 200 | 200 | 200 |
| /api/demo/scenarios | 200 | 200 | 200 |
| /api/epcis/imports | 403 | 200 | 403 |
| /api/fax | 200 | 200 | 200 |
| /api/integrations | 403 | 403 | 200 |
| /api/lots | 200 | 200 | 200 |
| /api/me | 200 | 200 | 200 |
| /api/outbox | 403 | 200 | 403 |
| /api/patients?q=a | 403 | 200 | 403 |
| /api/prescriber-messages | 403 | 200 | 403 |
| /api/recalls/D-0417-2026 | 200 | 200 | 200 |
| /api/recalls/D-0417-2026/messages | 403 | 200 | 403 |
| /api/recalls/D-0417-2026/results | 200 | 200 | 200 |
| /api/register/patients?q=a | 200 | 403 | 403 |
| /api/rx | 200 | 200 | 403 |
| /api/search?q=ab | 200 | 200 | 200 |
| /api/stock-help | 403 | 200 | 403 |
| /api/stores | 200 | 200 | 200 |
| /api/today | 200 | 200 | 200 |
| /api/voice | 200 | 200 | 200 |

`/api/me`, `/api/search` and `/api/rx` (cashier) still carry staff emails or patient names for the pickup hand-over; the cashier fill list carries no DOB or allergies (fill.ts `full` flag). `/api/lots` and `/api/recalls/:id` carry lot and count data only.

## The 11 safety rules, probed against the code

| Rule | Probe | Result |
|---|---|---|
| 1 Synthetic data only | Grep of seed.ts, seed-store2.ts, dataset.ts, scenarios.ts, apps/api/fixtures, all test dirs for phones, emails, SSNs; `scripts/phi-guard.sh --all` | Pass. Phones are all `(555) 010-xxxx`; emails are `*.example` or `example.com`; no SSN pattern; phi-guard exit 0. One non-555 number (800-345-1329) is a manufacturer's toll-free line inside a public openFDA recall record in fixtures/recalls/real-2025.json, not patient data |
| 2 Nothing reaches a real person | Grep for SMS, email and telephony SDKs (none); every outbound `fetch` listed: openFDA, shortages feed, Anthropic and OpenAI-compatible model calls, ElevenLabs/OpenAI TTS, partner webhooks | Pass. Only `SandboxNotifier` sends. Recall send, voicemail start and refill send each need `attest: true` and a pharmacist, and re-read consent at send time (refills-routes.ts, recall.ts `channelsFor`, outreach.ts). Agent drafts have no send path. Store-2 mirrored recalls only quarantine (crossstore.ts); store 2's pharmacist still attests. Webhook payloads carry ids only |
| 3 A pharmacist decides | Role matrix above (all POST routes, 5 roles) | Pass after fixes 5 and 6. Confirm lot, verify, send, voicemail, refill send, decisions, transfers, DSCSA case close and EPCIS commit are pharmacist-only |
| 4 Never invent a lot | Coroner property tests (packages/coroner/test/coroner.test.ts) + new hostile fuzz (verbatim-gate.test.ts) | Failed before fix 3; pass after. Agents test "liar" cases still pass |
| 5 Low confidence needs a person | Code read plus existing tests: `lookupRecall` auto-confirms only `confidence >= 0.95 AND expiry <> ''` and only for a pharmacist actor; Night Watch and fax ingest pass `actor = null` with `autoConfirm: false`; the Night Watch agent test "a digest that confirms nothing" | Pass. Model-only lots are capped at 0.85, so they are never auto-confirmed |
| 6 Rules before the LLM, advisory label | rxwatcher.ts: model findings are added as `severity: monitor`, `source: llm`, "AI suggestion, lower confidence. Not a rule hit."; flags count `source = 'rule'` only. Every agent route returns `label: "AI advisory, a pharmacist decides"` (checked live on :4520) ; stock help carries an `advisory` line | Pass |
| 7 Inferred is not read | review-probes.test.ts: a scan with no serial returns `inferredSerial: true`; dscsa.test.ts "marks a serial without a real read as inferred and never writes it as an EPC" | Pass (API). UI display is the web reviewer's scope |
| 8 Recalled stays blocked | `activeRecallFor` ignores recall status, so closing does not unblock. Existing tests: receiving and fill refuse; register blocks (FR3.5); refills stay blocked after close; DSCSA case cannot be cleared; both stores block (two-stores Q4). New: transfer of a recalled lot gives 409 `recalled`. EPCIS import writes advisory `trace_imports` only and never moves stock | Pass |
| 9 Patient messages are minimal | Existing hostile-provider tests: agents.test.ts "a liar cannot put a name, phone, patient id, medicine or reason into a draft"; refills.test.ts "a lying provider cannot make a draft name another patient, a voicemail name the medicine, or a text drop the phone and STOP"; store-flow "adds STOP to every text" | Pass |
| 10 Persistent notice | Web scope | Not reviewed here |
| 11 No claims | Grep of tracked files (excluding node_modules, aidlc/, and the .kiro framework folders) for HIPAA, compliant, certified, validated, FDA-approved | Pass for apps/ and packages/ (hits are negations, the "11-digit HIPAA NDC form" term, and "certified Surescripts intermediary" as a future integration). Two items for the owner, outside my paths: prototype/Main.dc.html line 87 still says "Access is logged for HIPAA audit" (the app's sign-in was fixed, the old mockup was not); docs/plan.md and prototype/plan.md section 11 "Compliance map / How Chimera Rx supports it" is a production-target plan behind a status note, not a claim about the pilot |

## Encryption and keys

- Raw bytes after a full scenario (all 7 agents run, refill draft and send, recall lots confirmed, 24 recall messages sent, voicemail started, patient profile view, refill sync, Rx reviews, a STOP reply, a register lookup, a DSCSA case with a name in the note): 216 needles (every patient name, first and last name, DOB, phone, email, allergy and condition) searched in the `.sqlite` and `-wal` files and in every text column. 0 hits after fix 1. The test also asserts that ai_runs, ai_drafts, outbox, notifications, outreach_calls, audit and rx_findings have rows, so the scan covers them.
- Live server on port 4520 with a temp DATA_DIR (two stores): after a Class I scenario, a patient view, the outreach drafter and a refill draft, `grep` of both stores' sqlite, wal and shm files for "Maria Alvarez", "Alvarez", "010-0142", "example.com", "Penicillin": 0 hits each. The request log had 0 lines matching patient names, phones, patient ids or `reason=`; log lines carry the route pattern only.
- `DATA_KEY` unset: `.keys/` created mode 0700 and `data.key` mode 0600 (test and live `stat`).
- Wrong key: refuses to start (fix 2), in test and live.
- `keys:rotate` with the server stopped: 1,059 values re-encrypted to a new key id; `keys:status` reports 0 plaintext and 0 unreadable for both stores; after restart `GET /api/audit/verify` returned `ok: true, brokenAt: null`. The unit test also verifies the chain after rotation and after reopening the file.
- Agent API key: review-probes.test.ts pastes a key, runs the provider test and the Coroner, then searches every response, every table (including ai_runs and audit) and every request log line. The key is not in any of them; only its last four characters appear as `keyHint`.

## Other probes (review-probes.test.ts)

| Probe | Result |
|---|---|
| Db.tx nesting | Code read: savepoints `sp<depth>`, inner failure rolls back to its savepoint and rethrows; outer failure rolls back the whole transaction. Covered by security.test.ts "a rotation that fails part way rolls that database back whole". No issue |
| Double submit | Fill scan: fixed (bug 4). Sell: conditional update added. Receiving scan, voicemail start and recall send check and write in the same synchronous tick, so a second request sees the first one's row (no await in between) |
| Ledger invariant | `ledgerViolations` is empty after the race test, the edge-input test, transfers (two-stores) and register (pilot-platform) |
| TODAY / timezone | `todayIso(ctx)` comes from `cfg.today` or the clock; refills and expiry use it. Night Watch crons are pinned to UTC. Not changed |
| Edge inputs | Negative adjust count, negative or 1e9 register quantity: 4xx. SQL-looking, NUL, RTL-override and 2,000-byte emoji search strings: 200, tables intact. 3 MB body: 413 |
| Error bodies | No stack, SQL, file path, patient name or phone in 4xx bodies, including a garbled scan that contained a name |
| X-Forwarded-For | 25 failed sign-ins with 25 different XFF values: the 21st onward gets 429 (`trustProxy` is off unless `TRUST_PROXY=1`) |
| Origin / CORS | Foreign, lookalike (`localhost:5173.evil.example`), `null` and wrong-port origins: 403 on a state change. A foreign preflight gets no `Access-Control-Allow-Origin` |
| Cookies | HttpOnly, SameSite=Lax (Secure with COOKIE_SECURE=1, existing test). An attacker-set `lg_session` before sign-in is replaced, not adopted |
| MFA first factor only | With MFA on: password gives 202 and no cookie; the challenge used as a cookie gets 401 on /api/me, /api/rx, /api/patients, /api/outbox; badge stand-in returns 501; 12 wrong codes end in 401/423/429, never a session |

## Web bug for the web reviewer (not fixed here)

- Cashier sees "Sandbox outbox" in the sidebar and `/outbox` is in `CLINICAL` in apps/web/src/App.tsx `ACCESS`. After fix 5 the API returns 403 to a cashier there. Repro: sign in as m.diaz, open `#/outbox`, the list fails to load. Fix: move `/outbox` to `STAFF` in `ACCESS` and hide the sidebar item for cashier in apps/web/src/components/Shell.tsx. scripts/e2e/crawl.mjs visits `/outbox` and may report it for cashier.

## Commands run

- `pnpm typecheck`: all 6 workspaces done, 0 errors.
- `pnpm test` (vitest run): 19 files, 336 tests passed. My new tests: review-matrix (4), review-encryption (1), review-keys (3), review-probes (13), review-static (1), coroner verbatim-gate (18) = 40.
- `bash scripts/phi-guard.sh --all`: exit 0.
- Live server: `API_PORT=4520 DATA_DIR=<mktemp> NIGHT_WATCH=0 OFFLINE=1 LLM_PROVIDER=mock npx tsx src/server.ts`; then the wrong-key restart, `npx tsx scripts/keys.ts rotate` and `status` with the server stopped, and a restart for `/api/audit/verify`. Ports 4000, 5173 and 5174 were not touched; my 4520 server was stopped afterwards.
- `pnpm build:web` not run: no web files changed.

## Not tested, or left as is

- Live Bedrock and other live model providers (no credentials used; mock and stubbed providers only). Live model latency is what makes bug 4 likely, which the slow stub reproduces.
- Real TLS, HSTS behind a real proxy, and `TRUST_PROXY=1` behind a proxy that sets XFF correctly.
- TTS: when ELEVENLABS or OpenAI TTS keys are set, the voicemail script (patient first name, pharmacy phone, no medicine or reason) is sent to that vendor. Off by default; worth a line in docs/SECURITY.md.
- Webhook URL check (admin-only) blocks IPv4 private ranges by hostname but not IPv6 private ranges, decimal IP forms or DNS names that resolve to private addresses. Payloads carry ids only. Low; left as is.
- Rule 10 (persistent notice) and UI display of inferred serials are web scope.
