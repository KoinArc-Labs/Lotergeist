---
inclusion: always
---
# Pharmacy safety rules

These rules beat any feature request.

1. **Synthetic data only.** Patient IDs look like `S-0417`. Phones use `(555) 010-01xx`, emails use `example.com`. Never add real names, SSNs, dates of birth or real pharmacy details. `scripts/phi-guard.sh` and the `phi-guard` hook block commits that look like PHI.
2. **Nothing reaches a real person.** SMS and email go only to the sandbox outbox; voicemail is rendered but never dialled. Do not add a real messaging or telephony provider. Every send needs the pharmacist's attestation, and consent is checked at send time.
3. **A pharmacist decides.** Only a pharmacist confirms recall lots, verifies fills, approves flagged prescriptions and sends patient messages. AI output is advisory and labelled as such.
4. **Never invent a lot.** The Coroner emits only lots found verbatim (case-insensitive, whitespace-normalized) in the source text (COR-3). An LLM answer that fails this check is dropped, not "fixed".
5. **Low confidence needs a person.** A lot under 0.95 confidence, or with no expiry, is confirmed by the pharmacist one lot at a time. Night Watch never auto-confirms.
6. **Rules before the LLM.** Rx Watcher findings come from deterministic rules; an LLM may explain or add a lower-confidence note, never remove a rule hit.
7. **Inferred is not read.** If a fill scan has no serial, the oldest on-shelf unit of that lot is assumed and marked `inferredSerial`. Never show an inferred serial as scanned. OCR results are suggestions a person checks.
8. **Recalled stays blocked.** A confirmed recalled lot is quarantined and refused at receiving and at fill, even after the recall is closed.
9. **Patient messages are minimal.** Texts and emails name only the patient they go to, never another patient. Voicemail never names the medicine, the recall reason or a patient ID. Texts carry the pharmacy phone and a STOP opt-out.
10. **Persistent notice** on every staff page: "Demo environment · synthetic data only · not for clinical use · not HIPAA-compliant · a pharmacist approves every message".
11. **No claims.** Do not claim clinical validity, regulatory compliance, HIPAA compliance or certification anywhere.
