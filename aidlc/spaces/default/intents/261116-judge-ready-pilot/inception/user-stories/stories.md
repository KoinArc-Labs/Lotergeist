# User Stories: Chimera Rx judge-ready pilot

Sources: `requirements.md` (FR1 to FR8, NFR1 to NFR8), `personas.md`, `team-practices.md`, `business-overview.md`, `component-inventory.md`, and the answers in `user-stories-questions.md` (Q1 to Q6). Stories follow the pharmacy's day, as in the demo video (Q1). Each story is "As a [persona], I want [goal], so that [benefit]", with Given/When/Then acceptance criteria written to be tested after the code (team-practices.md). Priorities follow the requirement bands. The MVP line is decided in Delivery Planning.

Personas: P1 Jordan (pharmacist, Store 1), P2 Kiran (technician), P3 Maya (cashier), P4 Sam (pharmacist, Store 2), P5 the judge.

## Group 0: Before the day (judge access and evidence)

### US0.1 Start the pilot with one command (Must)
As the judge (P5), I want to start Chimera Rx with one command from a fresh clone, so that I can try it without setup work.
- **AC0.1.1** Given a clean machine with only Docker installed, When I run `docker compose up` in a fresh clone, Then the API and web app start with demo data and the sign-in URL is printed. (FR1.1)
- **AC0.1.2** Given the command was started, When 5 minutes have passed on a normal broadband connection, Then the sign-in page loads at the printed URL. (FR1.1, NFR2)
- **AC0.1.3** Given the image is building, When the build runs, Then it makes no network calls except package downloads. (NFR2)
- **AC0.1.4** Given no internet after start-up, When I use the app, Then it runs on cached openFDA data and rules only and says so on the Recalls and stock-help screens. (NFR7)
- Depends on: none. INVEST: independent of app features; testable by a timed clean-machine run.

### US0.2 Understand the pilot from the README (Must)
As the judge (P5), I want the README's first screen to say what Chimera Rx does and how to try it, so that I understand it before I run anything.
- **AC0.2.1** Given I open the README, When I read the first screen, Then it explains the lot-to-patient gap in plain words and shows the one command, the demo accounts and the 3-minute walkthrough link. (FR1.2)
- **AC0.2.2** Given the README, When I search it, Then it makes no claim of HIPAA compliance, clinical validity, certification or regulatory compliance. (NFR4)
- Depends on: US0.1 (the command it shows).

### US0.3 Open the pilot in Codespaces and see the landing page (Must)
As the judge (P5), I want an "Open in Codespaces" entry and a landing page with the demo video, so that I can try or watch it without installing Docker.
- **AC0.3.1** Given the Codespaces configuration exists locally, When it is started locally with the dev-container tooling, Then the same stack as US0.1 starts. (FR1.3)
- **AC0.3.2** Given the code has been pushed together with the person, When I open the repo, Then the "Open in Codespaces" entry starts the stack and the GitHub Pages landing page plays the demo video. (FR1.3)
- **AC0.3.3** Given the person has not pushed, When the agent finishes this story, Then nothing has been pushed to GitHub. (team-practices.md)
- Depends on: US0.1.

### US0.4 Read the published accuracy report (Must)
As the judge (P5), I want a committed report of how well the Coroner extracts lots from real recall notices, so that I can check the accuracy claim.
- **AC0.4.1** Given the real openFDA recall fixtures, When the evidence script runs, Then it writes a report with the number of records, records with at least one lot, lots extracted, and lots rejected by the verbatim check. (FR2.1)
- **AC0.4.2** Given the report, When I open the README, Then it links the committed report. (FR2.1)
- **AC0.4.3** Given an LLM lot not found verbatim in the source, When the script runs, Then that lot is counted as rejected and never as extracted. (FR2.1, NFR4)
- Depends on: none.

### US0.5 Read the published recall timing (Must)
As the judge (P5), I want the recall flow timed on the larger dataset with the machine named, so that I can trust the "under 60 seconds" claim.
- **AC0.5.1** Given the larger dataset (US2.4), When the timing script runs, Then it submits a recall number, performs the pharmacist's confirm clicks, and stops when the affected-patient list is shown. (FR2.2)
- **AC0.5.2** Given the script, When it completes, Then it has run 5 times and publishes the median and worst time with the machine's CPU, memory and OS. (FR2.2)
- **AC0.5.3** Given the published result, When I read it, Then the median is under 60 seconds, or the report says plainly that it is not. (FR2.2, NFR1)
- **AC0.5.4** Given the dataset, When the script runs, Then it also publishes the lot-capture rate (share of fills with lot and serial recorded) beside the timing. (FR2.3)
- Depends on: US2.4.

### US0.6 See how Kiro built it (Must)
As the judge (P5), I want a Kiro usage document, so that I can judge how Kiro was used.
- **AC0.6.1** Given the docs, When I open the Kiro usage document, Then it lists the specs, hooks, steering files and AI-DLC record used, each with a path. (FR2.4)
- **AC0.6.2** Given the document, When I read it, Then it names what was not verified (for example the live LLM path and a physical webcam). (FR2.4)
- Depends on: none.

## Group 1: Morning delivery

### US1.1 Pick a scenario and reset the demo from the app (Must)
As Jordan (P1), I want to pick a scenario or reset the demo from the app, so that a judge can try a story without a terminal.
- **AC1.1.1** Given I am signed in as a pharmacist, When I choose a scenario, Then the data resets to that scenario's known state and a one-paragraph brief of what to try is shown. (FR1.4, FR6)
- **AC1.1.2** Given I am signed in as a pharmacist, When I choose "Reset demo", Then all demo data returns to its starting state and an audit row records who reset it. (FR1.4, NFR5)
- **AC1.1.3** Given I am signed in as a technician or cashier, When I call the scenario or reset route, Then the server refuses with 403. (Q5)
- Depends on: none.

### US1.2 See receiving problems caught (Must)
As Kiran (P2), I want the "receiving problems" scenario to show a warm fridge item, a Schedule II count mismatch and an expired package being caught, so that the judge sees bad stock never reaches the shelf.
- **AC1.2.1** Given the receiving-problems scenario, When I scan a fridge item with a temperature outside 2 to 8 °C, Then it is held and cannot be put away. (FR6.4)
- **AC1.2.2** Given the same scenario, When I count a Schedule II line that does not match the delivery, Then the mismatch is reported and the line is held. (FR6.4)
- **AC1.2.3** Given the same scenario, When I scan an expired package, Then it is refused at receiving. (FR6.4)
- Depends on: US1.1.

### US1.3 See a suspect product quarantined (Must)
As Kiran (P2), I want the "suspect product" scenario to show a serial missing from the supplier's records, so that the judge sees it can only be reported and quarantined.
- **AC1.3.1** Given the suspect-product scenario, When I scan a serial not in the supplier's transaction records, Then the TI/TS check fails and the only actions offered are report and quarantine. (FR6.5)
- **AC1.3.2** Given the package was quarantined, When anyone tries to put it away or fill it, Then the server refuses. (FR6.5, NFR4)
- Depends on: US1.1.

## Group 2: Two stores

### US2.1 Work only in my own store (Should)
As Sam (P4), I want to see and change only Store 2's data, so that Store 1's patients stay private to Store 1.
- **AC2.1.1** Given demo data, When it loads, Then there are two stores, each with its own stock, staff, patients, deliveries and prescriptions. (FR4.1)
- **AC2.1.2** Given I am signed in to Store 2, When I open any staff screen, Then I see only Store 2 data. (FR4.2)
- **AC2.1.3** Given automated tests signed in as each store, When they try to read and change the other store's packages, patients, prescriptions, sales and recalls through every staff route, Then every attempt is refused. (NFR3)
- **AC2.1.4** Given the server code, When a reviewer looks for store filtering, Then it lives in one place. (NFR3)
- Depends on: none.

### US2.2 Move stock to the other store (Should)
As Jordan (P1), I want to move on-shelf packages to Store 2, so that the stores can share stock without losing the lot trail.
- **AC2.2.1** Given an on-shelf package in Store 1, When I move it to Store 2, Then it keeps its lot and serial, a transfer-out and a transfer-in lot event are recorded, and an audit row is written. (FR4.3, NFR5)
- **AC2.2.2** Given a quarantined package or one from a recalled lot, When I try to move it, Then the move is refused with the reason. (FR4.3, Q4)
- **AC2.2.3** Given I am a technician or cashier, When I call the transfer route, Then the server refuses with 403. (Q5)
- Depends on: US2.1.

### US2.3 A recall shows only my store's patients, but blocks the lot everywhere (Should)
As Sam (P4), I want a recall to list only my store's affected units and patients, while a confirmed recalled lot is blocked in both stores, so that privacy holds and no store misses a recall.
- **AC2.3.1** Given a recall looked up in Store 1, When Store 1 views the impact, Then it shows only Store 1's units and patients. (FR4.4)
- **AC2.3.2** Given Store 1 confirmed a recalled lot, When Store 2 tries to receive, fill, sell at the register or transfer a package of that lot, Then each action is refused. (Q4, NFR4)
- **AC2.3.3** Given the recall is later closed, When either store tries the same actions, Then they are still refused. (NFR4)
- Depends on: US2.1.

### US2.4 Generate a larger synthetic dataset (Must)
As Jordan (P1), I want a realistic amount of synthetic history, so that the recall timing and lot-capture numbers mean something.
- **AC2.4.1** Given a fixed seed, When the generator runs, Then it creates 2 stores, about 500 patients, about 5,000 fills over 6 months and about 150 products. (FR5.1)
- **AC2.4.2** Given the same seed, When the generator runs twice, Then the two outputs are identical. (FR5.2)
- **AC2.4.3** Given generated data, When the PHI guard runs, Then it passes, and every patient ID, phone and email uses the synthetic formats (`S-0417`, `(555) 010-01xx`, `example.com`). (FR5.3, NFR4)
- Depends on: US2.1 (two stores in the schema).

## Group 3: Fills and stock help

### US3.1 Get reorder suggestions (Could)
As Jordan (P1), I want reorder suggestions that show their numbers, so that I can decide what to order.
- **AC3.1.1** Given 4 weeks of fills, When I open stock help, Then each product shows stock on hand, fills over the last 4 weeks and a suggested quantity. (FR8.1)
- **AC3.1.2** Given a suggestion, When I accept it, Then nothing is ordered automatically; my decision is recorded in the audit log. (FR8, NFR5)
- **AC3.1.3** Given I am a technician, When I open stock help, Then I can see suggestions but the server refuses accept or dismiss. (Q5)
- Depends on: US2.4 (fill history).

### US3.2 See expiry-risk warnings (Could)
As Jordan (P1), I want lots that will expire before they are used flagged, so that I dispense them first.
- **AC3.2.1** Given the current fill rate, When a lot will not be used before its expiry, Then it is flagged with a "dispense first" suggestion. (FR8.2)
- **AC3.2.2** Given the flag, When I view it, Then the fill rate and expiry date used are shown. (FR8.2)
- Depends on: US2.4.

### US3.3 See shortage flags (Could)
As Jordan (P1), I want products on the FDA shortage list flagged, so that I can plan around them.
- **AC3.3.1** Given openFDA drug shortages data, When a product's NDC appears with status "Current", Then it is flagged. (FR8.3)
- **AC3.3.2** Given no internet, When I open stock help, Then flags come from the cached copy and the screen says so. (FR8.3, NFR7)
- Depends on: none.

### US3.4 Read a plain-words reason for each suggestion (Could)
As Jordan (P1), I want each suggestion explained in plain words, so that I understand it quickly.
- **AC3.4.1** Given an LLM is configured, When a suggestion is shown, Then it has a short explanation labelled as AI advice. (FR8.4)
- **AC3.4.2** Given no LLM, When a suggestion is shown, Then the rule's reason is shown instead. (FR8.4)
- **AC3.4.3** Given any LLM output, When it is applied, Then the suggestion's numbers are unchanged. (FR8.4, NFR4)
- Depends on: US3.1, US3.2 or US3.3.

## Group 4: Front counter

### US4.1 Add over-the-counter items to a sale (Should)
As Maya (P3), I want to add over-the-counter items by scanning their retail barcode or searching by name, so that I can ring up shopping quickly.
- **AC4.1.1** Given an over-the-counter box, When I scan its UPC with the webcam or a USB scanner, Then the item is added to the sale. (FR3.1, Q6)
- **AC4.1.2** Given a barcode that does not scan, When I search by name, Then I can add the item. (FR3.1, Q6)
- **AC4.1.3** Given the item is sold, When the sale completes, Then the sale is recorded and no over-the-counter stock count changes. (Q3)
- Depends on: none.

### US4.2 Add a patient's ready prescriptions to the same sale (Should)
As Maya (P3), I want to add a patient's ready prescriptions to the same sale, so that the customer pays once.
- **AC4.2.1** Given a patient with verified, ready prescriptions, When I select the patient, Then I can add those prescriptions to the sale without seeing allergies or date of birth. (FR3.1)
- **AC4.2.2** Given a prescription in the sale, When I try to complete it, Then photo ID, counseling offered and signature are required first. (FR3.2)
- **AC4.2.3** Given a prescription that is not verified, or a package from a recalled lot, When I add it, Then the register blocks that line and names why. (FR3.5, Q4)
- **AC4.2.4** Given I am a technician, When I call the register sale route, Then the server refuses with 403. (Q5)
- Depends on: US4.1.

### US4.3 Complete the sale and print a receipt (Should)
As Maya (P3), I want to mark the sale paid and give a receipt, so that the customer leaves with a record.
- **AC4.3.1** Given a sale with all checks done, When I complete it, Then it is marked "paid" with no payment processing and recorded with its line items. (FR3.3)
- **AC4.3.2** Given the completed sale, When the receipt shows, Then it lists the store, items, prescription numbers, and lot and serial for each prescription. (FR3.3)
- **AC4.3.3** Given the completed sale, When the audit log is verified, Then the sale has an audit row and `GET /api/audit/verify` passes. (NFR5)
- Depends on: US4.2.

## Group 5: A recall

### US5.1 Trace a Class I recall to patients (Must)
As Jordan (P1), I want the Class I recall scenario to go from notice to affected patients, so that the judge sees the lot-to-patient gap closed.
- **AC5.1.1** Given the Class I scenario, When I submit the recall number, Then the matching shelf units are quarantined and the patients who took one home are listed. (FR6.1)
- **AC5.1.2** Given the patient list, When I prepare messages, Then nothing is sent until I tick the attestation, and messages go only to the sandbox outbox. (NFR4)
- Depends on: US1.1.

### US5.2 A recall for a lot we never had (Must)
As Jordan (P1), I want the app to say clearly when a recall does not touch us, so that I do not alarm anyone.
- **AC5.2.1** Given the not-received scenario, When I submit the recall number, Then the app says no stock and no patients are affected. (FR6.2)
- Depends on: US1.1.

### US5.3 A misread lot on a fax is refused (Must)
As Jordan (P1), I want an invented lot from a misread fax refused, so that I only act on lots really in the notice.
- **AC5.3.1** Given the misread-fax scenario, When the Coroner returns a lot not found verbatim in the fax text, Then that lot is dropped and shown as refused. (FR6.3, NFR4)
- **AC5.3.2** Given a remaining lot under 0.95 confidence or with no expiry, When it is shown, Then I must confirm it myself, one lot at a time. (FR6.3, NFR4)
- Depends on: US1.1.

## Group 6: Closing

### US6.1 Sign in with a second factor (Could)
As Jordan (P1), I want a 6-digit code after my password, so that a stolen password is not enough.
- **AC6.1.1** Given a correct password, When I sign in, Then I must enter a 6-digit code delivered to the sandbox outbox only. (FR7.1)
- **AC6.1.2** Given a code, When 5 minutes pass or it has been used once, Then it no longer works. (FR7.2)
- **AC6.1.3** Given five wrong codes, When I try again, Then the account is locked for 15 minutes. (FR7.2)
- **AC6.1.4** Given demo mode, When I see the code prompt, Then the page links to the sandbox outbox. (FR7.3)
- **AC6.1.5** Given a successful second-factor sign-in, When the audit log is verified, Then the sign-in is recorded and the chain verifies. (NFR5)
- Depends on: none.

### US6.2 Close the day with everything still working (Must)
As Jordan (P1), I want every existing feature and safety notice to keep working, so that the new pieces do not break the old ones.
- **AC6.2.1** Given the full change set, When `pnpm test` runs, Then all existing tests pass and each new feature has tests written after its code. (NFR6)
- **AC6.2.2** Given any staff page, including new screens, When it loads, Then the persistent demo notice is shown and the layout follows `prototype/`. (NFR8)

## Deferred and not covered

- **FR3.4** (over-the-counter stock goes down; below zero is refused) is not built. The person's answer in Q3 overrides it: the register records the sale only. This is recorded so Requirements Analysis's FR3.4 is not silently dropped.

## Story map

| Group | Stories | Priority |
| --- | --- | --- |
| 0 Before the day | US0.1 to US0.6 | Must |
| 1 Morning delivery | US1.1 to US1.3 | Must |
| 2 Two stores | US2.1 to US2.3 Should, US2.4 Must | Should / Must |
| 3 Fills and stock help | US3.1 to US3.4 | Could |
| 4 Front counter | US4.1 to US4.3 | Should |
| 5 A recall | US5.1 to US5.3 | Must |
| 6 Closing | US6.1 Could, US6.2 Must | Could / Must |

Critical path for the demo: US2.1 → US2.4 → US0.5, and US1.1 → US5.1.
