# Feasibility & Constraints: Questions
## Sources
- [desc] Initial description: "Chimera Rx, a Kiroween 2026 Frankenstein entry, deadline Dec 4 2026. Working code already exists in apps and packages, plan in docs/plan.md. Goal: a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. Find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and plan the build that fills them. Follow .kiro/steering/pharmacy-safety.md. Do not install or add any MCP server."
- [scope] Workflow-selected scope: `mvp`.
## Q1. [Technical] How should judges reach the demo
Judges have little time. The stack is Node 22.5+, SQLite and a React web app, and the API holds a session cookie and background jobs. Which way of reaching it do you want to plan for?
A. One command on the judge's own machine (for example a Docker image or a single script), with no hosting
B. A hosted public URL only
C. Both: a hosted URL as the main path and one command as the backup
D. Not yet defined
X. Other (please specify)
[Answer]: X. Other (please specify): GitHub host
## Q2. [Technical] Where can the hosted demo run
Skip this if you chose A in Q1. Hosting needs an account you control. Which is available?
A. An AWS account you already use
B. A free host such as Fly.io, Render or Railway
C. A home or laptop machine with a tunnel
D. None yet, the plan should pick one
X. Other (please specify)
[Answer]: X. Other (please specify): GitHub
## Q3. [Technical] Which AI provider may the demo use
The code supports Amazon Bedrock, Anthropic, or none (regex and rules only). A judge's copy has no keys of yours.
A. No AI provider in the shared demo: rules and regex only, with AI shown in the video
B. Your own key stays on the hosted demo only, with a spending limit
C. Judges bring their own key, and without one the demo falls back to rules
D. Not yet defined
X. Other (please specify)
[Answer]: X. Other (please specify): we use our own Bedrock locally, with an option for anyone to use their own key if they want to try it
## Q4. [Regulatory] How much compliance wording is allowed
The safety rules ban claims of HIPAA compliance, clinical validity or certification. DSCSA is the "why now" reason in the pitch.
A. Mention DSCSA as the reason the problem exists, and claim no compliance of our own
B. Leave DSCSA out of the pitch entirely
C. Not yet defined
X. Other (please specify)
[Answer]: A. Mention DSCSA as the reason the problem exists, and claim no compliance of our own
## Q5. [Organizational] How many working hours before December 4, 2026
This sets how much of the Q12 "keep retail and production hardening" scope is realistic.
A. Under 20 hours in total
B. 20 to 60 hours
C. More than 60 hours
D. Not sure
X. Other (please specify)
[Answer]: A. Under 20 hours in total
## Q6. [Organizational] Anything that blocks or competes with this work
For example a job, travel, an exam, a change freeze or another entry.
A. Nothing, this is the main focus
B. Something competes for time (describe it)
C. Not yet defined
X. Other (please specify)
[Answer]: A. Nothing, this is the main focus
## Consolidated Summary Confirmation
- Demo access: hosted on GitHub (Q1)
- Hosting location: GitHub (Q2)
- AI provider: your own Bedrock locally, and an option for anyone to use their own key (Q3)
- Compliance wording: DSCSA as the reason the problem exists, no compliance claim of our own (Q4)
- Time budget: under 20 working hours in total (Q5)
- Blockers: none, this is the main focus (Q6)
Does this all look correct before I generate the artifact?
- Looks correct
- Request changes
[Answer]: Looks correct
