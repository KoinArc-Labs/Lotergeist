# User Stories: Story Plan and Questions

## Story plan (draft)

- **Personas:** written from `requirements.md` and `business-overview.md`; each has a name, role, goals, pain points and how often they use the app.
- **Format:** "As a [persona], I want [goal], so that [benefit]", INVEST, with Given/When/Then acceptance criteria (`team-practices.md` keeps tests after the code, so criteria are written to be tested afterwards).
- **Priority:** MoSCoW from the requirement bands (Must, Should, Could) in `requirements.md`.
- **Traceability:** every functional and non-functional requirement maps to a story or is deferred to a named later stage.
- **Delivery:** stories stay in this folder; nothing goes to Jira.

Some open review findings from Requirements Analysis change what the stories say, so they are asked here.

## Q1. [Product] How the stories are grouped

A. By the pharmacy's day: morning delivery, fills, front counter, a recall, closing (follows the demo video)
B. By feature: judge access, evidence, register, two stores, second factor, AI stock help
C. By persona: everything the pharmacist does, then the technician, cashier and judge
D. Not yet defined
X. Other (please specify)

[Answer]: A. By the pharmacy's day: morning delivery, fills, front counter, a recall, closing (chosen by the agent: "you decide")

## Q2. [Product] Who the personas are (select all that apply)

A. The pharmacist in charge of Store 1
B. The technician who receives stock and fills prescriptions
C. The cashier at the front counter and register
D. The judge trying the pilot for the first time
E. A pharmacist at Store 2 (to show the stores are kept apart and stock moves between them)
X. Other (please specify)

[Answer]: A, B, C, D, E (chosen by the agent: "you decide")

## Q3. [Product] Stock for over-the-counter items at the register (review finding R-03)

Your answer for the register sale did not include stock tracking for over-the-counter items, but the requirements added it (stock goes down on sale, a sale below zero is refused). Which should the stories follow?

A. Your answer: no stock tracking for over-the-counter items; the register only records the sale
B. Keep the added stock tracking (stock goes down, refused below zero), without lot tracking
C. Not yet defined
X. Other (please specify)

[Answer]: A. Your answer: no stock tracking for over-the-counter items; the register only records the sale (chosen by the agent: "you decide")

## Q4. [Product] A recalled lot and the second store (review finding R-05)

The safety rule says a recalled lot stays blocked at receiving and fill. A recall can be confirmed in one store. What happens in the other store?

A. The lot is blocked in both stores at receiving, fill, the register and transfers; each store still sees only its own units and patients
B. Only the store that confirmed the recall blocks the lot; the other store must look up the recall itself
C. Not yet defined
X. Other (please specify)

[Answer]: A. The lot is blocked in both stores at receiving, fill, the register and transfers; each store still sees only its own units and patients (chosen by the agent: "you decide")

## Q5. [Product] Who may do the new things (review finding R-06)

The server enforces roles. Which split should the stories use?

A. Register sale: cashier and pharmacist. Move stock between stores: pharmacist. Pick a scenario or reset the demo: pharmacist. See stock suggestions: technician and pharmacist; act on them: pharmacist
B. As A, but anyone signed in may pick a scenario or reset the demo, so a judge can do it from any account
C. Not yet defined
X. Other (please specify)

[Answer]: A. Register sale: cashier and pharmacist. Move stock between stores: pharmacist. Pick a scenario or reset the demo: pharmacist. See stock suggestions: technician and pharmacist; act on them: pharmacist (chosen by the agent: "you decide")

## Q6. [Developer] How the register finds an over-the-counter item (review finding R-11)

Over-the-counter boxes carry an ordinary retail barcode (UPC), not the 2D barcode on prescription packages. How should the cashier add one?

A. Scan the retail barcode with the webcam or a USB scanner, with search by name as a fallback
B. Search by name only
C. Not yet defined
X. Other (please specify)

[Answer]: A. Scan the retail barcode with the webcam or a USB scanner, with search by name as a fallback (chosen by the agent: "you decide")

## Consolidated Summary Confirmation

- Stories follow the pharmacy's day: morning delivery, fills, front counter, a recall, closing, matching the demo video (Q1)
- Five personas: the Store 1 pharmacist in charge, the technician, the cashier, the judge, and a Store 2 pharmacist (Q2)
- The register records the sale only; no stock tracking for over-the-counter items, as in your earlier answer (Q3)
- A confirmed recalled lot is blocked in both stores at receiving, fill, the register and transfers; each store sees only its own units and patients (Q4)
- Roles: register sale by cashier or pharmacist; transfers, scenario picks and demo reset by pharmacist; stock suggestions seen by technician and pharmacist, acted on by pharmacist only (Q5)
- The cashier adds an over-the-counter item by scanning its retail barcode (webcam or USB scanner), with search by name as fallback (Q6)
- All stories are written to local files only; nothing goes to Jira

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
