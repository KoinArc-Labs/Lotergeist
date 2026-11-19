# Requirements: Chimera Rx judge-ready pilot

Sources: `intent-statement.md`, `scope-document.md` (with `intent-backlog.md` and `constraint-register.md`), `team-practices.md`, the code knowledge base (`business-overview.md`, `architecture.md`, `code-structure.md`), and the answers in `requirements-analysis-questions.md` (Q1 to Q10).

## Intent analysis

- **Goal:** win Kiroween 2026 (Frankenstein) with a working pilot a judge can start in under 5 minutes and understand in 3 (intent-statement.md, scope-document.md).
- **Story:** one day at a two-store pharmacy, told through the pharmacist, technician and cashier (intent-statement.md). The hook a judge remembers is the lot-to-patient gap: a recall becomes a list of affected patients in under 60 seconds because the lot was captured at the counter (business-overview.md, scope-document.md).
- **Type:** enhancement of existing working code (brownfield). The receiving, inventory, fill, recall, outreach, partner API and audit modules already exist (business-overview.md, architecture.md). New work is judge access and evidence, a front-store register, two stores, a second sign-in factor and AI stock help.
- **Complexity:** standard to complex; the scope exceeds the time budget and the person accepted that risk (scope-document.md, intent-backlog.md).

Priority uses the scope backlog's bands: **Must** (judge access and evidence), **Should** (two stores, register), **Could** (second factor, store isolation hardening, AI stock help). Existing features keep working and are not re-specified here.

## Functional requirements

### FR1 Judge access (Must)
- **FR1.1** A single command (`docker compose up`) from a fresh clone starts the API and web app with demo data, and the sign-in page is reachable at a printed URL. Pass: on a clean machine with only Docker installed, the sign-in page loads within 5 minutes of running the command (Q1, intent-statement.md).
- **FR1.2** The README's first screen explains in plain words what Chimera Rx does and gives the one command, the demo accounts and the 3-minute walkthrough link (Q1).
- **FR1.3** When the code is pushed (only together with the person, before December 4, 2026), the repo has an "Open in Codespaces" entry that starts the same stack, and a GitHub Pages landing page with the demo video. Pass: both work from the pushed repo. Until the push, these files exist and are tested locally only (Q1, team-practices.md).
- **FR1.4** A judge can reset all demo data, and choose a scenario (FR6), from the app without a terminal (scope-document.md).

### FR2 Published evidence (Must)
- **FR2.1** A script runs the Coroner over the real openFDA recall records in the fixtures and writes a report: number of records, records with at least one lot extracted, lots extracted, and lots rejected by the verbatim check. The report is committed and linked from the README (intent-statement.md, scope-document.md).
- **FR2.2** A script times the recall flow on the larger dataset (FR5) from submitting the recall number to the affected-patient list being shown, with the pharmacist's confirm clicks performed by the script. It runs 5 times and publishes the median and worst time with the machine's CPU, memory and OS. Pass: median under 60 seconds (Q8).
- **FR2.3** The lot-capture rate (share of fills with lot and serial recorded) is computed from the dataset and published beside FR2.2 (intent-statement.md).
- **FR2.4** A Kiro usage document shows the specs, hooks, steering and AI-DLC record used to build the pilot, and what was not verified (scope-document.md).

### FR3 Front-store register (Should)
- **FR3.1** A cashier can add over-the-counter items (by scanning or searching) and any ready prescriptions for one patient to one sale (Q2).
- **FR3.2** Prescriptions in the sale require the existing pickup checks (photo ID, counseling offered, signature) before the sale completes (Q2).
- **FR3.3** Completing the sale marks it "paid" with no payment processing, records the sale with line items, and shows a receipt with the store, items, prescription numbers, and lot and serial for each prescription (Q2).
- **FR3.4** Over-the-counter item stock goes down by the quantity sold. A sale that would take an item below zero is refused with the item named (Q2).
- **FR3.5** A sale cannot include a prescription that is not verified or a package from a recalled lot; the register names the blocked line and why (Q2, scope-document.md).

### FR4 Two stores (Should)
- **FR4.1** Demo data has two stores, each with its own stock, staff, patients, deliveries and prescriptions (Q3).
- **FR4.2** A signed-in staff member sees and changes only their own store's data (Q3, Q4).
- **FR4.3** A pharmacist can move on-shelf packages to the other store. The move keeps each package's lot and serial, records a transfer-out and transfer-in lot event, and is written to the audit log. Recalled or quarantined packages cannot be moved (Q3).
- **FR4.4** A recall lookup in one store shows that store's affected units and patients only (Q3).

### FR5 Larger synthetic dataset (Must)
- **FR5.1** A generator creates, from a fixed seed, 2 stores, about 500 patients, about 5,000 fills over 6 months and about 150 products, all synthetic (Q7).
- **FR5.2** Running the generator twice with the same seed produces the same data (Q7).
- **FR5.3** Generated data passes the PHI guard and uses only synthetic identifiers, `(555) 010-01xx` phones and `example.com` emails (team-practices.md).

### FR6 Scenario library (Must)
Each scenario resets the data into a known state and shows a one-paragraph brief of what to try (Q9).
- **FR6.1** Class I recall that matches lots on the shelf and patients who took one home.
- **FR6.2** Recall for a lot this store never received; the app says no stock and no patients are affected.
- **FR6.3** Fax with a misread lot number; the verbatim check refuses the invented lot and asks the pharmacist to confirm.
- **FR6.4** Receiving problems: a fridge temperature outside 2 to 8 °C, a Schedule II count mismatch, and an expired package.
- **FR6.5** Suspect product: a serial missing from the supplier's transaction records, which can only be reported and quarantined.

### FR7 Second sign-in factor (Could)
- **FR7.1** After a correct password, the user must enter a 6-digit code delivered to the sandbox outbox. No real email or SMS is sent (Q5, team-practices.md).
- **FR7.2** The code expires after 5 minutes and works once. Five wrong codes lock the account for 15 minutes, as wrong passwords already do (Q5, architecture.md).
- **FR7.3** In demo mode the sign-in page links to the sandbox outbox so a judge can read the code (Q5).

### FR8 AI stock help (Could)
The pharmacist decides on every suggestion; nothing is ordered, moved or changed automatically (Q6, team-practices.md).
- **FR8.1** Reorder suggestions: for each product, compare stock on hand with fills over the last 4 weeks and suggest a quantity, showing the numbers used (Q6).
- **FR8.2** Expiry-risk warnings: flag lots that, at the current fill rate, will not be used before they expire, and suggest dispensing them first (Q6).
- **FR8.3** Shortage flags: mark products this store stocks whose NDC appears with status "Current" in openFDA drug shortages data, falling back to a cached copy when offline (Q6).
- **FR8.4** With an LLM configured, each suggestion gets a short plain-words explanation; without one, the rule's reason is shown. The LLM never changes a suggestion's numbers (Q6).

## Non-functional requirements

- **NFR1 Performance:** the recall flow meets FR2.2 (median under 60 seconds on the larger dataset).
- **NFR2 Start-up:** FR1.1 completes in under 5 minutes on a machine with Docker and a normal broadband connection; the image builds without network calls except package downloads.
- **NFR3 Isolation:** store filtering lives in one place on the server. Automated tests sign in as each store and try to read and change the other store's packages, patients, prescriptions, sales and recalls through every staff route; all attempts are refused (Q4).
- **NFR4 Safety:** every new feature keeps the safety rules: synthetic data only, nothing reaches a real person, the pharmacist decides, no invented lots, recalled lots stay blocked, and no compliance claims (team-practices.md).
- **NFR5 Audit:** every new state change (sale, transfer, second-factor sign-in, accepted suggestion) is written to the hash-chained audit log, and `GET /api/audit/verify` still passes (architecture.md).
- **NFR6 Tests:** existing tests keep passing; new features get tests after the code, with no coverage floor and no automated checks (team-practices.md).
- **NFR7 Offline:** without internet the app still runs on cached openFDA data and rules only, and says so where it matters (architecture.md).
- **NFR8 Readability:** the staff demo notice stays on every page; new screens follow the `prototype/` design.

## Constraints

- Hard deadline December 4, 2026; budget under 20 working hours (constraint-register.md).
- Nothing is pushed to GitHub until the person does it together with the agent; commits are local, straight to `main`, with a type prefix (team-practices.md).
- SQLite stays; no PostgreSQL migration (Q4).
- Dependencies pinned to exact versions; no MCP server installed or added (team-practices.md, constraint-register.md).
- Bedrock spend stays on the person's own account (constraint-register.md).

## Assumptions

- The register's over-the-counter items reuse the existing product and lot tables, with a flag for non-prescription items. Reason: avoids a second stock model. To confirm in design.
- "Paid" carries no amount reconciliation beyond a total shown on the receipt. Reason: payment handling is out of scope (scope-document.md).
- The openFDA drug shortages endpoint (`/drug/shortages.json`) is available; it answered on 2026-11-19 with 1,585 records. A cached copy covers offline use.
- Scenarios live in Store 1; Store 2 holds stock for transfer and the isolation tests.

## Out of scope

- Payment handling of any kind; real patients, pharmacies or wholesalers; real SMS, email or calls; real pharmacy, wholesaler, EHR or e-prescribing connections (scope-document.md).
- PostgreSQL and database-level row-level security (Q4).
- A chain-wide recall view across stores (Q3).
- Any claim of HIPAA compliance, clinical validity, certification or regulatory compliance, and the DSCSA date in the pitch (Q10).
- A native app (scope-document.md).

## Open questions

- Retail, two stores, second factor and AI stock help together exceed the time budget. If time runs short, the person picks what drops first; the backlog order suggests second factor and AI stock help go first (intent-backlog.md).
- Whether the timing run in FR2.2 should also be repeated inside Codespaces after the push.
