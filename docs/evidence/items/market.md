# Evidence: R5-L reposition README and docs as pharmacy modernization

## What changed
- `README.md`: reordered around the modernization story: one-line promise, "The pharmacy runs on yesterday's software" (sourced), a Mermaid before/after diagram, "Gaps we close" table, Quick start and demo accounts right after it, "Agents that work while you work" (eight agents, background mode, Rx Guardian, before/after of one alert, Bedrock default with bring-your-own), "Safe by design", then architecture, AI agents, security detail, safety rules, testing, configuration, evidence, layout, limitations, licence. Existing screenshots kept. Test count updated to 364. Rx Guardian added to the agent table.
- `docs/MODERNIZATION.md` (new): problem by role, current vs future state, agent roadmap (built now: eight; next: only unbuilt items), 90-day pilot plan, success measures, risks.
- `docs/index.html`: same story, no external requests (external sources are plain links only, nothing loads from them).
- `docs/SUBMISSION.md`: tagline, inspiration, what it does, accomplishments and shot list reworded around modernization; Frankenstein angle kept.
- `docs/DEMO_SCRIPT.md`: opening and closing narration lines, agent beat, word count. No application code changed.

## Agents confirmed before describing them
`apps/api/src/agents/` has guardian.ts, background.ts, routes.ts and the rest; `docs/AGENTS.md` has the Background mode section; `apps/api/src/scenarios.ts` has "Agent catches it"; commit 58bf651 (BGA-1) is in the tree. README describes only what those show.

## Commands run
- `pnpm test`: 20 files, 364 tests passed (2026-11-20).
- Mermaid check: both README diagrams parse with `mermaid@10.9.1` `parse()` under jsdom (OK, OK).
- Relative link check over README.md, docs/MODERNIZATION.md, docs/SUBMISSION.md, docs/DEMO_SCRIPT.md, docs/index.html: 53 relative links, 0 broken after this file was added (the only miss during the run was this file).
- Name check: grep for company or employer names in the five files returned nothing.
- Not run: `pnpm e2e`. The README cites 49 passed, 1 skipped from `docs/evidence/items/bgagents.md`, not measured here.

## Sources used (all checked 2026-11-20, paraphrased)
| Claim in the docs | Source |
| --- | --- |
| DSCSA enhanced requirements aim at interoperable electronic package-level tracing | https://www.fda.gov/media/194424/download |
| Stabilization period 2023-11-27 to 2024-11-27 | https://www.fda.gov/media/179256/download |
| Small dispenser (25 or fewer FT pharmacists and technicians on 2026-11-27) exempt to 2027-11-27; others may request a waiver | https://www.fda.gov/drugs/drug-supply-chain-security-act-dscsa/exemptions-under-drug-supply-chain-security-act (fetched; the exemption was extended on 2026-08-06) |
| 289 of 510 relevant community-pharmacy interaction alerts overridden | https://pubmed.ncbi.nlm.nih.gov/17381663/ |
| 52.6 percent of 157,483 outpatient alerts overridden | https://pubmed.ncbi.nlm.nih.gov/24166725/ |
| 98.9 percent override of drug allergy alerts in 2023 | https://pubmed.ncbi.nlm.nih.gov/41613422/ |
| 74.9 percent of 412 community pharmacists with burnout in at least one domain | https://www.pharmacytimes.com/view/pharmacist-burnout-poses-challenges-to-patient-access |
| Independents closing at more than one a day (2024 NCPA Digest) | https://www.drugtopics.com/view/2024-ncpa-digest-highlights-challenges-in-independent-pharmacy-ncpa-2024 |
| Twice-daily readings without min/max caught 4.8 to 6.4 percent of excursions (vaccine storage simulation) | https://stacks.cdc.gov/view/cdc/119983/cdc_119983_DS1.pdf |
| Individual patient notification of recalls is hard; consumer recalls usually need patient action (preprint, search snippet only; page returned 403 on fetch) | https://www.medrxiv.org/content/10.1101/2024.09.18.24312141v1.full.pdf |
| 8,075 fax alerts in a PBM program to prescribers (older study, cited for the channel) | https://pubmed.ncbi.nlm.nih.gov/24761821 |
| PMS technology about four decades old; buyer guide on integration; consolidation of long-running products | https://intuitionlabs.ai/articles/pharmacy-management-systems-guide, https://datascanpharmacy.com/what-is-the-best-retail-pharmacy-software-for-independent-pharmacies-in-2026/, https://datascanpharmacy.com/is-your-pharmacy-software-shutting-down-or-being-sunset/ (vendor blogs; weak sources, used only for the qualitative points) |

## Left out for lack of a source
- Average age of an installed pharmacy system, or any product's age.
- Share of pharmacies that still recall by fax or phone; share using paper cold-chain logs in pharmacies (the CDC figure is vaccine storage and is labelled so).
- Any figure on staff time lost to recalls, alert volume per pharmacist, or margin per prescription (an NCPA margin figure appeared only in a non-English third-party blog, so it was dropped).
- Any recall time-to-reach figure for a person using a browser; the repo's measured server timing stays in `docs/evidence/timing.md`.
- The medRxiv preprint could not be fetched (403); only the search snippet's claim is used, labelled as a preprint.

## Screenshots: TODO
- `docs/img/today.jpg` and `docs/img/agents.jpg` predate the background-agent work (no Suggestions card on Today, no "Agents on" count in the shell, no Agents and Suggestions tabs or background row on AI agents). Both are kept as asked. Retake them from the "Agent catches it" scenario. `sign-in.jpg` was not checked against the current UI.

## Skipped or not verified
- `pnpm e2e` and the Docker build were not run for this item.
- The date-sensitive DSCSA text should be rechecked against the FDA page before submission; the cutoff for small-dispenser status is 2026-11-27.
- `docs/AGENTS.md` still says "Seven agents" in its opening line while listing eight; that file is not mine, so I did not change it.
- The DEMO_SCRIPT voiceover is about 350 words by count of the Say column. The old header said 430; it was not timed aloud.
