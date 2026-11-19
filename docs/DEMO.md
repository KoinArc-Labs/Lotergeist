# Demo script (under 3 minutes)

This is the script for the submission video and for anyone trying the app by hand. Judges are not required to watch past 3:00, so the story is front-loaded.

## Before you record

```bash
pnpm install && pnpm setup && pnpm dev
```

- Open http://localhost:5173 in Chrome (the camera needs `localhost` or HTTPS).
- Open **Test labels** on a phone or print them, so you can hold codes up to the webcam.
- Sign in as the pharmacist (`j.rivera@elmstreetrx.example` / `moonlight-rx-2026`). The technician account is needed only for the Schedule II witness.
- Reset between takes: **Reset demo** on the Today screen (or the **Replay demo** button on the recall's Done step). The Today screen also has five scenarios, each with a short brief of what to try.

## Script

| Time | Screen | Do and say |
| --- | --- | --- |
| 0:00 | Sign in | "When a drug lot is recalled, the pharmacy knows who got the drug, not who got the bad lot. So it warns everyone, or no one." |
| 0:15 | Today | The red banner: recall fax D-0417-2026 arrived overnight. "Chimera Rx already knows: 2 of these lots came here, 197 units are on the shelf, 17 patients took one home." |
| 0:30 | Receiving | Start the camera and hold up the amoxicillin label. Four checks pass (invoice, transaction information, expiry, recall) and it says where the package goes. Confirm. "The lot and serial are now in the ledger." |
| 0:55 | Receiving | Hold up a label with an unknown serial. The TI/TS check fails and only **Report a problem** is allowed. |
| 1:10 | Fill & pickup | Rx 0072210 (insulin). Rx Watcher has flagged it: twice-daily dosing written as a 90-day supply. The order can't be scanned until a pharmacist decides: approve with a reason, reject, or send a change request to the prescriber. Approve it, then scan the pen. "The lot is saved on the prescription. This is the link no one records today." |
| 1:35 | Recalls | **Read this fax with OCR**. The browser reads the fax image, openFDA confirms the recall, the Coroner pulls both lots. "An LLM may suggest a lot, but if it isn't printed on the notice, it's thrown away." |
| 1:55 | Recalls | Review impact: 197 units moved to quarantine Q-1, 17 patients, 13 by text, 11 by email, 2 by phone. |
| 2:10 | Recalls | Notify: the merged SMS preview, the attestation, send. Done: 12 of 13 texts delivered, the call list, the PDF audit report. "Nothing really leaves this laptop: it's a sandbox." |
| 2:30 | Integrations | The MCP and FHIR surfaces. "An EHR or an AI agent can ask which recalled lots this store holds, with its own scoped key." |
| 2:45 | Kiro | The `.kiro/` folder: steering, specs, the property-test hook. "Built with Kiro, spec first, property-tested." |

## Other things worth showing if time allows

- **The real recall.** Look up D-0526-2026 (a real alendronate recall from openFDA). Its lot AC2040A then fails the dock check when you scan it from delivery ASH-1105-08.
- **Schedule II.** Scanning the oxycodone package asks for a witness. The witness must be a different staff member and must enter their own password.
- **Roles.** Sign in as the cashier: Fill shows pickup only, with no allergies or date of birth.
- **Audit.** `GET /api/audit/verify` recomputes the hash chain.

## Fallbacks

- **No webcam or poor light.** Paste a code from Test labels into the scan box, or use a USB scanner.
- **openFDA offline.** The app falls back to the recall fixtures and says so.
- **OCR slow on first run.** The first read loads the model (about 4 MB) from `apps/web/public/ocr`; later reads are fast.

## Rehearse without a camera

```bash
pnpm e2e
```

This drives the real UI in Chromium with a fake webcam and real OCR, and checks every step above from receiving to messages sent. It is not a test of a physical webcam, lighting or print quality.
