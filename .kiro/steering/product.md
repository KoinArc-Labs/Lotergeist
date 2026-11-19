---
inclusion: always
---
# Product: Chimera Rx

Chimera Rx is a pharmacy lot ledger. It captures the lot and serial of every package at receiving, put-away and fill, so that when the FDA recalls a lot the pharmacy can find the exact units on its shelf and the exact patients who took one home, then reach them. Kiroween 2026 entry, **Frankenstein** category.

## The gap
Wholesalers track lots. Dispensing systems track patients. Nobody records which lot each patient received, so a recall means warning everyone or no one. The lot is printed in the GS1 DataMatrix on every package; Chimera Rx captures it at the counter.

## The Frankenstein parts
GS1 DataMatrix via webcam or USB scanner · browser OCR of faxes and labels · openFDA · regex + LLM lot extraction with a verbatim gate · deterministic Rx rules · NCPDP SCRIPT change requests (sandbox) · REST, MCP and FHIR R4 partner surfaces behind OAuth · signed webhooks · text-to-speech voicemail · a hash-chained audit log. Every new feature should make one of these parts talk to another, not add a silo.

## Users
| Role | Job | Sees |
| --- | --- | --- |
| Pharmacist | Verify fills, decide flagged orders, run recalls | Everything except integrations admin |
| Technician | Receive, shelve, fill | Receiving, inventory, fill; no recall actions |
| Cashier | Hand over and sell | Pickup only; no allergies or date of birth |
| Admin | Partner access | Integrations only |
| Judge | Understand it in 3 minutes | Notice → quarantine → patients → messages |

## Screens
Sign in, Today, Receiving, Inventory, Fill & pickup, Patients, Recalls, Integrations, plus demo tools (Test labels, Sandbox outbox). The design source of truth is `prototype/*.dc.html`; match it.

## Non-goals
No real patient data, no real messaging or calls, no real pharmacy, wholesaler, payer or Surescripts connections, no compliance claims, no native app. This is a competition entry, not a product for sale.

## Never cut
Lot capture at receiving and fill, recall lookup → impact → notify, the verbatim lot gate and its property tests, the camera scan, roles and audit.
