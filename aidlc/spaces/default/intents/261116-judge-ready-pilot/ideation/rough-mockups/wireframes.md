# Wireframes: Chimera Rx judge-ready pilot (new surfaces)
## Sources
- [desc] Initial description: "Chimera Rx, a Kiroween 2026 Frankenstein entry, deadline Dec 4 2026. Working code already exists in apps and packages, plan in docs/plan.md. Goal: a working, judge-ready pilot on synthetic data that wins the hackathon, not a product for sale. Find the gaps judges will evaluate (hosted demo, one-command run, scenario library, larger synthetic dataset, published accuracy and timing numbers, Kiro usage evidence, demo video) and plan the build that fills them. Follow .kiro/steering/pharmacy-safety.md. Do not install or add any MCP server."
- [scope] Workflow-selected scope: `mvp`.
- [Q1] Only new surfaces: landing page, try-out start, scenario picker, published numbers page, front-store register, location switcher.
- [Q2] Landing page with "Try it live", then a guided tour inside the app.
- [Q3] Scenario picker on Today.
- [Q4] Desktop and counter tablet.
- [Q5] WCAG 2.2 AA on the judge path.
- Upstream: `intent-statement.md`, `scope-document.md`, `intent-backlog.md`.
## Design Basis
Existing screens keep their prototypes in `prototype/*.dc.html`; these wireframes cover only new surfaces and reuse the shared tokens in the web app kit. [Q1] [desc]
Every staff page keeps the persistent demo notice from the safety rules. [desc]
## W1. Landing Page (GitHub Pages)
```
+--------------------------------------------------------------+
| Chimera Rx                                   [GitHub] [Video] |
+--------------------------------------------------------------+
|  When a lot is recalled, find the patients who took it home. |
|  [ Try it live ]   [ Watch the 3-minute video ]               |
+--------------------------------------------------------------+
|  Numbers:  Recall to patients  __ s  | Lot accuracy __ %      |
|            Time to try  __ min       | [ How we measured ]    |
+--------------------------------------------------------------+
|  How it works: Scan -> Lot -> Patient -> Recall -> Message    |
+--------------------------------------------------------------+
|  Demo · synthetic data only · not for clinical use            |
+--------------------------------------------------------------+
```
Accessibility: h1 headline; header, main, footer landmarks; keyboard entry on "Try it live". [Q5]
## W2. Try-out Start (Codespace launching)
```
+----------------------------------------------+
| Starting your demo pharmacy...               |
| [#####-----] Installing  ->  Seeding  -> Ready|
| Takes about 2 minutes. No account data used. |
| [ Open the app ] (enabled when ready)        |
+----------------------------------------------+
```
Accessibility: h1 status; main landmark; progress announced through a live region; focus on "Open the app" when ready. [Q5]
## W3. Today with Scenario Picker and Guided Tour
```
+--------------------------------------------------------------+
| Chimera Rx  [Location: Main St v]  Pharmacist   [Demo notice]|
+-----------+--------------------------------------------------+
| Today     |  Pick a scenario                                 |
| Receiving |  ( ) Class I recall at 3 patients                |
| Inventory |  ( ) Low-confidence lot, confirm by hand         |
| Fill      |  ( ) Recalled lot arrives at receiving           |
| Patients  |  [ Start scenario ]                              |
| Recalls   +--------------------------------------------------+
| Register  |  Tour  Step 1 of 6: A recall notice just arrived |
| Demo tools|  [ Back ] [ Next ] [ Skip tour ]                 |
+-----------+--------------------------------------------------+
```
Accessibility: h1 "Today", h2 "Pick a scenario"; header, nav, main landmarks; radio group with arrow keys; tour is a non-modal region, Escape skips it. [Q3] [Q5]
## W4. Published Numbers Page
```
+--------------------------------------------------------------+
| Numbers                                                      |
+--------------------------------------------------------------+
| Recall notice to affected patients   __ s   (target < 60 s)  |
| Lot extraction on real openFDA records __ % on __ records    |
| Fresh start to first scenario         __ min (target < 5)    |
| [ Method ] [ Raw results ] [ Re-run locally ]                |
+--------------------------------------------------------------+
```
Accessibility: h1 "Numbers", each metric as an h2 with its value in text, not only in a chart; main landmark. [Q5]
## W5. Front-store Register (cashier, counter tablet)
```
+---------------------------------------------+
| Register  Main St          Cashier          |
+---------------------------------------------+
| [ Scan item ]                               |
| Ibuprofen 200 mg  x1          $ 6.49        |
| ! Lot 4B21 is recalled - cannot sell        |
+---------------------------------------------+
| Total $ 6.49     [ Pickup Rx ] [ Finish ]   |
+---------------------------------------------+
```
No payment is taken; "Finish" records the sale only. Recalled lots are refused. Cashier sees no allergies or dates of birth. [Q1] [desc]
Accessibility: h1 "Register"; main landmark; scan field focused on load; touch targets at least 44 px for the tablet. [Q4] [Q5]
## W6. Location Switcher (header)
```
[Location: Main St v]
  > Main St
    Elm Ave
    All locations (recall view only)
```
Recall impact lists patients per location; staff see their own location unless the role allows all. [Q1]
Accessibility: a labelled button that opens a list; arrow keys move, Enter selects, Escape closes. [Q5]
## Assumptions & Open Questions
- The numbers on W1 and W4 stay blank until the measured runs exist; no placeholder numbers are published. [assumption]
- Location names are synthetic. [assumption]
- The register price and item are synthetic examples. [assumption]
