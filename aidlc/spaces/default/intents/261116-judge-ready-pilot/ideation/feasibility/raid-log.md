# RAID Log: Chimera Rx judge-ready pilot
## Sources
- [desc] Initial description: "Chimera Rx, a Kiroween 2026 Frankenstein entry, deadline Dec 4 2026. Working code already exists in apps and packages, plan in docs/plan.md. Goal: a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. Find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and plan the build that fills them. Follow .kiro/steering/pharmacy-safety.md. Do not install or add any MCP server."
- [scope] Workflow-selected scope: `mvp`.
- [Q1] Hosted on GitHub.
- [Q2] GitHub as the hosting location.
- [Q3] Own Bedrock locally, optional bring-your-own key.
- [Q4] DSCSA as the reason, no compliance claim.
- [Q5] Under 20 working hours.
- [Q6] No competing work.
## Risks
| ID | Risk | Likelihood | Impact | Mitigation | Source |
|---|---|---|---|---|---|
| RK1 | GitHub Pages cannot run the API, so a "hosted" demo shows only a static page | High | High | Use Codespaces for the live app and Pages for the page and video | [Q1] [Q2] |
| RK2 | Scope exceeds 20 hours | High | High | Cut retail additions and production hardening | [Q5] [desc] |
| RK3 | Judges without a GitHub account or Codespaces quota cannot try it | Medium | Medium | Keep a one-command local run and a video as backups | [Q1] |
| RK4 | The accuracy run on real openFDA records shows a number lower than hoped | Medium | Medium | Publish the real number and explain the verbatim gate that drops unsafe answers | [desc] |
| RK5 | A claim that "nobody does lot-to-patient" is challenged | Medium | Medium | Word it as "not found in the sources checked" | [assumption] |
| RK6 | A judge reads the pitch as a compliance claim | Low | High | Keep the DSCSA wording to the reason only, and keep the demo notice visible | [Q4] |
| RK7 | Without a Bedrock key the hosted demo looks less capable | Medium | Low | Show AI output in the video and explain the rules-only fallback | [Q3] |
## Assumptions
| ID | Assumption | Source |
|---|---|---|
| A1 | The existing code runs the core flow end to end | [desc] |
| A2 | The 20-hour budget covers all work, including the video | [Q5] |
| A3 | Codespaces is available to judges | [assumption] |
## Issues
| ID | Issue | Source |
|---|---|---|
| I1 | The approved intent statement keeps front-store retail and production hardening in scope, which conflicts with the 20-hour budget | [Q5] |
| I2 | The approved intent statement gives November 27, 2026 as the DSCSA deadline, but FDA extended it to 2027 | [assumption] |
## Dependencies
| ID | Dependency | Source |
|---|---|---|
| D1 | openFDA availability for the accuracy run | [desc] |
| D2 | The person's Bedrock access for local AI demos | [Q3] |
| D3 | GitHub features (Pages, Codespaces) | [Q1] [Q2] |
## Assumptions & Open Questions
- The probabilities above are judgment calls, not measured. [assumption]
