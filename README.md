# Chimera Rx

> Every lot accounted for, from the delivery dock to the patient's medicine cabinet.

Chimera Rx is a pharmacy lot ledger. It records the lot and serial of every package when it arrives, when it is shelved and when it is handed to a patient. When the FDA recalls a lot, it finds the units on the shelf and the patients who took one home, and drafts the messages to reach them. A pharmacist approves every step.

**Kiroween 2026 · Frankenstein category.** Built with Kiro. **Synthetic data only. Not for clinical use. Not HIPAA-compliant.** See [docs/SAFETY.md](docs/SAFETY.md).

## The problem

Wholesalers track drugs by lot. Pharmacy dispensing systems track drugs by patient. Almost none record which lot each patient received. So when a lot is recalled, a pharmacy either warns everyone who ever got that drug or warns no one. The lot number is printed in the 2D barcode on every package; it just is never captured at the counter.

## The monster: parts that were never meant to fit

| Part | What it is | Where |
| --- | --- | --- |
| GS1 DataMatrix | The 2D barcode on drug packages, read by a webcam (BarcodeDetector, zxing fallback) or a USB scanner | `packages/gs1`, `apps/web/src/lib/scanner.ts` |
| Fax + OCR | Recall faxes and barcode-less labels read in the browser with tesseract.js; nothing is uploaded | `apps/web/src/lib/ocr.ts`, `apps/api/src/ocr-text.ts` |
| openFDA | The FDA drug enforcement API, live with cached fixtures as fallback | `packages/summoner` |
| Coroner | Regex plus an optional LLM (Amazon Bedrock or Anthropic) that pulls NDC, lots and expiry out of free text. A lot is kept only if it appears verbatim in the source | `packages/coroner` |
| Rx Watcher | Deterministic prescription rules; the LLM may only explain a hit, never remove one | `apps/api/src/rxwatcher.ts`, `drugs.ts` |
| NCPDP SCRIPT | Sandbox `RxChangeRequest` / `RxChangeResponse` to the prescriber | `apps/api/src/prescriber.ts` |
| FHIR R4, REST, MCP | Partner surfaces behind OAuth 2.0 client credentials and per-partner scopes; MCP lets AI agents query the ledger | `apps/api/src/partner-api.ts` |
| Webhooks | HMAC-signed outbound events with retries | `apps/api/src/webhooks.ts` |
| Voice | Recall voicemail rendered with ElevenLabs, OpenAI, macOS or the browser voice. Nothing is dialled | `apps/api/src/voice.ts`, `outreach.ts` |
| Audit | Append-only, hash-chained audit log and a PDF recall report | `apps/api/src/core.ts`, `recall.ts` |

## Try it in one command

```bash
docker compose up        # then open http://localhost:4000
DATASET=large docker compose up   # same, with 500 patients and about 5,000 generated fills
```

Sign in as the pharmacist, `j.rivera@elmstreetrx.example` / `moonlight-rx-2026`, and pick one of five **Demo scenarios** on the Today screen: a Class I recall, a recall for a lot the store never had, a fax with a misread lot, receiving problems, and a suspect product. Each one resets the data and tells you what to try. A pharmacist can also **Reset demo** there.

The Docker build was written but not run on the machine that produced this repo (its Docker daemon was unreachable); the same app was built and served locally with `pnpm build:web` and `pnpm --filter @chimera-rx/api start`.

## Also in this pilot

- **Register** (cashier and pharmacist): over-the-counter items by retail barcode (USB scanner or camera) or name, plus one patient's verified prescriptions in the same sale. Prescriptions need photo ID, counseling and signature; unverified or recalled-lot fills are blocked by name. "Paid" is a label, no payment is processed, and over-the-counter stock is not tracked.
- **Stock help** (technician sees, pharmacist decides): reorder, expiry-risk and shortage suggestions from rules, with the numbers shown. An LLM, if configured, only adds a plain-words explanation. Nothing is ordered or moved for you.
- **Second sign-in factor**: `MFA=1 docker compose up` turns it on.

## Evidence

| Claim | Where | Command |
| --- | --- | --- |
| Lot extraction on 50 real 2025 openFDA recall records | [docs/evidence/accuracy.md](docs/evidence/accuracy.md) | `pnpm evidence:accuracy` |
| Recall to affected-patient list timing, and lot-capture rate | [docs/evidence/timing.md](docs/evidence/timing.md) | `pnpm evidence:timing` |
| How Kiro was used and what was not verified | [docs/KIRO_USAGE.md](docs/KIRO_USAGE.md) | |

The timing is server work over the real HTTP routes, not a person using a browser. Both reports say what they do not show.

## Run it from source

Needs Node 22.5+ and pnpm 12.

```bash
pnpm install
pnpm setup      # once: downloads the OCR model and renders the demo fax image
pnpm dev        # API on :4000, web app on :5173
```

Open http://localhost:5173. All demo accounts share the password `moonlight-rx-2026`:

| Account | Role | Sees |
| --- | --- | --- |
| `j.rivera@elmstreetrx.example` | Pharmacist | Everything, including recalls and verification |
| `k.patel@elmstreetrx.example` | Technician | Receiving, inventory, fill |
| `m.diaz@elmstreetrx.example` | Cashier | Pickup only, no clinical details |
| `s.grant@elmstreetrx.example` | Admin | Integrations only |

The demo store is Elm Street Pharmacy · Store 7, with a recall fax for D-0417-2026 waiting in the inbox. A pharmacist can reset all data from the Receiving or Recall screens.

Optional: copy `.env.example` to `.env`. With no LLM configured the Coroner runs regex-only, which is a tested mode. Set `LLM_PROVIDER=bedrock` or `anthropic` to add the LLM pass.

### Scanning without a real package

Open **Test labels** in the sidebar. It shows real GS1 DataMatrix codes for the demo stock. Hold a phone or a printout up to the webcam, or paste the code into the scan box. A USB scanner works too: it types the code and presses Enter.

## The screens

Sign in, Today, Receiving, Inventory, Fill & pickup, Patients, Recalls, Integrations. The design source is `prototype/`; the full plan is [docs/plan.md](docs/plan.md). A 3-minute walkthrough is in [docs/DEMO.md](docs/DEMO.md).

## Tests

```bash
pnpm test        # unit, API end-to-end and property tests (Vitest + fast-check)
pnpm typecheck
pnpm e2e         # with the stack running: Chromium with a fake webcam and real OCR
```

`pnpm e2e` replaces the camera with a canvas that "holds up" generated labels and a printed text label, then checks scan, put-away, a bad serial, label OCR, a fill, and the fax-to-recall flow through to messages sent.

## Layout

```
apps/api               Fastify API, SQLite (node:sqlite), sandbox notifier, partner API
apps/web               React + Vite, the eight screens
packages/gs1           GS1 element strings, NDC and GTIN rules
packages/summoner      openFDA client with fixture fallback
packages/coroner       lot / NDC / expiry extraction (regex + optional LLM)
fixtures/recalls       50 real 2025 openFDA records and demo recalls, used by the package tests
apps/api/fixtures      the recall fixtures the running app falls back to when openFDA is offline
prototype/  clickable design prototype
.kiro/                 steering, specs, hooks, agents, MCP config
docs/                  plan, architecture, safety, demo, how Kiro was used
```

## Not real, on purpose

- SMS and email go to a sandbox outbox. Calls are simulated; nothing is dialled.
- The prescriber channel is SCRIPT-shaped but sandboxed (no Surescripts).
- The drug rules are a small curated table, not a licensed interaction database.
- "Badge tap / SSO" signs in the pharmacist as a stand-in. The second sign-in factor (a 6-digit code to the sandbox outbox) is built and tested but off by default; start with `MFA=1` to turn it on. While it is on, the badge stand-in is disabled.
- The fridge temperature is simulated, and the screen says so.

## Not verified

- A physical webcam with printed labels and real cartons. The camera path is proven with a fake camera only.
- OCR accuracy on curved vial labels.
- The LLM pass against a live model.

MIT licensed.
