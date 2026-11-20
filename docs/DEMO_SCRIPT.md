# Winning demo script (3:00 voiceover)

This is the word-for-word narration for the submission video. It is about 430 words, which fits 3 minutes at a calm pace. The on-screen steps match the 3-minute table in [DEMO.md](DEMO.md). Rehearse once and trim to fit. Say "sandbox" every time something is simulated, and never say "compliant" or "certified".

**Setup:** fresh reset, pharmacist signed out, Chrome at 1440x900, camera off (paste the label code from Test labels), `LLM_PROVIDER=mock` unless AWS credentials work. Record the screen at 30 fps, voice over after.

## Beat by beat

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Sign-in page, the demo notice visible | "When a drug lot is recalled, a pharmacy knows which patients got the drug. It does not know which lot. So it warns everyone, or no one." |
| 0:12 | Sign in, land on Today, red recall banner | "Chimera Rx records the lot and serial of every package at receiving and at the counter. This fax arrived overnight. Right now: 197 units on our shelf, 17 patients who took one home." |
| 0:28 | Recalls, **Read this fax with OCR** | "I do not retype anything. The browser reads the fax, openFDA confirms the recall, and the Coroner pulls out the lots." |
| 0:42 | The Coroner run, a dropped item highlighted | "Here is the rule that matters. A lot is kept only if it is printed in the notice, word for word. If the model invents one, it is thrown away, and you can see what it dropped." |
| 0:58 | Impact: quarantine, patient list, channels | "One click moves the exact units to quarantine and lists exactly who to reach, by text, email or phone, based on their consent." |
| 1:12 | Messages, **Use AI draft**, attestation, send, then Sandbox outbox | "An agent drafts the messages. It cannot send. A pharmacist reads, attests, and sends. Each text names only that patient, and carries the pharmacy phone and a STOP option. Nothing leaves this laptop. It goes to a sandbox outbox." |
| 1:40 | AI agents screen, provider card | "Seven agents, all following one pattern: rules decide, a model explains, a gate checks the model, a pharmacist decides. Amazon Bedrock is the default. Anthropic, OpenAI-compatible, a local model, or an offline mock are one click away, so you can plug in your own key right here." |
| 2:05 | DSCSA & trace, download EPCIS, verifier | "The same events export as GS1 EPCIS 2.0, the standard for tracing packages. A sandbox verifier answers verification requests. This is a stand-in, not a filing." |
| 2:25 | Refills, red recall-hold row | "And refills know the lot. This patient's last fill came from the recalled lot, so the refill is held, and stays held after the recall closes." |
| 2:40 | Terminal or SECURITY.md, then audit verify | "Patient fields are encrypted at rest, keys rotate, every action is in a hash-chained audit log, and roles are enforced on the server." |
| 2:50 | The `.kiro/` folder, steering file | "Built with Kiro. Steering files hold eleven safety rules, and property tests prove the lot gate cannot be fooled. Chimera Rx: find the lot, find the patient, tell them." |

## Why this wins (say it in the write-up, not the video)

- **Frankenstein fit:** DataMatrix scanning, browser OCR, openFDA, an LLM behind a verbatim gate, EPCIS, FHIR, MCP, text-to-speech and a hash-chained log all talk to each other in one flow.
- **A real gap with a clear before and after:** recall to lot to patient, which nobody records today.
- **Kiro depth:** steering as safety rules, hooks, specs, an AI-DLC record, and tests per rule. Link `docs/KIRO_USAGE.md`.
- **Trust:** every limit is stated. No real patient data, no real sending, no compliance claims.

## Delivery tips

- Open on the problem, not the logo. The first 10 seconds decide the rest.
- Keep the cursor still while you speak, then move.
- Show the dropped lot. It is the most memorable moment.
- If a step stalls, cut to the next beat. Do not apologise on camera.
- End on the one-line tagline and the repo address.

## Honest limits to keep in the voiceover or captions

Synthetic data only. Sandbox messaging. Not for clinical use. Live Bedrock was not exercised on the build machine, so show the provider switch with `mock` unless you have verified your own credentials first.
