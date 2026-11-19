# Requirements Analysis: Questions

Inputs read: `intent-statement.md`, `scope-document.md`, `intent-backlog.md`, `constraint-register.md`, `team-practices.md`, and the code knowledge base (`business-overview.md`, `architecture.md`, `code-structure.md`).

## Q1. [Product] How judges get to try it

Two earlier answers disagree. Scope Definition made "live try-out on GitHub through Codespaces, plus a landing page and video on GitHub Pages" a must-have. Practices Discovery then chose "one command locally with Docker Compose, plus the video, no hosted deploy", and nothing goes to GitHub until we push together. Codespaces and GitHub Pages both need the code on GitHub. Which should the requirements say?

A. Both: Docker Compose locally now; when we push together before December 4, the repo also gets a Codespaces button and a GitHub Pages landing page with the video
B. Docker Compose locally plus the video only; no Codespaces and no GitHub Pages
C. Codespaces and GitHub Pages are the main way in; Docker Compose is the backup
D. Not yet defined
X. Other (please specify)

[Answer]: A. Both: Docker Compose locally now; when we push together before December 4, the repo also gets a Codespaces button and a GitHub Pages landing page with the video

## Q2. [Product] What the front-store register does

The register and over-the-counter shopping do not exist yet, and payment handling is out of scope. What should one sale at the register cover?

A. Ring up over-the-counter items and a ready prescription in one sale, apply the pickup checks (ID, counseling, signature), print or show a receipt, and mark it paid with no real payment
B. Over-the-counter items only, kept apart from prescription pickup
C. A, plus a stock decrement and lot record for over-the-counter items with a barcode
D. Not yet defined
X. Other (please specify)

[Answer]: A. Ring up over-the-counter items and a ready prescription in one sale, apply the pickup checks (ID, counseling, signature), print or show a receipt, and mark it paid with no real payment

## Q3. [Product] How many stores, and what is kept apart

Production hardening adds more than one pharmacy location. What does the demo need?

A. Two stores; each has its own stock, staff and patients; staff of one store cannot see the other's data
B. Two stores, as A, plus moving stock between them with the lot and serial kept
C. Three or more stores, plus a chain-wide recall view that shows every store's affected units and patients
D. Not yet defined
X. Other (please specify)

[Answer]: B. Two stores, as A, plus moving stock between them with the lot and serial kept

## Q4. [Developer] How data is kept apart between stores

Row-level security is a database feature. The app uses SQLite, which has none. Which way should store isolation work?

A. Keep SQLite; every query filters by the signed-in user's store, enforced in one place on the server, with tests that try to read another store's data
B. Move to PostgreSQL and use its row-level security policies
C. One SQLite file per store
D. Not yet defined
X. Other (please specify)

[Answer]: A. Keep SQLite; every query filters by the signed-in user's store, enforced in one place on the server, with tests that try to read another store's data

## Q5. [Developer] The second sign-in factor

What should the second factor be in the demo? No real SMS or email may be sent.

A. A six-digit code from an authenticator app (TOTP), with a demo QR code to enrol
B. A code shown in the sandbox outbox, as if sent by email
C. A passkey on the device (WebAuthn)
D. Not yet defined
X. Other (please specify)

[Answer]: B. A code shown in the sandbox outbox, as if sent by email

## Q6. [Product] AI help with stock (select all that apply)

AI help with reorder, expiry and shortage decisions is new. In every option the pharmacist decides. Which should the pilot do?

A. Suggest what to reorder from the last weeks of fills and the stock on hand, with the reason shown
B. Warn about lots that will expire before they are likely to be used, and suggest moving them first
C. Flag drugs on the FDA shortage list (openFDA drug shortages data) that this store stocks
D. Let an optional LLM explain each suggestion in plain words; without a key, rules only
E. None of these
X. Other (please specify)

[Answer]: A, B, C, D

## Q7. [Product] Size of the larger synthetic dataset

The dataset backs the timing number and the scenarios. How big should it be?

A. 2 stores, about 500 patients, about 5,000 fills over 6 months, about 150 products
B. 2 stores, about 2,000 patients, about 25,000 fills over 12 months
C. Keep today's size and add only what the scenarios need
D. Not yet defined
X. Other (please specify)

[Answer]: A. 2 stores, about 500 patients, about 5,000 fills over 6 months, about 150 products

## Q8. [Quality engineer] How the 60-second timing is measured

The success metric is "recall notice to the list of affected patients in under 60 seconds". What counts?

A. A scripted run on the larger dataset, from submitting the recall number to the patient list on screen, with the pharmacist's confirm clicks done by the script; published with the machine it ran on
B. Only the computer's part: lookup, extraction, quarantine and patient match, without any person's clicks
C. A real person doing it by hand, timed on video
D. Not yet defined
X. Other (please specify)

[Answer]: A. A scripted run on the larger dataset, from submitting the recall number to the patient list on screen, with the pharmacist's confirm clicks done by the script; published with the machine it ran on

## Q9. [Product] The scenario library (select all that apply)

Each scenario resets the demo data into a known situation a judge can try. Which should exist?

A. A Class I recall that hits lots on the shelf and patients who already took one home
B. A recall for a lot this store never received (nothing to do)
C. A lot number misread on the fax, caught by the verbatim check
D. A fridge temperature excursion, a Schedule II count mismatch and an expired package at receiving
E. A suspect product: a serial missing from the supplier's records
X. Other (please specify)

[Answer]: A, B, C, D, E

## Q10. [Product] The DSCSA date

The intent statement says the DSCSA deadline for small dispensers is November 27, 2026. The scope document's assumptions say November 27, 2027. Research for Intent Capture found November 27, 2026 in several sources (for example Frier Levitt and Drug Topics). Which should the pitch use, given it is context only and no compliance is claimed?

A. November 27, 2026
B. November 27, 2027
C. Leave the date out of the pitch
D. Not yet defined
X. Other (please specify)

[Answer]: C. Leave the date out of the pitch

## Consolidated Summary Confirmation

- Judges run it with one Docker Compose command now; when we push together before December 4, the repo also gets a Codespaces button and a GitHub Pages landing page with the video (Q1)
- One register sale covers over-the-counter items and a ready prescription together, with the pickup checks (photo ID, counseling, signature), a receipt, and "paid" with no real payment (Q2)
- Two stores, each with its own stock, staff and patients, plus moving stock between them with lot and serial kept (Q3)
- Store data stays in SQLite; every query is filtered by the signed-in user's store in one place on the server, with tests that try to read the other store's data (Q4)
- The second sign-in factor is a code delivered to the sandbox outbox, as if emailed (Q5)
- AI stock help: reorder suggestions, expiry-risk warnings, FDA shortage flags, and an optional LLM explanation; rules only without a key; the pharmacist decides (Q6)
- Larger dataset: 2 stores, about 500 patients, about 5,000 fills over 6 months, about 150 products (Q7)
- The 60-second number comes from a scripted run on that dataset, recall number to patient list on screen, confirm clicks scripted, published with the machine it ran on (Q8)
- Scenario library: Class I recall with shelf and patient hits; recall for a lot never received; misread lot on the fax caught by the verbatim check; fridge excursion, Schedule II count mismatch and expired package at receiving; suspect product with a serial missing from supplier records (Q9)
- The DSCSA date is left out of the pitch (Q10)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
