# Evidence: AI agent platform (AGT-1)

Pilot sandbox, synthetic data. Output is advisory; a pharmacist decides. No compliance claim.

## What changed

- `apps/api/src/agents/providers.ts`: provider registry (`bedrock` default via Converse, `anthropic`, `openai-compatible`, `mock`, `none`), live runtime override, key held in memory only, error scrubbing, 60 s pause after a failed call, Test connection.
- `apps/api/src/agents/agent.ts`: framework (run records in `ai_runs`, latest 300; `ai_drafts`), PHI scan of every prompt before a call, de-identification of free text, audit of every run.
- Agents: `coroner.ts`, `rx.ts`, `outreach.ts`, `nightwatch.ts`, `stock.ts`, `copilot.ts`. Routes: `routes.ts` (`GET /api/agents`, `/api/agents/:id`, `/runs`, `/drafts`, `/provider`; `POST /api/agents/:id/run`, `/provider`, `/provider/test`).
- Shared files, small edits: `core.ts` (optional `ctx.agents`), `app.ts` (one register call), `server.ts` (runtime, `ctx.llm` follows the live provider, Night Watch digest cron), `partner-api.ts` (3 MCP tools, `await` on tool run), `integrations.ts` (scope `agents.read`), `recall.ts` (Coroner uses `ctx.llm` when present), `rxwatcher.ts` (allergy classes removed from the existing prompt), `packages/coroner/src/llm.ts` (exports `loadBedrockSdk`), `.env.example`.
- Web: `apps/web/src/screens/AIAgents.tsx`, nav entry in `Shell.tsx`, route in `App.tsx`.
- Docs: `docs/AGENTS.md`.
- Tests: `apps/api/test/agents.test.ts` (54 tests).

## Commands and results

| Command | Result |
|---|---|
| `pnpm typecheck` | pass, no errors in api, web, coroner, gs1, summoner |
| `npx vitest run` | 10 files, 228 tests pass (the 144 existing ones included, plus 54 new, plus tests added by other workers) |
| `pnpm build:web` | pass |
| `bash scripts/phi-guard.sh` | no findings |
| live server on port 4310, temp `DATA_DIR`, `LLM_PROVIDER=mock` | all six agents ran through `POST /api/agents/:id/run` with `useSample`; the scheduler wrote a Night Watch digest at start-up |
| Playwright screenshot of `/agents` after one click on the Outreach Drafter | screen renders: provider card, six agents, rules vs AI columns, dropped list, drafts marked "Draft. Nothing was sent.", recent runs, demo notice on top |

## What the tests prove

- Every agent runs on `mock` and on `none` (mode `ai` vs `rules only`, advisory label, stored record, audit row).
- Liar provider, per gated agent:
  - Coroner: an invented lot is dropped and listed; every emitted lot is printed in the source; non-JSON falls back to regex.
  - Rx Explainer: every rule hit survives with source `rule`; a false "all clear" summary and `removeRules` are dropped; AI notes are `monitor` and labelled; the stored review is untouched.
  - Outreach Drafter: a patient name, another phone, an email, an unknown placeholder, a patient ID, the medicine and the recall reason never reach a draft; the outbox row count is unchanged (nothing sent).
  - Night Watch: invented numbers and "confirmed/sent" claims are dropped.
  - Stock Advisor: an explanation with a new number is dropped; the rule numbers do not move.
  - Copilot: a write tool (`confirm_recall_lot`) is never run; an invented lot, patient ID or name is dropped; a technician cannot read patient IDs.
  - A provider that throws leaves rules-only output with the key scrubbed from the error.
- PHI: a spy provider records every prompt from all six agents, every prescription, and a copilot question containing a patient's name, phone, email and date of birth. No name part, DOB, phone or email of any patient appears; patient IDs do. A leaking prompt is refused and not sent.
- Keys: a pasted key shows as last four characters; it is absent from responses, console output, the audit table, `ai_runs` and error text; a new runtime does not have it; only pharmacist or admin can change or test; unsafe base URLs are refused.
- Adapters: Bedrock against a stubbed SDK (request shape, region, model, client reuse, scrubbed errors, pause), Anthropic and OpenAI-compatible against stubbed `fetch`.
- Routes and MCP: role checks, sample run in one call, bounded run table, drafts endpoint, MCP tools only for a partner with `agents.read`, read-only annotations, no patient IDs in partner output.

## Live Bedrock

`aws sts get-caller-identity` failed: `InvalidClientTokenId` (the security token is invalid). I did not read credential files. I then pointed the running server at `bedrock` and pressed Test connection: the SDK reached AWS and was refused ("The security token included in the request is invalid", 375 ms). A Coroner run then fell back to "rules only" with the lots PRORX050925-1 and -3 from regex. **The live Bedrock success path was not exercised, so no real Bedrock answer through the Coroner is recorded.** The adapter is tested only against a stubbed SDK client.

## Not done or not verified

- The Anthropic and OpenAI-compatible adapters ran only against stubs, never a live endpoint.
- Drafts are listed on the AI agents screen and by `GET /api/agents/drafts`. They are not wired into the Recalls screen's send flow; a pharmacist copies from a draft. Wiring them into that flow was left out to avoid editing `Recalls.tsx`.
- Provider choice is process-wide, not per store.
- Mock output is canned; it shows the plumbing, not model quality.
