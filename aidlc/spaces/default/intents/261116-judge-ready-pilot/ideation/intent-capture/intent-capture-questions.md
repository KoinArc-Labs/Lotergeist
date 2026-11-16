# Intent Capture & Framing: Questions

## Sources

- [desc] Initial description: "Chimera Rx, a Kiroween 2026 Frankenstein entry, deadline Dec 4 2026. Working code already exists in apps and packages, plan in docs/plan.md. Goal: a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. Find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and plan the build that fills them. Follow .kiro/steering/pharmacy-safety.md. Do not install or add any MCP server."
- [scope] Workflow-selected scope: `mvp`.

## Q1. [Product] The problem the pilot solves

The pitch has to name one problem a judge remembers. Which problem should Chimera Rx be framed around?

A. The lot-to-patient gap: when a lot is recalled, a pharmacy cannot tell which patients received that lot, so it warns everyone or no one
B. Slow, manual recall response: finding stock and contacting patients takes hours of phone calls and spreadsheets
C. Both A and B, with A as the headline
D. Pharmacy operations as a whole (receiving, inventory, fill), with recalls as one feature
E. Not yet defined
X. Other (please specify)

[Answer]: X. Other (please specify): do your research but i wanted to mention something about mordenizing the pharmacy retails systems where everything one place to go shop and filling all the market gaps. Introducing AI to optimize the help to make decisions

## Q2. [Product] The customer the story is told for

The demo and video follow one person through the product. Who is that person?

A. The pharmacist in charge at an independent retail pharmacy
B. Compliance or operations staff at a pharmacy chain
C. A hospital or clinic pharmacy team
D. The judges themselves, with no customer persona
E. Not yet defined
X. Other (please specify)

[Answer]: X. Other (please specify): Pritesh

## Q3. [Product] What success means (select all that apply)

These become the numbers the pilot publishes and the demo proves. Which ones count?

A. From recall notice to a list of affected patients in under 60 seconds on the demo data
B. A published lot-capture rate (share of fills with lot and serial recorded), target 99% or higher
C. A published lot-extraction accuracy measured on real openFDA recall records
D. A judge can try it in under 5 minutes, hosted or with one command
E. Not yet defined
X. Other (please specify)

[Answer]: A, B, C, D (left to the agent: "you decide")

## Q4. [Product] Which judging criterion needs the most work

Kiroween scores three criteria equally: Potential Value, Implementation (how well Kiro was used) and Quality and Design. The code already works, the Kiro specs cover only two packages, and there is no video or hosted demo. Where should the extra effort go first?

A. Implementation: show deep, varied use of Kiro (specs per module, hooks, steering, AI-DLC record)
B. Potential Value: prove the problem is real and the tool would change how recalls are handled
C. Quality and Design: polish, accessibility, a memorable demo and video
D. Spread evenly across all three
E. Not yet defined
X. Other (please specify)

[Answer]: D. Spread evenly across all three

## Q5. [Product] Why now

What triggers this work, beyond the code that already exists?

A. The Kiroween submission deadline, December 4, 2026
B. Real recalls that show the lot-to-patient gap is costly today
C. Both A and B
D. Not identified
X. Other (please specify)

[Answer]: C. Both A and B

## Q6. [Stakeholders] Who decides and who influences

Scope and priority calls will come up at every stage. Who makes them?

A. Pritesh decides alone; the judges evaluate the result
B. A wider team decides together
C. Pritesh decides, and a practising pharmacist advises
D. Not yet defined
X. Other (please specify)

[Answer]: A. Pritesh decides alone; the judges evaluate the result

## Q7. [Stakeholders] Progress reporting

Does anyone need progress updates outside these approval steps?

A. No, the approval steps are enough
B. A short daily progress note
C. A weekly summary until the deadline
D. Not applicable
X. Other (please specify)

[Answer]: A. No, the approval steps are enough

## Q8. [Product] What this first version leaves out (select all that apply)

The plan is already set to an MVP. Which of these stay out of this first version?

A. Real patient data or anything that looks like PHI
B. Real SMS, email or phone calls (sandbox only)
C. Real pharmacy, wholesaler, EHR or e-prescribing connections
D. Production hardening: second factor, multi-store tenancy, row-level security
E. None of these
X. Other (please specify)

[Answer]: A, B, C

## Q9. [Product] Who the demo follows (follow-up to Q2)

You answered "Pritesh" for the person the demo and video follow. Which do you mean?

A. Pritesh presents the video; the story follows a pharmacist who owns an independent retail pharmacy
B. Pritesh is the persona himself, a builder modernising pharmacy software
C. Pritesh presents; the story follows a pharmacy team (pharmacist, technician, cashier) through one day
D. Not yet defined
X. Other (please specify)

[Answer]: C. Pritesh presents; the story follows a pharmacy team (pharmacist, technician, cashier) through one day

## Q10. [Product] What "everything in one place" covers in this pilot (follow-up to Q1, select all that apply)

You want the pitch to be a modern retail pharmacy system in one place that fills market gaps. Research for this question: small dispensers (25 or fewer pharmacists and technicians) must meet the federal DSCSA electronic traceability rules by November 27, 2026 (Frier Levitt, frierlevitt.com/articles/dscsa-compliance-update-november-2026-deadline-pharmacies), and independents report disjointed data between the register and the dispensing counter (DataScan, datascanpharmacy.com). There are about three weeks to the December 4 deadline, so which pieces belong in the pilot?

A. Receiving, inventory and DSCSA traceability by lot and serial (already built)
B. Fill and pickup with the lot captured on every prescription (already built)
C. Recall to affected patients to outreach (already built)
D. AI that helps the pharmacist decide (prescription checks, recall extraction, reorder and expiry advice)
E. Front-store retail: the register and shopping for over-the-counter goods in the same system (not built)
X. Other (please specify)

[Answer]: A, B, C, D, E

## Q11. [Product] Which decisions AI should help with (follow-up to Q1, select all that apply)

You want AI to help people decide. In every option the pharmacist still makes the call. Which decisions?

A. Reading a recall notice: which lots, which stock, which patients
B. Checking a new prescription: dose, days supply, interactions, allergies
C. Stock: what to reorder, what expires soon, what shortage is coming
D. Patient outreach: drafting the message and choosing how to reach each patient
E. None beyond what is already built
X. Other (please specify)

[Answer]: A, B, C, D
