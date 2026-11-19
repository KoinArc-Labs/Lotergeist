import { audit, HttpError, type Actor, type Ctx } from "./core";
import { gtinOf } from "./domain";
import { seedPartners } from "./integrations";
import { reviewPending } from "./rxwatcher";
import { seedDatabase } from "./seed";
import { ingestFaxInbox } from "./today";

/**
 * Scenario library (FR6): each scenario resets the demo to a known state, then applies a small, synthetic change and
 * shows a one-paragraph brief of what to try. Only a pharmacist may pick one (US1.1, Q5).
 */

export interface ScenarioLabel { group: string; ndc10: string; lot: string; expiry: string; serial: string; note: string }

export interface Scenario {
  id: string;
  title: string;
  brief: string;
  /** where the brief sends the judge first */
  start: string;
  /** extra printable labels on the Test labels page */
  labels?: ScenarioLabel[];
  apply?: (ctx: Ctx) => void;
}

const META_SCENARIO = "scenario";
const META_LABELS = "scenario_labels";

export const SCENARIOS: Scenario[] = [
  {
    id: "class1-recall",
    title: "Class I recall with patients to reach",
    start: "/recalls",
    brief:
      "Nightjar Biologics recalls insulin glargine lot GX4471C (D-0611-2026, Class I, synthetic). Open Recalls, enter D-0611-2026 and look it up. " +
      "The lot has an expiry and high confidence, so it is confirmed for you and every on-shelf pen moves to quarantine. The impact list shows the patients " +
      "who took a pen home, because the lot was scanned at fill. Draft the messages, tick the attestation and send: they land in the sandbox outbox only."
  },
  {
    id: "not-received",
    title: "Recall for a lot this store never had",
    start: "/recalls",
    brief:
      "Look up D-0603-2026 (insulin glargine lots GX4471A and GX4471B, Class I, synthetic). This store only ever received lot GX4471C, " +
      "so Chimera Rx says no units are on the shelf and no patients are affected. Nobody gets an alarming message."
  },
  {
    id: "misread-fax",
    title: "Fax with a misread lot number",
    start: "/recalls",
    brief:
      "The recall fax for D-0417-2026 in the inbox was read badly: it prints lot PRORX05O925-1 (letter O instead of zero). Open the recall. " +
      "The FDA record's lots are listed with their real stock and patients. The misread lot from the fax is kept apart, unconfirmed, " +
      "with 0 units, until you confirm or ignore it yourself. Chimera Rx never adds a lot that is not printed in the source text, and never confirms one under 0.95 confidence for you."
  },
  {
    id: "receiving-problems",
    title: "Receiving problems: warm fridge item, extra Schedule II, expired package",
    start: "/receiving",
    brief:
      "Open delivery ASH-1105-07 and print the scenario labels from Test labels. The shipper's temperature log says 11.5 °C, so the insulin pens fail the 2–8 °C check. " +
      "A second oxycodone package arrives than the invoice line allows, so the Schedule II count does not match. An amoxicillin package expired on Oct 31, 2026 " +
      "and is refused. None of them can be put away; each can only be reported."
  },
  {
    id: "suspect-product",
    title: "Suspect product: serial missing from the supplier's records",
    start: "/receiving",
    brief:
      "Open delivery ASH-1105-08 and scan the label marked 'suspect' from Test labels. Its serial is not in the supplier's transaction information, " +
      "so the check fails: the package can only be reported and quarantined, never shelved or filled."
  }
];

const EXTRA_LABELS: Record<string, ScenarioLabel[]> = {
  "receiving-problems": [
    { group: "Scenario · ASH-1105-07", ndc10: "70004-310-10", lot: "OX25L072", expiry: "2028-03-31", serial: "55020418", note: "second oxycodone package (count mismatch)" },
    { group: "Scenario · ASH-1105-07", ndc10: "70004-226-01", lot: "AMX0326Z", expiry: "2026-10-31", serial: "10443899", note: "expired amoxicillin" }
  ],
  "suspect-product": [
    { group: "Scenario · ASH-1105-08", ndc10: "70004-145-90", lot: "AM1107B", expiry: "2028-06-30", serial: "20001199", note: "suspect: serial not in supplier records" }
  ]
};

const APPLY: Record<string, (ctx: Ctx) => void> = {
  "misread-fax": (ctx) => {
    const text = [
      "URGENT: DRUG RECALL", "Recall No. D-0417-2026", "Classification: Class II",
      "Product: Methylprednisolone Acetate Injectable Suspension, USP 40 mg/mL, 5 mL vial", "NDC 70004-417-05",
      "Lot PRORX05O925-1 EXP 09/30/2027", "Lot PRORX050925-3 EXP 09/30/2027", "Reason: Lack of assurance of sterility."
    ].join("\n");
    ctx.db.run("UPDATE fax_inbox SET text = ? WHERE recall_id = 'D-0417-2026'", text);
  },
  "receiving-problems": (ctx) => {
    ctx.db.run("UPDATE deliveries SET shipper_temp_c = 11.5 WHERE id = 'ASH-1105-07'");
    for (const l of EXTRA_LABELS["receiving-problems"]!) {
      ctx.db.run("INSERT OR IGNORE INTO ti_records (delivery_id, gtin, lot, serial, expiry) VALUES (?,?,?,?,?)", "ASH-1105-07", gtinOf(l.ndc10), l.lot, l.serial, l.expiry);
    }
  }
};

/** Wipe and re-seed the synthetic demo, as `POST /api/demo/reset` always did. */
export async function resetDemo(ctx: Ctx, actor: Actor | null, scenarioId: string | null = null) {
  ctx.db.clearAll();
  seedDatabase(ctx.db, ctx.cfg, ctx.now());
  seedPartners(ctx);
  if (scenarioId) {
    APPLY[scenarioId]?.(ctx);
    ctx.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", META_SCENARIO, scenarioId);
    ctx.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", META_LABELS, JSON.stringify(EXTRA_LABELS[scenarioId] ?? []));
  }
  await ingestFaxInbox(ctx);
  await reviewPending(ctx);
  audit(ctx, actor, scenarioId ? "demo.scenario" : "demo.reset", "demo", scenarioId ?? "reset");
}

export function listScenarios(ctx: Ctx) {
  const active = ctx.db.get<{ value: string }>("SELECT value FROM meta WHERE key = ?", META_SCENARIO)?.value ?? null;
  return { active, scenarios: SCENARIOS.map(({ id, title, brief, start }) => ({ id, title, brief, start })) };
}

export function scenarioLabels(ctx: Ctx): ScenarioLabel[] {
  const raw = ctx.db.get<{ value: string }>("SELECT value FROM meta WHERE key = ?", META_LABELS)?.value;
  return raw ? (JSON.parse(raw) as ScenarioLabel[]) : [];
}

export async function startScenario(ctx: Ctx, actor: Actor, id: string) {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new HttpError(404, `Unknown scenario ${id}.`, "scenario");
  await resetDemo(ctx, actor, id);
  return { ok: true, scenario: { id: s.id, title: s.title, brief: s.brief, start: s.start } };
}
