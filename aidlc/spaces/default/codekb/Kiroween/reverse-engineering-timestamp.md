# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-18
- Commit: c3e3a1755050462758231c79a95e069d291c3185

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: judge-ready-pilot
fingerprint: 159c4bb20a10b819b23766b659363130dd299e6f
analyzed:
  paths:
    - apps/api/src/core.ts
    - apps/api/src/app.ts
    - apps/api/src/server.ts
    - apps/api/src/config.ts
    - packages/coroner/src/
    - .github/workflows/
  components:
    - Ledger core
    - packages/coroner
shallow:
  paths:
    - apps/api/src/
    - apps/web/src/
    - packages/gs1/src/
    - packages/summoner/src/
    - apps/api/test/
    - packages/gs1/test/
    - packages/coroner/test/
    - packages/summoner/test/
    - fixtures/
    - scripts/
    - docs/
```
