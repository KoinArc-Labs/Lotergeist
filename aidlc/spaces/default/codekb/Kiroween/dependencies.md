# Dependencies

## Internal (workspace)
| From | To |
| --- | --- |
| @chimera-rx/api | gs1, coroner, summoner |
| @chimera-rx/coroner | gs1 |
| @chimera-rx/web | gs1 |
| @chimera-rx/summoner | none |
| @chimera-rx/gs1 | none |

Packages must not import from apps (steering rule; holds in the files read).

## External runtime services (all optional or sandboxed)
- openFDA `api.fda.gov` `/drug/enforcement` and `/drug/ndc` (summoner, `core.ts learnProduct`); `OFFLINE=1` skips product learning; Night Watch is off when `NIGHT_WATCH=0`.
- Amazon Bedrock or Anthropic API for the Coroner and Rx explanations; `LLM_PROVIDER=none` turns it off.
- ElevenLabs, OpenAI, macOS `say` or browser speech for voicemail.
- No real SMS, email or telephony provider.

## External packages
Listed with versions in `technology-stack.md`. Notable: `@aws-sdk/client-bedrock-runtime` is the only AWS dependency; `tesseract.js` build scripts are disabled in `pnpm-workspace.yaml` (`allowBuilds`), OCR assets are fetched by `pnpm setup` into `apps/web/public/ocr/`.

## Supply-chain controls
`pnpm-workspace.yaml` sets `minimumReleaseAgeExclude` for five packages pinned at newly released versions; `pnpm-lock.yaml` is frozen in CI.
