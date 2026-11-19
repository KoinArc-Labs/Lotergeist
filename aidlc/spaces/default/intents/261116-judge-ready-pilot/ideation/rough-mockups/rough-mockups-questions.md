# Rough Mockups & Concept Visualization: Questions
## Sources
- [desc] Initial description: "Chimera Rx, a Kiroween 2026 Frankenstein entry, deadline Dec 4 2026. Working code already exists in apps and packages, plan in docs/plan.md. Goal: a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. Find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and plan the build that fills them. Follow .kiro/steering/pharmacy-safety.md. Do not install or add any MCP server."
- [scope] Workflow-selected scope: `mvp`.
## Q1. [Design] What the mockups should cover
The existing screens already have design prototypes in `prototype/*.dc.html` (Dashboard, Receive, Inventory, Dispense, Patients, Recall, Integrations). This pilot adds new surfaces.
A. Only the new surfaces: landing page, judge try-out start, scenario picker, published numbers page, front-store register, location switcher
B. New surfaces plus a refresh of the existing screens
C. Only the judge path through existing screens, no new surfaces
X. Other (please specify)
[Answer]: A. Only the new surfaces: landing page, judge try-out start, scenario picker, published numbers page, front-store register, location switcher
## Q2. [Design] Where a judge enters
A. The landing page on GitHub Pages, with a "Try it live" button that opens Codespaces
B. Straight into the app sign-in, with a demo role picker
C. A guided tour inside the app that walks the recall story
D. A and C together
X. Other (please specify)
[Answer]: D. A and C together
## Q3. [Design] How a judge picks a scenario
A. A scenario picker on the Today screen (for example "Class I recall", "Low-confidence lot", "Recalled lot at receiving")
B. A demo tools menu only
C. No picker; one fixed story
X. Other (please specify)
[Answer]: A. A scenario picker on the Today screen (for example "Class I recall", "Low-confidence lot", "Recalled lot at receiving")
## Q4. [Design] Devices to support
A. Desktop browser only
B. Desktop plus tablet at the counter
C. Desktop, tablet and phone
X. Other (please specify)
[Answer]: B. Desktop plus tablet at the counter
## Q5. [Design] Accessibility target
A. WCAG 2.2 AA on the judge path: keyboard only, visible focus, labels, contrast
B. Basic: labels and contrast only
C. No target set
X. Other (please specify)
[Answer]: A. WCAG 2.2 AA on the judge path: keyboard only, visible focus, labels, contrast
## Consolidated Summary Confirmation
- Mockups cover only new surfaces: landing page, try-out start, scenario picker, published numbers page, front-store register, location switcher (Q1)
- Judges enter from the GitHub Pages landing page with "Try it live", then a guided tour inside the app (Q2)
- Scenario picker on the Today screen (Q3)
- Desktop and counter tablet (Q4)
- WCAG 2.2 AA on the judge path (Q5)
Does this all look correct before I generate the artifact?
- Looks correct
- Request changes
[Answer]: Looks correct
