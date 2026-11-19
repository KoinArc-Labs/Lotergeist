# Constraint Register: Chimera Rx judge-ready pilot
## Sources
- [desc] Initial description: "Chimera Rx, a Kiroween 2026 Frankenstein entry, deadline Dec 4 2026. Working code already exists in apps and packages, plan in docs/plan.md. Goal: a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. Find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and plan the build that fills them. Follow .kiro/steering/pharmacy-safety.md. Do not install or add any MCP server."
- [scope] Workflow-selected scope: `mvp`.
- [Q1] Hosted on GitHub.
- [Q2] GitHub as the hosting location.
- [Q3] Own Bedrock locally, optional bring-your-own key.
- [Q4] DSCSA as the reason, no compliance claim.
- [Q5] Under 20 working hours.
- [Q6] No competing work.
## Technical
| ID | Constraint | Source |
|---|---|---|
| T1 | Node 22.5 or newer, pnpm workspaces, SQLite through `node:sqlite`, no build step for packages | [desc] |
| T2 | The API needs a running process with scheduled jobs, so static-only hosting cannot run it | [Q1] [Q2] |
| T3 | AI runs through one client. With no provider set, rules and regex only | [Q3] |
| T4 | Dependencies stay pinned to exact versions | [desc] |
| T5 | No MCP server is installed or added | [desc] |
## Organizational
| ID | Constraint | Source |
|---|---|---|
| O1 | Hard deadline of December 4, 2026 | [desc] |
| O2 | Under 20 working hours in total | [Q5] |
| O3 | One person decides, with no other stakeholders to wait on | [Q6] |
## Regulatory and Safety
| ID | Constraint | Source |
|---|---|---|
| R1 | Synthetic data only. Nothing that looks like PHI | [desc] |
| R2 | No real SMS, email or calls. Messages go to the sandbox outbox | [desc] |
| R3 | No claim of HIPAA compliance, clinical validity, certification or regulatory compliance | [Q4] [desc] |
| R4 | DSCSA is named only as the reason the problem exists | [Q4] |
| R5 | A pharmacist approves every message. AI output is advisory | [desc] |
| R6 | A staff-page notice says the environment is a demo with synthetic data | [desc] |
## Cost and Access
| ID | Constraint | Source |
|---|---|---|
| C1 | Bedrock spend stays on the person's own account and is not exposed to the public | [Q3] |
| C2 | Hosting uses GitHub features only | [Q1] [Q2] |
| C3 | Free Codespaces usage is capped; the real limit is not verified | [assumption] |
## Assumptions & Open Questions
- Whether the GitHub-only rule excludes a free third-party host as a backup was not asked. [assumption]
