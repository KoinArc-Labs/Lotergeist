# Evidence: item R1-A, encrypt patient data at rest and harden API security

Requirement ids: SEC-1 (encryption at rest, key ring, rotation), SEC-2 (API hardening), SEC-3 (docs/SECURITY.md).
Synthetic data only. Sandbox pilot: no compliance claim.

## What changed

New files
- `apps/api/src/crypto.ts`: AES-256-GCM `FieldCipher`, envelope `enc:v1:<keyId>:<iv>:<tag>:<ct>`, key ring, `KeyProvider` interface with `EnvKeyProvider`, `FileKeyProvider` (`data/.keys/data.key`, mode 0600, older keys in `retired.keys`) and `KmsKeyProvider` (placeholder that throws "not configured").
- `apps/api/src/protect.ts`: the list of protected columns and the SQL rewriter that finds which bound parameters (or string literals) land in protected columns. Fails closed on any other write shape.
- `apps/api/src/keyadmin.ts` and `apps/api/scripts/keys.ts`: `keyStatus` and `rotateKeys` (one transaction per store database, new key durable before use, `keys.rotate` audit event).
- `apps/api/src/security.ts`: headers, sign-in throttling per IP and per account, CSRF origin check, no-body route guard, PHI-free request log, error body builder.
- `apps/api/test/security.test.ts` (30 tests), `docs/SECURITY.md`, this file.

Edited (small, additive)
- `apps/api/src/db.ts`: `Db` seals protected columns on write and opens envelopes on read; encrypts plaintext left by an older build when a file database opens; `sessions.last_seen` column.
- `apps/api/src/app.ts`: registers security, stricter CORS (allowlist instead of reflecting every origin), error handler uses `publicError`, `trustProxy` from `TRUST_PROXY`.
- `apps/api/src/auth.ts` and `config.ts`: session idle timeout (`SESSION_IDLE_MINUTES`, default 30).
- `apps/api/src/patients.ts`, `register.ts`, `outreach.ts`, `mfa.ts`: searches that used SQL `LIKE` on encrypted columns (name, dob, phone, to_addr) now filter on opened rows. New helper `findPatientByPhone` (also used by the STOP reply route in `app.ts`).
- `apps/api/src/fill.ts`: `phi.view` audit event when an order is opened (patient id only).
- `apps/api/src/seed.ts`: one `UPDATE` that used string literals now uses bound parameters.
- `apps/api/package.json`: `keys:status`, `keys:rotate`. `.env.example`: `KEY_PROVIDER`, `DATA_KEY`, `DATA_KEY_PREVIOUS`, `NEW_DATA_KEY`, `COOKIE_SECURE`, `SESSION_IDLE_MINUTES`, `CORS_ORIGINS`, `TRUST_PROXY`.

Decision: name search decrypts in memory instead of an HMAC blind index. A blind index only supports exact match; the Patients and Register screens need substring search on names. Cost at pilot scale is milliseconds. Written up in docs/SECURITY.md.

## Commands and results

- `pnpm typecheck`: api and web pass.
- `pnpm test`: 9 files, 174 tests pass (144 existing + 30 new). Existing tests were not edited.
- `pnpm build:web`: passes (web was not touched).
- Live smoke on a temp `DATA_DIR`, API on port 4417 (not the demo ports): `/api/health` returned the CSP, nosniff, no-referrer, permissions-policy (`camera=(self)`), X-Frame-Options, COOP/CORP and `no-store`; sign-in and `/api/patients?q=brooks` returned decrypted data; the server log lines held only method, route pattern, status, ms, actor, store, ip; `.keys/` was mode 0700 and `data.key` 0600.
- `pnpm --filter @chimera-rx/api keys:status` on that directory: both stores `plaintext values: 0, unreadable values: 0`, 926 and 62 values under one key id. `keys:rotate`: "Rotated 988 values from key 69dce8df to key 8a52857d"; `keys:status` afterwards showed every value under the new id, 0 plaintext, 0 unreadable; `retired.keys` existed mode 0600; `grep -c Brooks` on the sqlite and WAL files returned 0.

## What each test proves (apps/api/test/security.test.ts)

- fast-check round trip over 300 arbitrary strings, envelope shape; 200 seals of one value give 200 different ciphertexts (random IV).
- Tamper detection in IV, tag and ciphertext; malformed and non-envelope input rejected.
- Wrong key: unknown key id, and a forged key id pointing at another key (`auth_failed`).
- Ring with an old key opens old values after the current key changes; 32-byte key check; KMS placeholder error text; unknown `KEY_PROVIDER`; key file mode 0600.
- `rewriteProtected` maps parameters and literals correctly, leaves other columns alone and throws on expressions and `INSERT ... SELECT`. Every protected table and column exists in the schema.
- Raw-file test: both stores (seed, second store, 40-patient generated history) are checkpointed, then the `.sqlite` and `-wal` bytes are searched for every synthetic name, phone, email, date of birth, allergy, condition and long directions string: none found; `enc:v1:` present; the key is not in the files.
- Routes still work on plaintext: name, phone digits and `MM/DD/YYYY` date-of-birth search; profile view; STOP reply found by phone.
- Audit: `/api/audit/verify` returns `ok` with rows; `patient.view` and `phi.view` recorded; the audit JSON holds none of the synthetic PHI strings; `audit.reason` is encrypted in the file.
- Rotation: every value ends under the new key id, no plaintext, rows equal before and after, `data.key` holds the new key, `retired.keys` has both, `keys.rotate` audited, the chain still verifies, a fresh `Db` opened from the key files reads the rows, the files still hold no plaintext.
- A rotation that fails part way (injected error after 20 seals) leaves that database whole and readable under its old key, and writes still work.
- A tampered envelope in a table is never returned as plaintext and increments the failure counter. A database from an older build with plaintext rows is encrypted on open.
- Headers present on API, health and 404 responses; cookie has HttpOnly, SameSite=Lax, Secure (when configured).
- Idle timeout: still valid after two 20 minute gaps, closed and deleted after a 31 minute gap.
- Rate limit: 20 failures from one IP across different accounts gives `429` with `Retry-After`; another IP is fine; the block lifts after 16 minutes. Unknown account names are limited after 10 failures; a real account locks (423) after 5.
- CSRF: foreign `Origin` on a POST gets 403, same origin passes, CORS preflight from a foreign origin gets no allow header.
- Errors: enum, bad-JSON, wrong-type, too-long and extra-body requests return 4xx without echoing the sent name or phone; an injected internal error returns `{"error":"Something went wrong."}`.
- Request log lines contain no query text, name, phone, patient id, reason or password.
- Role checks: a technician gets 403 on the audit log and recall lookup.

## Bug found by the tests

`TABLE_RE` in `protect.ts` did not match `UPDATE` statements at first, so `UPDATE patients SET phone = ?` was written in plaintext. The raw-file test caught it (four seed values in the file). Fixed; the raw-file and `rewriteProtected` tests now cover UPDATE.

## Skipped or not verified

- Not run in a browser: the CSP was built from the Vite output and the web source (own scripts, OCR worker from `/ocr`, inline styles, Google Fonts) but I did not load the built app with the header on and watch the console. If a screen shows a CSP violation, loosen only that directive.
- `outbox.subject` and `notifications.subject` stay plaintext: existing flows and tests filter on them in SQL, and recall subjects can name a drug.
- AWS KMS provider is a placeholder, as asked. No TLS in the app. Rate-limit counters are in memory and per process.
- Partner surfaces (`/v1`, `/mcp`, `/fhir`, `/oauth`) got the headers, request log and error builder (they use the same app) but I did not add new throttling to them; they already have per-key rate limits.
- Zod coverage: I checked every `/api` POST route by reading `app.ts` (all parse a schema or are in the no-body list). GET query strings (`q`, `filter`, `reason`) are not zod-validated.
- The demo stack on ports 4000 and 5173: both had no listener when I checked at about 11:49. I ran `pkill -f src/server.ts` to stop my own port-4417 server, and that pattern would also match a demo API started as `tsx watch src/server.ts`, so I may have stopped it. I did not restart it, because the first start with this code encrypts `data/chimera-rx*.sqlite` in place and creates `data/.keys/`. Restart with `bash scripts/run-stack-bg.sh /tmp/chimera-stack.log` when ready. The `data/` files are untouched by me (last modified 11:25 before my work).
- Existing live demo databases: an older database opened for the first time with this code is encrypted in place and its key is created in `data/.keys/` (gitignored). Back that directory up with the data.
