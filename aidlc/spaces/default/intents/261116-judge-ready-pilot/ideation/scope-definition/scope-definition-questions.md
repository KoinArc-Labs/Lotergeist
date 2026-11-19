# Scope Definition & Prioritization: Questions
## Sources
- [desc] Initial description: "Chimera Rx, a Kiroween 2026 Frankenstein entry, deadline Dec 4 2026. Working code already exists in apps and packages, plan in docs/plan.md. Goal: a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. Find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and plan the build that fills them. Follow .kiro/steering/pharmacy-safety.md. Do not install or add any MCP server."
- [scope] Workflow-selected scope: `mvp`.
## Q1. [Product] Which gap-filling work is a must-have (select all that apply)
Feasibility estimated 17 to 23 hours of work against your budget of under 20. Everything chosen here is protected; the rest is cut first.
A. Live try-out on GitHub (Codespaces with a devcontainer and a README button)
B. Landing page and demo video on GitHub Pages
C. Published recall-to-patients timing number (under 60 seconds)
D. Published lot-extraction accuracy on real openFDA recall records
E. Scenario library and a larger synthetic dataset
F. Kiro usage evidence (specs per module, hooks, steering, AI-DLC record)
X. Other (please specify)
[Answer]: A, B, C, D, E, F
## Q2. [Product] What happens to front-store retail and production hardening
You chose to keep both at intent capture. Feasibility says under 20 hours cannot cover them alongside Q1.
A. Cut both: keep what the code already has, add nothing new, and name them as next steps
B. Keep front-store retail as it is in the code and show it in the video, add nothing new, and cut production hardening
C. Keep production hardening as it is in the code and cut retail
D. Keep both as in the original plan and accept the schedule risk
X. Other (please specify)
[Answer]: D. Keep both as in the original plan and accept the schedule risk
## Q3. [Product] How to order the work
A. Risk first: the live try-out and the accuracy run first, since they could fail
B. Value first: timing number and video first, since judges see them first
C. Dependency first: dataset and scenarios first, since the other items use them
X. Other (please specify)
[Answer]: A. Risk first: the live try-out and the accuracy run first, since they could fail (left to the agent: "you decide what can win me this")
## Q4. [Product] Which date matters most before December 4
A. A working live try-out
B. The demo video
C. A fixed internal freeze date for new work (give the date)
D. None, one final date only
X. Other (please specify)
[Answer]: A, B
## Q5. [Product] What is explicitly out of this pilot
Already out: real patient data, real messages or calls, real connections, compliance claims. Add anything else.
A. Nothing more
B. A native app, a second pharmacy location, and payment handling
X. Other (please specify)
[Answer]: X. Other (please specify): It should include the ability for more locations, but payment handling and real data are out of scope
## Consolidated Summary Confirmation
- Must-haves: live try-out on GitHub, landing page and video on GitHub Pages, timing number, extraction accuracy, scenario library and larger dataset, Kiro usage evidence (Q1)
- Front-store retail and production hardening both stay, with the schedule risk accepted (Q2)
- Order: risk first, live try-out and accuracy run before the rest, chosen by the agent (Q3)
- Key dates: a working live try-out and the demo video (Q4)
- More locations are in scope; payment handling and real data are out (Q5)
Does this all look correct before I generate the artifact?
- Looks correct
- Request changes
[Answer]: Looks correct
