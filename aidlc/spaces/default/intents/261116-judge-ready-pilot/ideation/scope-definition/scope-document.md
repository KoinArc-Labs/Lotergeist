# Scope Document: Chimera Rx judge-ready pilot
## Sources
- [desc] Initial description: "Chimera Rx, a Kiroween 2026 Frankenstein entry, deadline Dec 4 2026. Working code already exists in apps and packages, plan in docs/plan.md. Goal: a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. Find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and plan the build that fills them. Follow .kiro/steering/pharmacy-safety.md. Do not install or add any MCP server."
- [scope] Workflow-selected scope: `mvp`.
- [Q1] Must-haves: live try-out on GitHub, landing page and video, timing number, extraction accuracy, scenarios and larger dataset, Kiro usage evidence.
- [Q2] Front-store retail and production hardening both stay; schedule risk accepted.
- [Q3] Risk first (chosen by the agent at the person's request).
- [Q4] Key dates: working live try-out and demo video.
- [Q5] More locations in scope; payment handling and real data out.
- Upstream: `intent-statement.md`, `feasibility-assessment.md`, `constraint-register.md`, `raid-log.md`.
## Goal
A judge opens the GitHub repo, starts a live demo in a few minutes, and watches a recall become a list of affected patients in under 60 seconds, with a pharmacist approving every message. [Q1] [Q4] [desc]
## In Scope
### Judge access and evidence
- Live try-out on GitHub through Codespaces, with a one-command local run as the backup. [Q1]
- Landing page and demo video on GitHub Pages. [Q1]
- Published timing from recall notice to the list of affected patients, target under 60 seconds on the demo data. [Q1]
- Published lot-extraction accuracy measured on real openFDA recall records. [Q1]
- Scenario library and a larger synthetic dataset. [Q1]
- Kiro usage evidence: specs per module, hooks, steering and the AI-DLC record. [Q1]
### Product
- Receiving, inventory and lot traceability, fill and pickup with lot capture, recall to patients to outreach, and AI that helps the pharmacist decide, as already built. [desc]
- Front-store retail: register and over-the-counter shopping. [Q2]
- Production hardening: second factor, row-level security and more than one pharmacy location. [Q2] [Q5]
### AI
- The presenter's own Bedrock account for local demos, and an option for anyone to bring their own key; without a key the app runs on rules only. [scope]
## Out of Scope
- Payment handling of any kind. [Q5]
- Real data: real patients, real pharmacies, real wholesalers. [Q5] [desc]
- Real SMS, email or calls, and real pharmacy, wholesaler, EHR or e-prescribing connections. [desc]
- Any claim of HIPAA compliance, clinical validity, certification or regulatory compliance. [desc]
- A native app. [assumption]
## Order of Work
Risk first: the live try-out and the accuracy run come first, because they are the items most likely to fail; the timing number, dataset, Kiro evidence and video follow; retail and hardening come last. [Q3]
## Schedule Risk
The must-haves alone were estimated at 17 to 23 hours against a budget of under 20 hours, and retail and hardening add more. The person accepted this risk. The backlog marks retail and hardening as Should and Could, so they are the first to drop if time runs out. Nothing is cut without the person's say. [Q2] [desc]
## Key Dates
| Milestone | Date | Source |
|---|---|---|
| Working live try-out | To be set in delivery planning | [Q4] |
| Demo video | To be set in delivery planning | [Q4] |
| Submission | December 4, 2026 | [desc] |
## Assumptions & Open Questions
- The repo has no `.devcontainer` or Dockerfile today, so the live try-out is new work. [assumption]
- How much of front-store retail and multi-location support already exists in code is not yet measured; reverse engineering will check. [assumption]
- A native app is out because the product rules already list it as a non-goal. [assumption]
- The DSCSA deadline in the intent statement should read November 27, 2027. [assumption]
