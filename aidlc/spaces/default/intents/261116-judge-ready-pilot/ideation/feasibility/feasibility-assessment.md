# Feasibility Assessment: Chimera Rx judge-ready pilot
## Sources
- [desc] Initial description: "Chimera Rx, a Kiroween 2026 Frankenstein entry, deadline Dec 4 2026. Working code already exists in apps and packages, plan in docs/plan.md. Goal: a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. Find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and plan the build that fills them. Follow .kiro/steering/pharmacy-safety.md. Do not install or add any MCP server."
- [scope] Workflow-selected scope: `mvp`.
- [Q1] Demo access: hosted on GitHub.
- [Q2] Hosting location: GitHub.
- [Q3] AI provider: the person's own Bedrock locally, with an option for anyone to use their own key.
- [Q4] Compliance wording: DSCSA as the reason the problem exists, no compliance claim of our own.
- [Q5] Time budget: under 20 working hours in total.
- [Q6] Blockers: none.
- Upstream: `intent-statement.md` of intent-capture and the market research reports (same intent folder).
## Verdict
Feasible with cuts. The working code already covers the core claim, so the remaining work is packaging, evidence and a demo, not new features. Under 20 hours the plan must drop at least one of front-store retail and production hardening. [Q5] [desc]
## Technical Viability
| Area | Assessment | Basis |
|---|---|---|
| Core product (lot capture, recall to patients, outreach) | Already built and tested in the repo | [desc] |
| One-command run | Viable. The repo already has `pnpm dev`, `pnpm setup`, and a Node 22.5 or newer requirement | [assumption] |
| Hosted demo "on GitHub" | Partly viable. GitHub Pages serves static files only, while the API needs a running Node process, SQLite and scheduled jobs | [Q1] [Q2] |
| AI with a local Bedrock account | Viable for the presenter. The code reads the provider from `LLM_PROVIDER`, and `none` falls back to rules | [Q3] |
| AI for judges | Viable as bring-your-own-key. Without a key the app runs on rules and regex | [Q3] |
| Published numbers (60 seconds, extraction accuracy, 5 minutes to try) | Measurable with scripts. Needs a timing script, an accuracy run on real openFDA records and a timed fresh-clone trial | [desc] |
## Options for Hosting on GitHub
| Option | What judges get | Fit | Cost of the choice |
|---|---|---|---|
| A. GitHub Codespaces with a devcontainer that starts the app | A live running app in the browser after one click and a GitHub sign-in | Best fit for the whole app. Free usage is capped, so check current limits | Hours: add `.devcontainer`, an auto-start task and a README button |
| B. GitHub Pages with a static front end and a built-in mock API | A public URL with no sign-in | Shows the screens, but not the real backend | Larger: the front end needs a mock layer, which duplicates logic |
| C. GitHub Pages for a landing page and demo video, plus Codespaces or a clone for the live app | A public page that links to the video and the live try-out | Covers the video, the story and the live path | Small |
| D. GitHub Actions to build and test only | Evidence of quality | Not a way to run the demo | Small |
Recommendation: C with A as the live path. This matches "hosted on GitHub" and keeps the real backend. [Q1] [Q2] [assumption]
## Fit With the 20-Hour Budget
| Work item | Rough hours | Basis |
|---|---|---|
| Devcontainer, auto-start, README try-out path | 3 to 4 | [assumption] |
| Timing script and published 60-second number | 2 | [assumption] |
| Extraction accuracy run on real openFDA records and a short report | 3 to 4 | [assumption] |
| Scenario library and a larger synthetic dataset | 3 to 4 | [assumption] |
| Demo video script and recording | 3 to 4 | [assumption] |
| Kiro usage evidence (specs, hooks, steering, AI-DLC record) | 2 to 3 | [assumption] |
| Landing page on GitHub Pages | 1 to 2 | [assumption] |
| Total | about 17 to 23 | [assumption] |
The total sits at or above the budget, so the cut below is needed. [Q5]
## Recommended Cuts
- Do not add new retail shopping features. Keep what the code already has and show it only if it fits the video. [Q5] [desc]
- Do not add production hardening (second factor, several stores, row-level security) in this pilot. Mention it as the next step. [Q5] [desc]
- This reverses two "keep" choices in the approved intent statement, so it is a decision for the scope-definition stage to confirm. [assumption]
## Compliance View
The pitch names DSCSA as the reason the problem exists and makes no compliance claim of its own. [Q4] The small-dispenser exemption now runs to November 27, 2027, which corrects the 2026 date in the approved intent statement (see `market-trends.md`). [assumption]
## Assumptions & Open Questions
- The repo's current deploy shape (any Dockerfile or devcontainer) was not inspected in this stage; the hour estimates assume none exists. [assumption]
- Codespaces free usage limits and whether judges need a GitHub account were not verified. [assumption]
- Whether the Kiroween rules require a hosted URL, or accept a repository plus video, was not checked. [assumption]
- Whether the person's Bedrock account can be shared safely on a public demo was not decided; the answer given keeps it local. [Q3]
