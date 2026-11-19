# Business Overview

## Domain
Pharmacy lot ledger and drug recall response. Chimera Rx records the lot and serial of every package at receiving, put-away and fill, so a recall can be traced to shelf units and to the patients who took a unit home.

## Problem
Wholesalers track lots. Dispensing systems track patients. Nothing links the lot to the patient, so a recall means warning everyone or no one. The lot is printed in the GS1 DataMatrix on every package; Chimera Rx captures it at the counter.

## Purpose
A Kiroween 2026 competition entry (Frankenstein category), deadline Dec 4 2026. It runs on synthetic data only and is not a product for sale. Source: README.md, docs/plan.md, `.kiro/steering/product.md`.

## Key Functionality
- Receiving and put-away with GS1 DataMatrix scan, supplier TI/TS check and expiry floor (`apps/api/src/receiving.ts`).
- Fill and pickup with scan-time lot capture, Rx Watcher review and prescriber change requests (`fill.ts`, `rxwatcher.ts`, `prescriber.ts`).
- Recall lookup from an FDA number or fax OCR, lot extraction, quarantine, patient impact and notification (`recall.ts`, `today.ts`).
- Outreach agent: sandbox SMS, email and simulated voicemail with consent and calling hours (`outreach.ts`, `notify.ts`, `voice.ts`).
- Partner surfaces behind OAuth: REST, MCP and FHIR R4 (`partner-api.ts`, `integrations.ts`) and signed webhooks (`webhooks.ts`).
- Hash-chained audit log with PDF audit report (`core.ts`, `recall.ts`).

## Users and Roles
Pharmacist, technician, cashier, admin (partner access), and a judge who must understand the flow in 3 minutes. Roles are enforced on the server (`only()` in `app.ts`).

## Safety Constraints
Synthetic data only; nothing reaches a real person; a pharmacist decides; lots are never invented (verbatim gate); recalled lots stay blocked. Source: `.kiro/steering/pharmacy-safety.md`, `docs/SAFETY.md`.

## Sources
- README.md, docs/ARCHITECTURE.md, docs/SAFETY.md, apps/api/src/app.ts
