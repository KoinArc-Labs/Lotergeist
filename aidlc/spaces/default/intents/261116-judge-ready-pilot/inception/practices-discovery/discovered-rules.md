# Discovered Rules

Only hard constraints the person or the project rules stated. Sources: the interview (practices-discovery-questions.md), aidlc/spaces/default/memory/project.md and the steering files pharmacy-safety.md, tech.md and product.md. Upstream context: code-structure.md, technology-stack.md, dependencies.md, code-quality-assessment.md, architecture.md, business-overview.md.

## Mandated

- ALWAYS start every commit message with a type prefix (feat, fix, chore, docs or test), plus the requirement ID when there is one, for example COR-3: ... (interview Q7).
- ALWAYS use synthetic data only: patient IDs like `S-0417`, phones `(555) 010-01xx`, emails at `example.com` (pharmacy-safety.md rule 1).
- ALWAYS route SMS and email to the sandbox outbox only, with the pharmacist's attestation and a consent check at send time (pharmacy-safety.md rule 2).
- ALWAYS let a pharmacist decide recall lot confirmation, fill verification, flagged-prescription approval and patient messages (pharmacy-safety.md rule 3).
- ALWAYS emit only lots found verbatim in the source text; drop an LLM answer that fails the check (pharmacy-safety.md rule 4, COR-3).
- ALWAYS show the persistent demo notice on every staff page (pharmacy-safety.md rule 10).
- ALWAYS record every person-made state change through `audit()` and every lot movement through `lotEvent()` (tech.md).
- ALWAYS enforce role checks on the server (tech.md).
- ALWAYS pin exact dependency versions (tech.md).

## Forbidden

- NEVER git push to any remote; commit everything locally only (project.md, learned 2026-11-16).
- NEVER push, open a pull request, or send anything to GitHub until the person does it together with the agent (interview Q1 and Q8).
- NEVER write any company name anywhere in the project (project.md, learned 2026-11-16).
- NEVER add real patient data, a real messaging or telephony provider, or real pharmacy, wholesaler, payer or Surescripts connections (pharmacy-safety.md rules 1 and 2, product.md non-goals).
- NEVER claim clinical validity, regulatory compliance, HIPAA compliance or certification (pharmacy-safety.md rule 11).
- NEVER show an inferred serial as scanned, and NEVER auto-confirm a lot under 0.95 confidence or with no expiry (pharmacy-safety.md rules 5 and 7).
- NEVER let a recalled lot pass receiving or fill, even after the recall closes (pharmacy-safety.md rule 8).
- NEVER let `packages/gs1`, `packages/summoner` or `packages/coroner` import from `apps/*` (tech.md).
