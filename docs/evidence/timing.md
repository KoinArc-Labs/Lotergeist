# Recall timing and lot capture

Generated 2026-11-19 by `pnpm evidence:timing`.

**Recall D-0650-2026 → affected-patient list: median 10 ms, worst 17 ms over 5 runs.** Target: median under 60 s (met).

| Run | Time | Confirm clicks | Units held | Patients listed |
| --- | --- | --- | --- | --- |
| 1 | 17 ms | 0 | 15 | 166 |
| 2 | 11 ms | 0 | 15 | 166 |
| 3 | 10 ms | 0 | 15 | 166 |
| 4 | 10 ms | 0 | 15 | 166 |
| 5 | 10 ms | 0 | 15 | 166 |

What is timed: the server work from submitting the recall number, through the pharmacist's confirm clicks (performed by the script), to the affected-patient list, over the app's real HTTP routes (Fastify inject). Not timed: a person reading the screen, browser rendering and the network. openFDA is skipped (`OFFLINE=1`); the recall comes from the synthetic fixture.

## Lot capture

**5129 of 5345 sold fills (96.0%) have lot and serial recorded.** On this synthetic dataset the missing fills are, by construction, fills from the first month before the counter scanner was used; the number shows what the ledger reports, not a field measurement.

## Dataset

Seed 20261204: 140 generated products, 500 patients, 5000 fills over 6 months (on top of the demo seed). Synthetic data only.

## Machine

Apple M5 Pro (15 cores), 24 GB, Darwin 27.2.0 arm64, Node v26.4.0.
