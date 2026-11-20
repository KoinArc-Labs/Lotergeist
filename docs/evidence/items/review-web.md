# R3-H: independent web review (item review-web)

Reviewer stack: API on 4510/4511/4512 (temp data dirs, `LG_DEMO=1 MFA=1`), Vite on 5510/5511. Screenshots: `$KIROCREW_SCRATCH/shots-r3h`, `shots-r3h2` (crawl, every role, 1280x800 and 1440x900) and `shots-e2e` (e2e run).

## Method
`scripts/e2e/crawl.mjs` (new) signs in as pharmacist, technician, cashier, admin (store 7) and the store 2 pharmacist, visits all 15 screens at two viewports and records console errors/warnings, HTTP 4xx/5xx, horizontal overflow, the demo notice, "Loading…" left on screen. It was run against Vite dev and against the API-served production build (so the strict CSP applied). Control labels and button names were checked by script on all 15 screens as pharmacist.

## Findings
| # | Severity | Finding | Action |
|---|---|---|---|
| 1 | major | Persistent demo notice was a shortened, differently cased text ("Synthetic data only · Not for clinical use ...") in the shell banner; Patients and Integrations had no exact rule-10 text at all (Integrations carried a variant). | Fixed: `apps/web/src/components/Shell.tsx` banner now shows the exact rule-10 text on every staff page. Crawl: notice present on all screens, all roles. |
| 2 | major | A wrong MFA code reset the sign-in form to the password step and hid the error (a 401 from `/api/auth/verify` fired the global "unauthenticated" event, which re-rendered SignIn). | Fixed in `apps/web/src/lib/api.ts` (no event for `/api/auth/*`). Covered by new e2e "MFA: a wrong code is refused". |
| 3 | major | Role screens reachable by typed/bookmarked URL: cashier saw an empty Patients shell (API refused with 403 but the UI showed a search box and printed 403s to console); admin could open Fill, Register, Stock help; technician Register/Integrations. | Fixed: route guard in `apps/web/src/App.tsx` mirrors the sidebar rules and shows "Not available for your role". Crawl shows the remaining 403s are only these now-guarded probes (the crawl visits every URL on purpose). API still refuses with 403 (verified: cashier gets 403 on patient search and patient detail, and `/api/rx` carries no DOB or allergies). |
| 4 | minor | No path for a stranger from Today to "notice -> quarantine -> patients -> messages" except the recall banner. | Added a "Start here" row for the pharmacist on Today (`Today.tsx`): Recall notice -> Quarantined lots -> Patients -> Messages (use AI draft) plus a link to AI agents. |
| 5 | minor | Console shows `ERR_SOCKET_NOT_CONNECTED` on first load. | Not a bug in the app: Google Fonts is unreachable in this sandbox. CSP allows `fonts.googleapis.com` and `fonts.gstatic.com`. Offline demos fall back to system fonts; not fixed. |
| 6 | minor (API, not fixed, not my path) | `@fastify/static` is registered with `wildcard:false`, so it lists `apps/web/dist` once at start. Rebuilding the web app while the API runs makes new hashed assets 404 as text/html ("Failed to load module script ... MIME type text/html") until the API restarts. Repro: start API, `pnpm build:web`, load `/`. Expected: new assets served. Observed: blank page, console MIME error. | Listed only. Operational note for the demo: restart the API after `pnpm build:web`. |
| 7 | info | CSP (strict, API-served build): zero violations on all screens for all roles, including the OCR worker and wasm (e2e OCR step passes) and the camera (fake webcam). | none |
| 8 | info | Accessibility: scripted check found no unlabeled inputs/selects/textareas and no unnamed buttons/links on 15 screens (pharmacist). | none |

No layout overflow or "Loading…" left on screen at 1280x800 or 1440x900 on any screen/role in the crawl.

## 3-minute test
Fresh DB, pharmacist, entry point Today. Path: red recall banner "Start recall" -> fax OCR -> lots confirmed -> Quarantine shown in Inventory -> Patients -> Recalls messages with "Use AI draft" -> AI agents "Run with sample input" (mock). Confusion points found: no signpost for the order (fixed by "Start here"), AI agents are only in the sidebar (link added). Not timed with a real stranger; I walked it myself with the e2e script (the recall part takes about 40 s of machine time, OCR dominates).

## e2e (`pnpm e2e`, `BASE=http://localhost:5511`)
Result: 42/42 passed. New coverage in `scripts/e2e/demo-e2e.mjs`: AI Agents list, run Coroner and Recall Outreach Drafter (mock), Recent runs, Test connection; Refills recall-hold row (scenario `recall-aware-refill` plus lookup D-0611-2026); DSCSA export download and sandbox verifier request log; register sale with receipt as cashier; cashier role leak checks (nav, route, API 403, `/api/rx` without DOB/allergies); two-store transfer; MFA sign-in (wrong code refused, sandbox code accepted; skipped with a log line if the API has no `MFA=1`). `BASE` env override already existed; `apiLogin()` now handles MFA. DSCSA verify-at-receiving is covered by the existing receiving steps (TI/TS check on a camera scan, unknown serial refused).
Run note: when the web app runs on Vite (different origin), start the API with `CORS_ORIGINS=http://localhost:<vite port>` or the CSRF origin check returns "That origin is not allowed."

## Gates
`pnpm typecheck` clean; `pnpm test` 13 files, 296 tests passed; `pnpm build:web` OK.

## Could not test
Physical webcam (fake canvas stream only), real Bedrock (mock provider only), real SMS/voice (sandbox only), colour contrast of red/amber chips (not measured; tokens come from kit.tsx and the CSS variables, no change made), technician recall actions (checked once by screenshot/text: "Only a pharmacist works a recall", no e2e step), store 2 screens beyond the crawl, print layout.

## Changed files
/Users/pritesh.borad/pritesh.borad/Kiroween/apps/web/src/components/Shell.tsx, /Users/pritesh.borad/pritesh.borad/Kiroween/apps/web/src/App.tsx, /Users/pritesh.borad/pritesh.borad/Kiroween/apps/web/src/lib/api.ts, /Users/pritesh.borad/pritesh.borad/Kiroween/apps/web/src/screens/Today.tsx, /Users/pritesh.borad/pritesh.borad/Kiroween/scripts/e2e/demo-e2e.mjs, /Users/pritesh.borad/pritesh.borad/Kiroween/scripts/e2e/crawl.mjs
