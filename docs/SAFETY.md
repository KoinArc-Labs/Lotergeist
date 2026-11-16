# Safety

Chimera Rx is a hackathon demo. It is **not** a medical device, **not** HIPAA-compliant and **not** for clinical use. Nothing here is legal or regulatory advice.

- **Synthetic data only.** Patients (`S-0417` style IDs), staff, the store, deliveries and every serialized package are invented. Phones use the fictional `(555) 010-01xx` range and emails use `example.com`. The recall fixtures include real public openFDA enforcement records, which contain no patient data.
- **Nothing reaches a patient.** SMS and email are written to a sandbox outbox (`SandboxNotifier`); there is no real messaging provider. Voicemail is rendered to audio but never dialled; call outcomes are simulated. Sending requires a pharmacist's attestation, and consent is checked at the moment of sending. Texts always carry the pharmacy phone and "Reply STOP to opt out."; STOP is honoured from then on.
- **A pharmacist decides.** Only a pharmacist confirms recall lots, verifies a fill, approves a flagged prescription or sends messages. AI output is advisory.
- **No invented lots.** The Coroner keeps a lot only if it appears verbatim (case-insensitive, whitespace-normalized) in the notice. An LLM answer that fails this check is dropped, not repaired. Lots under 0.95 confidence, or with no expiry, need the pharmacist's per-lot confirmation.
- **Rules before the LLM.** Rx Watcher's findings come from deterministic rules. An LLM may explain a finding or add a lower-confidence "possible issue"; it can never remove a rule hit.
- **Recalled lots stay blocked.** A confirmed lot is quarantined and refused at receiving and at fill, even after the recall is closed.
- **OCR is a suggestion.** Text read from a label or fax is shown for a person to check and edit before it is used. Labels read by OCR have no serial; the package gets an internal ID and the TI/TS check shows a warning.
- **Schedule II.** Receiving a C-II package or changing its count needs a second staff member, signed in with their own password, as witness. Count changes need a pharmacist.
- **Least privilege for partners.** Each partner gets its own client secret (stored hashed), scopes, IP allowlist and rate limit. Patient data needs the `patient.read` scope, a BAA flag and an admin's approval. Every call is logged.
- **Outbound calls from the server.** The API calls openFDA, the optional LLM and voice providers when their keys are set, and partner webhook URLs that an admin registers. Webhooks are HMAC-signed and do not follow redirects.
- **Tamper-evident audit.** Each audit row carries the hash of the previous one; `GET /api/audit/verify` recomputes the chain.
- **PHI guard.** `scripts/phi-guard.sh` blocks commits containing SSN-shaped numbers or labelled dates of birth. It runs as a git pre-commit hook (`pnpm hooks:install`), a Kiro PreToolUse hook and in CI.
- **Secrets** live in environment variables, never in the repo (`.env.example` lists them).
- **Accessibility.** Focus rings, ARIA labels and reduced-motion handling are in place. No formal contrast audit or screen-reader pass has been run.
- **Data sources.** openFDA's terms apply. In its own words, it should not be relied on to make decisions about medical care.
