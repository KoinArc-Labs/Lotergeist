# Component Inventory

## apps/api
Fastify 5 server composing every domain module; depends on gs1, coroner, summoner.

## apps/web
React 18 SPA, the only UI; 10 screens; depends on gs1 and the API.

## packages/gs1
Pure GS1 element parsing, NDC to GTIN-14 conversion and check digit. No dependencies.

## packages/coroner
Lot and NDC extractor: regex pass, optional LLM pass (Bedrock or Anthropic), verbatim reconcile. Depends on gs1, zod, the AWS Bedrock client.

## packages/summoner
openFDA client with rate limiter and normaliser. Depends on zod.

## Ledger core
`apps/api/src/core.ts`, `db.ts`, `domain.ts`: audit chain, lotEvent, scan resolution, product learning, schema.

## Receiving and inventory
`receiving.ts`, `inventory.ts`: delivery scans, TI/TS check, put-away, problems, lot move and adjust.

## Fill and Rx review
`fill.ts`, `rxwatcher.ts`, `prescriber.ts`, `drugs.ts`: fill scan with inferred serial, deterministic Rx rules, change requests.

## Recall engine
`recall.ts`, `today.ts`, `ocr-text.ts`: lookup, confirm, quarantine, impact, notify, report, Night Watch poll, fax ingest.

## Outreach and notify
`outreach.ts`, `notify.ts`, `voice.ts`: agent, sandbox notifier, voice providers (ElevenLabs, OpenAI, macOS say, browser).

## Partner platform
`integrations.ts`, `partner-api.ts`, `webhooks.ts`, `auth.ts`: partners, scopes, OAuth, REST, MCP, FHIR, signed webhooks, staff sessions.

## Seed and config
`seed.ts`, `config.ts`, `server.ts`, `index.ts`: Elm Street Pharmacy synthetic seed, env config, cron wiring.

## Web scan and OCR
`apps/web/src/lib/scanner.ts`, `ocr.ts`, `components/ScanPanel.tsx`: BarcodeDetector with zxing fallback, local tesseract OCR.
