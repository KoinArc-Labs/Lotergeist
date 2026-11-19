# API Documentation

Source: `apps/api/src/app.ts`, `partner-api.ts`, `integrations.ts`. All staff routes need the `lg_session` cookie except `/api/health` and `/api/auth/*`; unauthenticated calls get 401 `unauthenticated`. Role checks use `only(req, ...roles)` and return 403 `forbidden`. Validation errors return 422 from zod.

## Staff API (about 80 routes)
| Area | Routes |
| --- | --- |
| Auth | `GET /api/auth/config`, `POST /api/auth/login`, `/sso`, `/logout`, `GET /api/me` |
| Today | `GET /api/today`, `GET /api/search` |
| Receiving | `GET /api/deliveries[/:id]`, `POST /api/deliveries/:id/scan`, `POST /api/packages/:id/putaway`, `/problem` |
| Inventory | `GET /api/lots[/:id]`, `POST /api/lots/:id/move`, `/adjust` |
| Fill | `GET /api/rx[/:rx]`, `/review`, `/change-draft`, `POST /api/rx/:rx/scan`, `/decision`, `POST /api/dispenses/:id/label`, `/verify`, `/sendback`, `/sell` |
| Prescriber | `GET /api/prescriber-messages`, `POST /api/prescriber-messages/:id/respond` |
| Patients | `GET /api/patients[/:id]`, `POST /api/patients/:id/refill-sync` |
| Recalls | `GET /api/recalls[/:id]`, `GET /api/fax`, `POST /api/recalls/lookup`, `/confirm-lot`, `/messages`, `/preview`, `/notifications`, `/results`, `/voicemail`, `/calls`, `/return-pickup`, `/manufacturer-response`, `/close`, `GET /api/recalls/:id/report.pdf` |
| Outreach | `POST /api/outreach/run`, `/api/calls/inbound`, `/api/sms/inbound` (STOP), `GET /api/outbox`, `/api/audio/:id`, `/api/voice` |
| Audit | `GET /api/audit`, `/verify`, `/export` |
| Integrations | `GET/POST /api/integrations`, `POST /api/integrations/:id`, `/rotate`, `/webhooks` |
| Demo | `GET /api/demo/labels`, `POST /api/demo/reset`, `/api/night-watch/run`, `/api/ocr/parse` |

Scan body: `{ raw?, fields?{ndc,lot,expiry,serial}, source?: datamatrix|ocr|typed }`.

## Partner API
OAuth 2.0 client credentials, 1-hour bearer tokens. Scopes (`integrations.ts`): `availability.check`, `inventory.read`, `recall.read`, `rx.change`, `patient.read` (needs a signed BAA flag, a written purpose of at least 10 characters and admin approval).

| Surface | Routes |
| --- | --- |
| Token | `POST /oauth/token` |
| REST | `GET /v1/availability`, `/v1/inventory`, `/v1/recalls/:fda/status`, `/v1/recalled-lots`, `/v1/change-requests`, `POST /v1/change-requests/:id/response`, `GET /v1/patients/:id/medications` |
| MCP | `POST /mcp` stateless JSON-RPC; tools filtered by scope |
| FHIR R4 | `GET /fhir/r4/metadata`, `Medication`, `MedicationDispense`, `Patient/:id` |

Every partner call is written to `api_log`.

## Internal package APIs
- `@chimera-rx/gs1`: `parseElementString`, `isValidGtin`, `ndcHyphenations`, `gtin14ToNdc10Digits`, `yymmddToIso`, `normalizeLot`, `parseNdc`.
- `@chimera-rx/coroner`: `autopsy(text, {llm?, promptPath?})`, `extractRegex`, `reconcile`, `appearsVerbatim`, `createLlmFromEnv`, `parseLlmJson`, `loadPrompt`.
- `@chimera-rx/summoner`: openFDA client, limiter and normaliser exports.
