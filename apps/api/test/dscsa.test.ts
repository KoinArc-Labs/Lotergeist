import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { validateEpcisDocument, parseEpcisDocument } from "@chimera-rx/epcis";
import { buildApp, Db, ingestFaxInbox, loadConfig, SandboxNotifier, seedDatabase, type Ctx } from "../src/index";
import { verifyAuditChain } from "../src/core";
import { buildGs1 } from "./helpers";

// DSCSA trace: EPCIS export and import, the sandbox verifier, suspect cases, the recall trace and the lot_trace MCP tool.

let app: FastifyInstance;
let ctx: Ctx;
const cookies: Record<string, string> = {};
const PW = "moonlight-rx-2026";
const RECALL = "D-0417-2026";
const RECALLED_LOT = "PRORX050925-1";
const RECALLED_GTIN = "00370004417051";

beforeAll(async () => {
  process.env.OFFLINE = "1";
  const cfg = loadConfig({}, { sqlitePath: ":memory:", sandboxDelayMs: 20, today: "2026-11-05", nightWatch: false, assetsDir: "/nonexistent", webDist: "/nonexistent" });
  const db = new Db(":memory:");
  ctx = { cfg, db, notify: new SandboxNotifier(db, cfg), now: () => Date.parse("2026-11-05T22:30:00Z"), llm: null };
  seedDatabase(db, cfg, ctx.now());
  await ingestFaxInbox(ctx);
  app = await buildApp(ctx);
  for (const w of ["j.rivera", "k.patel", "m.diaz", "s.grant"]) {
    const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { storeId: "store-7", email: `${w}@elmstreetrx.example`, password: PW } });
    expect(r.statusCode).toBe(200);
    cookies[w] = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }
  // a pharmacist reads the recall notice: its lot is confirmed and quarantined (the existing path)
  const l = await app.inject({ method: "POST", url: "/api/recalls/lookup", payload: { number: RECALL }, headers: { cookie: cookies["j.rivera"]! } });
  expect(l.statusCode).toBe(200);
}, 60_000);

const call = (who: string, method: "GET" | "POST", url: string, payload?: unknown) => app.inject({ method, url, payload: payload as never, headers: { cookie: cookies[who]! } });
const json = async (who: string, method: "GET" | "POST", url: string, payload?: unknown) => (await call(who, method, url, payload)).json();
const stockSnapshot = () => JSON.stringify([
  ctx.db.all("SELECT id, serial, lot_id, status, location FROM packages ORDER BY id"),
  ctx.db.all("SELECT id, lot, status FROM lots ORDER BY id"),
  ctx.db.get("SELECT count(*) AS n FROM lot_events")
]);
const events = (doc: any) => doc.epcisBody.eventList as any[];

describe("EPCIS export", () => {
  it("a technician downloads a valid EPCIS 2.0 JSON-LD document that the validator accepts", async () => {
    const r = await call("k.patel", "GET", "/api/epcis/export");
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-disposition"]).toMatch(/attachment; filename=".*\.jsonld"/);
    const doc = r.json();
    expect(doc.type).toBe("EPCISDocument");
    expect(doc.schemaVersion).toBe("2.0");
    expect(doc["chimera:notice"]).toMatch(/not a filing/i);
    expect(events(doc).length).toBeGreaterThan(50);
    expect(validateEpcisDocument(doc).ok).toBe(true);
    // every event names a lot or a serial, or is marked inferred
    for (const e of events(doc)) expect(!!e["cbvmda:lotNumber"] || !!e.epcList?.length || e["chimera:inferred"] === true).toBe(true);
  });

  it("covers receiving, storing, dispensing and holding, and carries no patient ids by default", async () => {
    const doc = (await call("j.rivera", "GET", "/api/epcis/export")).json();
    const steps = new Set(events(doc).map((e) => String(e.bizStep).split("BizStep-")[1]));
    for (const s of ["receiving", "storing", "dispensing", "holding"]) expect([...steps]).toContain(s);
    expect(JSON.stringify(doc)).not.toMatch(/S-\d{4}/);
    const held = events(doc).filter((e) => String(e.bizStep).endsWith("holding"));
    expect(held.some((e) => String(e.disposition).endsWith("Disp-recalled"))).toBe(true);
  });

  it("filters by lot, gtin and date", async () => {
    const byLot = (await call("k.patel", "GET", `/api/epcis/export?lot=${RECALLED_LOT.toLowerCase()}`)).json();
    expect(events(byLot).length).toBeGreaterThan(0);
    for (const e of events(byLot)) expect(JSON.stringify(e).toUpperCase()).toContain(RECALLED_LOT);
    const byGtin = (await call("k.patel", "GET", `/api/epcis/export?gtin=${RECALLED_GTIN}`)).json();
    expect(events(byGtin).length).toBeGreaterThan(0);
    expect(events(byGtin).every((e) => JSON.stringify(e).includes("0370004.041705"))).toBe(true);
    const all = events((await call("k.patel", "GET", "/api/epcis/export")).json()).length;
    expect(events(byGtin).length).toBeLessThan(all);
    expect(events((await call("k.patel", "GET", "/api/epcis/export?from=2099-01-01")).json())).toHaveLength(0);
    expect(events((await call("k.patel", "GET", "/api/epcis/export?to=2000-01-01")).json())).toHaveLength(0);
    expect(events((await call("k.patel", "GET", "/api/epcis/export?from=2000-01-01&to=2099-01-01")).json()).length).toBe(all);
  });

  it("refuses bad filters", async () => {
    for (const q of ["gtin=123", "gtin=00370004417052", "from=yesterday", "to=2026-02-30", `lot=${"x".repeat(21)}`]) expect((await call("k.patel", "GET", `/api/epcis/export?${q}`)).statusCode, q).toBe(422);
  });

  it("a cashier and an admin are refused, and a technician cannot ask for patient ids", async () => {
    for (const who of ["m.diaz", "s.grant"]) expect((await call(who, "GET", "/api/epcis/export")).statusCode, who).toBe(403);
    expect((await call("k.patel", "GET", "/api/epcis/export?patients=1")).statusCode).toBe(403);
    const withPatients = (await call("j.rivera", "GET", "/api/epcis/export?patients=1")).json();
    expect(JSON.stringify(withPatients)).toMatch(/"chimera:patientId":"S-\d{4}"/);
  });

  it("marks a serial without a real read as inferred and never writes it as an EPC", async () => {
    const lot = ctx.db.get<{ id: number }>("SELECT id FROM lots LIMIT 1")!.id;
    const gtin = ctx.db.get<{ gtin: string }>("SELECT p.gtin FROM lots l JOIN products p ON p.ndc11 = l.ndc11 WHERE l.id = ?", lot)!.gtin;
    const lotName = ctx.db.get<{ lot: string }>("SELECT lot FROM lots WHERE id = ?", lot)!.lot;
    const pk = Number(ctx.db.run("INSERT INTO packages (serial, lot_id, gtin, expiry, location, zone, status, manual, note) VALUES ('NOSN-77-1', ?, ?, '2028-01-31', 'A1', 'shelf', 'on_shelf', 1, 'no serial')", lot, gtin).lastInsertRowid);
    ctx.db.run("INSERT INTO lot_events (at, kind, lot_id, package_id, user_name, note) VALUES (?, 'Received', ?, ?, 'T', '')", ctx.now(), lot, pk);
    const doc = (await call("j.rivera", "GET", `/api/epcis/export?lot=${encodeURIComponent(lotName)}`)).json();
    const nosn = events(doc).find((e) => e["chimera:inferredSerial"] === "NOSN-77-1");
    expect(nosn).toBeTruthy();
    expect(nosn["chimera:inferred"]).toBe(true);
    expect(nosn.epcList).toBeUndefined();
    expect(JSON.stringify(events(doc).flatMap((e) => e.epcList ?? []))).not.toContain("NOSN");
    ctx.db.run("DELETE FROM lot_events WHERE package_id = ?", pk);
    ctx.db.run("DELETE FROM packages WHERE id = ?", pk);
  });

  it("every export is audited", async () => {
    expect(ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM audit WHERE action = 'epcis.export'")!.n).toBeGreaterThan(3);
  });
});

describe("EPCIS import is advisory", () => {
  const makeDoc = (serials: string[], extra: Record<string, unknown> = {}) => ({
    "@context": ["https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"],
    type: "EPCISDocument", schemaVersion: "2.0", creationDate: "2026-11-05T00:00:00.000Z",
    epcisBody: {
      eventList: serials.map((s, i) => ({
        type: "ObjectEvent", eventTime: "2026-11-01T10:00:00.000Z", eventTimeZoneOffset: "+00:00", eventID: `urn:uuid:test-${s}`, action: "OBSERVE",
        bizStep: "https://ref.gs1.org/cbv/BizStep-receiving", disposition: "https://ref.gs1.org/cbv/Disp-in_progress",
        epcList: [`urn:epc:id:sgtin:0370004.041705.${s}`], "cbvmda:lotNumber": "IMPORTLOT1", "cbvmda:itemExpirationDate": "2028-01-31", ...(i === 0 ? extra : {})
      }))
    }
  });

  it("a dry run reports what would be added and changes nothing", async () => {
    const before = stockSnapshot();
    const r = await json("k.patel", "POST", "/api/epcis/import", { document: makeDoc(["IMP001", "IMP002"]), dryRun: true });
    expect(r).toMatchObject({ valid: true, dryRun: true, changesStock: false, counts: { events: 2, new: 2, duplicates: 0, unknownProduct: 0 } });
    expect(r.preview).toHaveLength(2);
    expect(stockSnapshot()).toBe(before);
    expect(ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM trace_imports")!.n).toBe(0);
    // dryRun defaults to true
    expect((await json("j.rivera", "POST", "/api/epcis/import", { document: makeDoc(["IMP001"]) })).dryRun).toBe(true);
    expect(ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM trace_imports")!.n).toBe(0);
  });

  it("an invalid document is explained, and cannot be committed", async () => {
    const bad = makeDoc(["IMP001"]) as any;
    bad.epcisBody.eventList[0].epcList = ["urn:epc:id:sgtin:1.2.3"];
    const r = await json("k.patel", "POST", "/api/epcis/import", { document: bad, dryRun: true });
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toMatch(/SGTIN/);
    expect((await call("j.rivera", "POST", "/api/epcis/import", { document: bad, dryRun: false })).statusCode).toBe(422);
    expect((await call("j.rivera", "POST", "/api/epcis/import", { document: "nope", dryRun: true })).json().valid).toBe(false);
  });

  it("only a pharmacist confirms, and confirmed events never move stock", async () => {
    const before = stockSnapshot();
    const doc = makeDoc(["IMP001", "IMP002"], { "chimera:patientId": "S-0612" });
    expect((await call("k.patel", "POST", "/api/epcis/import", { document: doc, dryRun: false })).statusCode).toBe(403);
    for (const who of ["m.diaz", "s.grant"]) expect((await call(who, "POST", "/api/epcis/import", { document: doc, dryRun: true })).statusCode).toBe(403);
    const r = await json("j.rivera", "POST", "/api/epcis/import", { document: doc, dryRun: false, label: "partner file" });
    expect(r).toMatchObject({ valid: true, dryRun: false, counts: { new: 2 } });
    expect(ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM trace_imports")!.n).toBe(2);
    expect(stockSnapshot()).toBe(before); // no package, lot or ledger event was added
    expect(ctx.db.get("SELECT 1 FROM packages WHERE serial = 'IMP001'")).toBeUndefined();
    expect(JSON.stringify(ctx.db.all("SELECT * FROM trace_imports"))).not.toContain("S-0612"); // patient ids in an import are dropped
    // the same file again: everything is a duplicate
    const again = await json("j.rivera", "POST", "/api/epcis/import", { document: doc, dryRun: true });
    expect(again.counts).toMatchObject({ new: 0, duplicates: 2 });
    expect((await json("k.patel", "GET", "/api/epcis/imports")).imports).toHaveLength(2);
  });

  it("an exported document imports back as all duplicates or new advisory rows, and parses to the same events", async () => {
    const doc = (await call("j.rivera", "GET", `/api/epcis/export?lot=${RECALLED_LOT}`)).json();
    const parsed = parseEpcisDocument(doc);
    expect(parsed.ok).toBe(true);
    expect(parsed.events.length).toBe(events(doc).length);
    const r = await json("k.patel", "POST", "/api/epcis/import", { document: doc, dryRun: true });
    expect(r.valid).toBe(true);
    expect(r.counts.events).toBe(events(doc).length);
  });
});

describe("sandbox verifier", () => {
  it("answers verified, not verified and lot recalled, logs each, and labels itself a sandbox", async () => {
    const ok = await json("k.patel", "POST", "/api/dscsa/verify", { gtin: "00370004088121", serial: "DEMO-OK-01", lot: "224016", expiry: "2028-02-29" });
    expect(ok).toMatchObject({ result: "verified", sandbox: true });
    expect(ok.label).toMatch(/sandbox/i);
    expect(ok.label).toMatch(/not a filing/i);

    const spoof = await json("k.patel", "POST", "/api/dscsa/verify", { gtin: "00370004088121", serial: "SPOOF-001", lot: "224016", expiry: "2028-02-29" });
    expect(spoof).toMatchObject({ result: "not_verified", reason: "serial_not_commissioned" });

    const lotMismatch = await json("k.patel", "POST", "/api/dscsa/verify", { gtin: "00370004088121", serial: "DEMO-OK-01", lot: "OTHERLOT", expiry: "2028-02-29" });
    expect(lotMismatch).toMatchObject({ result: "not_verified", reason: "lot_mismatch" });
    const expMismatch = await json("k.patel", "POST", "/api/dscsa/verify", { gtin: "00370004088121", serial: "DEMO-OK-01", lot: "224016", expiry: "2030-01-31" });
    expect(expMismatch).toMatchObject({ result: "not_verified", reason: "expiry_mismatch" });

    // a serial that the supplier did ship (ti_records) but whose lot is now in a confirmed recall
    const ti = ctx.db.get<any>("SELECT t.gtin, t.serial, t.lot, t.expiry FROM ti_records t LIMIT 1")!;
    const good = await json("j.rivera", "POST", "/api/dscsa/verify", { gtin: ti.gtin, serial: ti.serial, lot: ti.lot, expiry: ti.expiry });
    expect(good.result).toBe("verified");

    const log = (await json("k.patel", "GET", "/api/dscsa/verifications")).verifications;
    expect(log.length).toBeGreaterThanOrEqual(5);
    expect(log[0].response.sandbox).toBe(true);
    expect(ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM audit WHERE action = 'dscsa.verify'")!.n).toBe(log.length);
  });

  it("a lot in a confirmed recall answers lot_recalled", async () => {
    const pk = ctx.db.get<any>("SELECT k.serial FROM packages k JOIN lots l ON l.id = k.lot_id WHERE l.lot = ? AND k.manual = 0 LIMIT 1", RECALLED_LOT)!;
    ctx.db.run("INSERT OR IGNORE INTO ti_records (delivery_id, gtin, lot, serial, expiry) VALUES ('SBX-1', ?, ?, ?, '2027-06-30')", RECALLED_GTIN, RECALLED_LOT, pk.serial);
    const r = await json("k.patel", "POST", "/api/dscsa/verify", { gtin: RECALLED_GTIN, serial: pk.serial, lot: RECALLED_LOT, expiry: "2027-06-30" });
    expect(r.result).toBe("lot_recalled");
  });

  it("validates the body and refuses a cashier and an admin", async () => {
    for (const body of [{}, { gtin: "123", serial: "S", lot: "L" }, { gtin: "00370004417052", serial: "S", lot: "L" }, { gtin: RECALLED_GTIN, serial: "", lot: "L" }, { gtin: RECALLED_GTIN, serial: "x".repeat(21), lot: "L" }, { gtin: RECALLED_GTIN, serial: "S", lot: "L", expiry: "soon" }]) {
      expect((await call("k.patel", "POST", "/api/dscsa/verify", body)).statusCode, JSON.stringify(body)).toBe(422);
    }
    for (const who of ["m.diaz", "s.grant"]) expect((await call(who, "POST", "/api/dscsa/verify", { gtin: RECALLED_GTIN, serial: "S", lot: "L" })).statusCode).toBe(403);
  });

  it("a failed verification at receiving changes nothing: the package is still reported and quarantined as before", async () => {
    // a package whose serial is not in the supplier's transaction information
    const gs1 = buildGs1("70004-226-01", "AMX0926B", "2028-09-30", "UNKNOWN-9999");
    const scan = await json("k.patel", "POST", "/api/deliveries/ASH-1105-07/scan", { raw: gs1 });
    expect(scan.canConfirm).toBe(false);
    expect(scan.checks.find((c: any) => c.id === "tits").state).toBe("fail");
    const before = ctx.db.get<any>("SELECT status FROM packages WHERE id = ?", scan.packageId);
    expect(before.status).toBe("pending_putaway");
    const v = await json("k.patel", "POST", "/api/dscsa/verify", { gtin: scan.fields[0].v, serial: "UNKNOWN-9999", lot: "AMX0926B", expiry: "2028-09-30", packageId: scan.packageId });
    expect(v.result).toBe("not_verified");
    expect(ctx.db.get<any>("SELECT status FROM packages WHERE id = ?", scan.packageId).status).toBe("pending_putaway"); // verification alone does not move it
    expect((await call("k.patel", "POST", `/api/packages/${scan.packageId}/putaway`, {})).statusCode).toBe(409);
    await json("k.patel", "POST", `/api/packages/${scan.packageId}/problem`, { kind: "suspect", note: "serial unknown" });
    expect(ctx.db.get<any>("SELECT status FROM packages WHERE id = ?", scan.packageId).status).toBe("quarantined");
    expect(ctx.db.get<any>("SELECT package_id FROM verification_requests ORDER BY id DESC LIMIT 1").package_id).toBe(scan.packageId);
  });
});

describe("suspect product cases", () => {
  let caseId = 0, recalledCase = 0;

  it("a pharmacist opens a case from a failed verification; a verified package or a technician cannot", async () => {
    const bad = (await json("k.patel", "GET", "/api/dscsa/verifications")).verifications.find((v: any) => v.result === "not_verified" && v.packageId);
    expect((await call("k.patel", "POST", "/api/dscsa/cases", { verificationId: bad.id })).statusCode).toBe(403);
    const okV = (await json("k.patel", "GET", "/api/dscsa/verifications")).verifications.find((v: any) => v.result === "verified");
    expect((await call("j.rivera", "POST", "/api/dscsa/cases", { verificationId: okV.id })).statusCode).toBe(422);
    expect((await call("j.rivera", "POST", "/api/dscsa/cases", {})).statusCode).toBe(422);
    expect((await call("j.rivera", "POST", "/api/dscsa/cases", { verificationId: 99999 })).statusCode).toBe(404);
    const c = await json("j.rivera", "POST", "/api/dscsa/cases", { verificationId: bad.id, note: "serial not in supplier record" });
    caseId = c.id;
    expect(c).toMatchObject({ status: "open", source: "verification", serial: "UNKNOWN-9999" });
    expect(c.evidence.verifications.length).toBeGreaterThan(0);
    expect((await call("j.rivera", "POST", "/api/dscsa/cases", { verificationId: bad.id })).statusCode).toBe(409);
    expect((await json("k.patel", "GET", `/api/dscsa/cases/${caseId}`)).id).toBe(caseId); // a technician may read it
    expect((await json("k.patel", "GET", "/api/dscsa/cases")).cases.length).toBeGreaterThan(0);
  });

  it("the draft says it is a draft, not a filing, and sends nothing", async () => {
    const outboxBefore = ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM outbox")!.n;
    const c = await json("k.patel", "GET", `/api/dscsa/cases/${caseId}`);
    expect(c.draft.split("\n")[0]).toBe("DRAFT, not a filing, nothing is sent");
    expect(c.draft).toMatch(/UNKNOWN-9999/);
    expect(c.draft).toMatch(/does not file, send or submit/);
    expect(c.draft).not.toMatch(/HIPAA-compliant|certified/i);
    expect(ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM outbox")!.n).toBe(outboxBefore);
  });

  it("quarantine uses the existing path (Q-1 and a Quarantined lot event)", async () => {
    const lot = ctx.db.get<any>("SELECT l.id, l.lot, p.gtin FROM lots l JOIN products p ON p.ndc11 = l.ndc11 JOIN packages k ON k.lot_id = l.id WHERE k.status = 'on_shelf' AND l.status = 'active' LIMIT 1")!;
    const serial = "CASE-ON-SHELF-1";
    const pk = Number(ctx.db.run("INSERT INTO packages (serial, lot_id, gtin, expiry, location, zone, status, manual) VALUES (?,?,?,'2028-01-31','A1','shelf','on_shelf',0)", serial, lot.id, lot.gtin).lastInsertRowid);
    const v = await json("k.patel", "POST", "/api/dscsa/verify", { gtin: lot.gtin, serial, lot: lot.lot, packageId: pk });
    expect(v.result).toBe("not_verified");
    const c = await json("j.rivera", "POST", "/api/dscsa/cases", { verificationId: v.id });
    expect((await call("k.patel", "POST", `/api/dscsa/cases/${c.id}/quarantine`)).statusCode).toBe(403);
    const q = await json("j.rivera", "POST", `/api/dscsa/cases/${c.id}/quarantine`);
    expect(q.status).toBe("quarantined");
    expect(ctx.db.get<any>("SELECT status, location FROM packages WHERE id = ?", pk)).toMatchObject({ status: "quarantined", location: "Quarantine Q-1" });
    expect(ctx.db.get<any>("SELECT kind, note FROM lot_events WHERE package_id = ? ORDER BY id DESC LIMIT 1", pk)).toMatchObject({ kind: "Quarantined", note: expect.stringContaining(`case ${c.id}`) });
    // a not-on-hand package is only recorded: closing as cleared needs a reason
    expect((await call("j.rivera", "POST", `/api/dscsa/cases/${c.id}/close`, { status: "closed_cleared", note: "" })).statusCode).toBe(422);
    expect((await json("j.rivera", "POST", `/api/dscsa/cases/${c.id}/close`, { status: "closed_cleared", note: "manufacturer confirmed serial by phone" })).status).toBe("closed_cleared");
    expect((await call("j.rivera", "POST", `/api/dscsa/cases/${c.id}/close`, { status: "closed_confirmed", note: "" })).statusCode).toBe(409);
    // clearing a case does not put the unit back on the shelf: release stays a separate, existing action
    expect(ctx.db.get<any>("SELECT status FROM packages WHERE id = ?", pk).status).toBe("quarantined");
  });

  it("a recalled lot stays blocked: its case cannot be cleared, and receiving still refuses it", async () => {
    const pk = ctx.db.get<any>("SELECT k.id, k.serial FROM packages k JOIN lots l ON l.id = k.lot_id WHERE l.lot = ? AND k.manual = 0 LIMIT 1", RECALLED_LOT)!;
    const c = await json("j.rivera", "POST", "/api/dscsa/cases", { recallId: RECALL, lot: RECALLED_LOT, packageId: pk.id });
    recalledCase = c.id;
    expect(c).toMatchObject({ source: "recall", recallId: RECALL, lot: RECALLED_LOT });
    expect((await call("j.rivera", "POST", "/api/dscsa/cases", { recallId: RECALL, lot: "NOT-A-RECALLED-LOT" })).statusCode).toBe(422);
    const cleared = await call("j.rivera", "POST", `/api/dscsa/cases/${recalledCase}/close`, { status: "closed_cleared", note: "looks fine" });
    expect(cleared.statusCode).toBe(409);
    expect(cleared.json().code).toBe("recalled_blocked");
    expect((await json("j.rivera", "POST", `/api/dscsa/cases/${recalledCase}/close`, { status: "closed_confirmed", note: "recall unit held" })).status).toBe("closed_confirmed");
    // closed, and the lot is still recalled and still refused at the dock
    expect(ctx.db.get<any>("SELECT status FROM lots WHERE lot = ?", RECALLED_LOT).status).toBe("recalled");
    const scan = await json("k.patel", "POST", "/api/deliveries/ASH-1105-07/scan", { raw: buildGs1("70004-417-05", RECALLED_LOT, "2027-06-30", "AFTER-CLOSE-1") });
    expect(scan.canConfirm).toBe(false);
    expect(scan.checks.find((c: any) => c.id === "recall").state).toBe("fail");
  });
});

describe("recall trace export", () => {
  it("exports the events of the confirmed recalled lots, patient ids only, never names", async () => {
    const r = await call("j.rivera", "GET", `/api/recalls/${RECALL}/trace-export`);
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-disposition"]).toMatch(/attachment/);
    const doc = r.json();
    expect(validateEpcisDocument(doc).ok).toBe(true);
    expect(doc["chimera:recallId"]).toBe(RECALL);
    const evs = events(doc);
    expect(evs.length).toBeGreaterThan(0);
    const recalledLots = ctx.db.all<{ lot: string }>("SELECT lot FROM recall_lots WHERE recall_id = ? AND confirmed_at IS NOT NULL", RECALL).map((l) => l.lot);
    expect(recalledLots).toContain(RECALLED_LOT);
    for (const e of evs) expect(recalledLots).toContain(e["cbvmda:lotNumber"]); // nothing from any other lot
    expect(evs.some((e) => e["cbvmda:lotNumber"] === RECALLED_LOT)).toBe(true);
    const dispensed = evs.filter((e) => String(e.bizStep).endsWith("dispensing"));
    expect(dispensed.length).toBeGreaterThan(0);
    expect(dispensed.every((e) => /^S-\d{4}$/.test(e["chimera:patientId"]))).toBe(true);
    const names = ctx.db.all<{ name: string }>("SELECT name FROM patients").map((p) => p.name);
    expect(names.length).toBeGreaterThan(3);
    for (const n of names) expect(JSON.stringify(doc)).not.toContain(n);
    expect(JSON.stringify(doc)).not.toMatch(/\(555\)|@example\.com/);
  });

  it("is for pharmacists only, needs a known recall, and is audited", async () => {
    for (const who of ["k.patel", "m.diaz", "s.grant"]) expect((await call(who, "GET", `/api/recalls/${RECALL}/trace-export`)).statusCode, who).toBe(403);
    expect((await call("j.rivera", "GET", "/api/recalls/NOPE/trace-export")).statusCode).toBe(404);
    expect(ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM audit WHERE action = 'epcis.export' AND entity = 'recall'")!.n).toBeGreaterThan(0);
  });
});

describe("lot_trace MCP tool", () => {
  it("is read-only, needs inventory.read, returns EPCIS events and no patient ids", async () => {
    const k = await json("s.grant", "POST", "/api/integrations/int-mercy-clinic/rotate");
    await call("s.grant", "POST", "/api/integrations/int-mercy-clinic", { ipAllowlist: ["127.0.0.1"] });
    const k2 = await json("s.grant", "POST", "/api/integrations/int-mercy-clinic/rotate");
    const tok = (await app.inject({ method: "POST", url: "/oauth/token", payload: { grant_type: "client_credentials", client_id: k2.clientId, client_secret: k2.clientSecret } })).json().access_token;
    void k;
    const rpc = (body: unknown) => app.inject({ method: "POST", url: "/mcp", payload: body as never, headers: { authorization: `Bearer ${tok}` } });
    const tools = (await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" })).json().result.tools;
    const t = tools.find((x: any) => x.name === "lot_trace");
    expect(t.annotations.readOnlyHint).toBe(true);
    const hit = (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "lot_trace", arguments: { ndc: "70004-417-05", lot: RECALLED_LOT.toLowerCase() } } })).json().result;
    expect(hit.isError).toBe(false);
    expect(hit.structuredContent.found).toBe(true);
    expect(validateEpcisDocument(hit.structuredContent.document).ok).toBe(true);
    expect(JSON.stringify(hit.structuredContent)).not.toMatch(/S-\d{4}|patientId/);
    const none = (await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "lot_trace", arguments: { ndc: "70004-417-05", lot: "NOPE" } } })).json().result;
    expect(none.structuredContent).toMatchObject({ found: false, events: 0 });
    const bad = (await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "lot_trace", arguments: { ndc: "70004-417-05" } } })).json().result;
    expect(bad.isError).toBe(true);
  });
});

describe("audit chain", () => {
  it("still verifies after all of the above", async () => {
    expect(verifyAuditChain(ctx)).toMatchObject({ ok: true });
    expect((await json("j.rivera", "GET", "/api/audit/verify")).ok).toBe(true);
    const actions = new Set(ctx.db.all<{ action: string }>("SELECT DISTINCT action FROM audit").map((a) => a.action));
    for (const a of ["epcis.export", "epcis.import", "dscsa.verify", "dscsa.case_open", "dscsa.case_quarantine", "dscsa.case_close"]) expect(actions.has(a), a).toBe(true);
  });
});
