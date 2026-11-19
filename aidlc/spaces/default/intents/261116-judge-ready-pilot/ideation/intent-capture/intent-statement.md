# Intent Statement: Chimera Rx judge-ready pilot

## Problem Statement

Retail pharmacy software is split across separate systems, leaving market gaps; Chimera Rx should modernise it into one place where the work is done and shopped, with AI helping people make decisions. [Q1]

Chimera Rx is a Kiroween 2026 Frankenstein entry with working code already in place; the goal is a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. [desc]

The work is to find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and to plan the build that fills them. [desc]

## Target Customer

The story follows a pharmacy team through one day: a pharmacist, a technician and a cashier. Pritesh presents it. [Q9]

The judges evaluate the result. [Q6]

## Success Metrics

| Metric | Target | Source |
|--------|--------|--------|
| Time from a recall notice to the list of affected patients, on the demo data | Under 60 seconds | [Q3] |
| Lot-extraction accuracy, measured on real openFDA recall records and published | Measured and published (no target set) | [Q3] |
| Time for a judge to try the pilot, hosted or with one command | Under 5 minutes | [Q3] |
| Effort split across the judging criteria Potential Value, Implementation and Quality and Design | Spread evenly | [Q4] |

## Initiative Trigger

The Kiroween submission deadline of December 4, 2026, together with real recalls that show the lot-to-patient gap is costly today. [desc] [Q5]

## Initial Scope Signal

- Workflow-selected scope: `mvp`. [scope]
- In this version: receiving, inventory and DSCSA traceability by lot and serial; fill and pickup with the lot captured on every prescription; recall to affected patients to outreach; AI that helps the pharmacist decide; front-store retail with the register and over-the-counter shopping. [Q10]
- AI helps with reading a recall notice, checking a new prescription, stock decisions (reorder, expiry, shortage) and patient outreach; the pharmacist makes the call in every case. [Q11]
- Production hardening (second factor, several stores, row-level security) stays in this version, because it was not chosen as out of scope. [Q8] [Q12]
- Front-store retail and production hardening are both kept, and depth is cut elsewhere: fewer screens polished and a smaller dataset. [Q12]
- Out of this version: real patient data or anything that looks like PHI; real SMS, email or phone calls; real pharmacy, wholesaler, EHR or e-prescribing connections. [Q8]
- The pilot follows `.kiro/steering/pharmacy-safety.md` and installs or adds no MCP server. [desc]

## Assumptions & Open Questions

- The federal DSCSA electronic traceability deadline for small dispensers is November 27, 2026, one week before Kiroween, and can be used in the pitch as a second reason why now. [assumption]
- No numeric target is set for lot-extraction accuracy until it has been measured. [assumption]
