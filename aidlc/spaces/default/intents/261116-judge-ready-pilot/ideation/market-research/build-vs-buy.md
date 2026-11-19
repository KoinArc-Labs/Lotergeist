# Build vs Buy vs Partner: Chimera Rx
## Sources
- [desc] Initial description: "Chimera Rx, a Kiroween 2026 Frankenstein entry, deadline Dec 4 2026. Working code already exists in apps and packages, plan in docs/plan.md. Goal: a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. Find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and plan the build that fills them. Follow .kiro/steering/pharmacy-safety.md. Do not install or add any MCP server."
- [scope] Workflow-selected scope: `mvp`. Market research runs on its own at the person's request.
- [Q1] Competitor focus on pharmacy systems and recall or DSCSA tools.
- [Q2] All five gaps in play.
- [Q3] Research informs both the pitch and build or cut choices.
- Web sources: see `competitive-analysis.md` and `market-trends.md` (same folder) for [W1] to [W12].
## Decision Table
| Capability | Build | Buy or use | Partner | Recommendation | Reason |
|---|---|---|---|---|---|
| Lot and serial capture at receiving and fill | Yes | | | Build | This is the core claim, and the code exists. [Q2] |
| Recall to patient list | Yes | | | Build | Same link; this is the headline 60-second demo. [Q3] |
| Recall notice reading (lot extraction) | Yes | | | Build, publish accuracy | Verbatim gate and property tests are already the differentiator. [Q3] |
| Recall data | | openFDA, free and weekly | | Use | Real records make the accuracy number credible. [W6] |
| Full dispensing, billing and payer handling | | | | Do not build | Table stakes in existing systems; out of reach before December 4. [desc] |
| Real SMS, email and calls | | | | Do not add | The safety rules require a sandbox outbox. [desc] |
| Enterprise DSCSA exchange with trading partners | | | TraceLink-style networks | Show as a future partner, do not build | Out of scope and not demonstrable on synthetic data. [Q2] |
| AI for decision help | | Bedrock or Anthropic behind one client | | Use, with rules first | The code already supports "none", so the demo can run with no key. [desc] |
| Hosting | | Free or low-cost host | | Decide in feasibility | Depends on the feasibility answers. [assumption] |
| Partner surfaces (REST, MCP, FHIR) | Yes, exists | | | Keep, show in the video | Supports the "open" gap. [Q2] |
## Positioning Statement (draft)
Chimera Rx links every package a pharmacy handles to the patient who took it home, so a recall becomes a list in seconds and a pharmacist decides what to send. [Q2] [Q3]
Wording rule: say "in the sources checked, no pharmacy system was found that does this", never "no one does this". [assumption]
## Assumptions & Open Questions
- Whether a hosted demo or one-command run is the primary path comes from the feasibility questions. [assumption]
- The research did not verify any competitor's recall feature in a live product. A one-hour trial or demo video review of PioneerRx or Liberty recall handling would turn the hypotheses into facts. [assumption]
