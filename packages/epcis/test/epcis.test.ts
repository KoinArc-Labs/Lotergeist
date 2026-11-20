import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { gtinCheckDigit, ndc10ToGtin14 } from "@chimera-rx/gs1";
import {
  buildEpcisDocument, cbvFor, gtinToLgtinUrn, gtinToSgtinUrn, HOLD_REASONS, isTraceable, kindFromCbv, parseEpc, parseEpcisDocument,
  SGTIN_URN_RE, LGTIN_URN_RE, toObjectEvent, TRACE_KINDS, validateEpcisDocument, type TraceEvent, escapeUrnValue, unescapeUrnValue, gtinToDigitalLink
} from "../src/index";

const digits = (n: number) => fc.stringMatching(new RegExp(`^[0-9]{${n}}$`));
const gtinArb = digits(13).map((b) => b + gtinCheckDigit(b));
// any printable serial or lot, including characters that need URN escaping
const idArb = fc.string({ minLength: 1, maxLength: 20, unit: fc.constantFrom(..."ABCXYZabcxyz0123456789-._/ #%&?<>\"'+".split("")) });
const day = fc.integer({ min: 2024, max: 2032 }).chain((y) => fc.tuple(fc.constant(y), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }))).map(([y, m, d]) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
const eventArb: fc.Arbitrary<TraceEvent> = fc.record({
  at: fc.integer({ min: Date.parse("2025-01-01"), max: Date.parse("2030-01-01") }),
  kind: fc.constantFrom(...TRACE_KINDS),
  gtin: gtinArb,
  lot: idArb,
  serial: idArb,
  expiry: day,
  location: fc.constantFrom("store-7", "store-2", "Quarantine Q-1")
}).chain((e0) => {
  const e = { ...e0, ...(e0.kind === "holding" ? { hold: "recalled" as const } : {}) };
  return fc.oneof(fc.constant<TraceEvent>(e), fc.constant<TraceEvent>({ ...e, serial: undefined })); // second form: a lot-level event
});

describe("SGTIN and LGTIN identifiers", () => {
  it("converts the worked example GTIN to the documented URN", () => {
    // 0 | 0370004 | 41705 -> indicator 0 + item reference 41705, check digit dropped
    expect(gtinToSgtinUrn("00370004417051", "A1B2C3")).toBe("urn:epc:id:sgtin:0370004.041705.A1B2C3");
    expect(gtinToDigitalLink("00370004417051", "A1B2C3")).toBe("https://id.gs1.org/01/00370004417051/21/A1B2C3");
  });

  it("rejects an invalid GTIN or an empty serial", () => {
    expect(() => gtinToSgtinUrn("00370004417052", "X")).toThrow();
    expect(() => gtinToSgtinUrn("00370004417051", "")).toThrow();
    expect(() => gtinToSgtinUrn("00370004417051", "x".repeat(21))).toThrow();
  });

  it("every URN built from any valid GTIN and serial is well-formed and parses back (PBT)", () => {
    fc.assert(fc.property(gtinArb, idArb, fc.integer({ min: 6, max: 9 }), (g, serial, cp) => {
      const urn = gtinToSgtinUrn(g, serial, cp);
      expect(SGTIN_URN_RE.test(urn)).toBe(true);
      const p = parseEpc(urn)!;
      expect(p.gtin).toBe(g);
      expect(p.serial).toBe(serial);
      const lg = gtinToLgtinUrn(g, serial, cp);
      expect(LGTIN_URN_RE.test(lg)).toBe(true);
      expect(parseEpc(lg)!.lot).toBe(serial);
    }), { numRuns: 300 });
  });

  it("escaping round trips and never leaves a raw reserved character (PBT)", () => {
    fc.assert(fc.property(fc.string({ maxLength: 20 }), (s) => {
      const e = escapeUrnValue(s);
      expect(/^[A-Za-z0-9!'()*+,\-.:;=_%]*$/.test(e)).toBe(true);
      expect(unescapeUrnValue(e)).toBe(s);
    }));
  });

  it("parses the GS1 Digital Link form too", () => {
    const p = parseEpc(gtinToDigitalLink(ndc10ToGtin14("70004-417-05"), "S/1 2"));
    expect(p).toMatchObject({ form: "digital-link", serial: "S/1 2" });
  });

  it("rejects malformed EPC strings", () => {
    for (const bad of ["", "urn:epc:id:sgtin:123.456.789", "urn:epc:id:sgtin:0370004.041705.", "urn:epc:id:sgtin:0370004.041705.a b", "https://evil.example/01/00370004417051/21/1"]) expect(parseEpc(bad)).toBeNull();
  });
});

describe("CBV mapping", () => {
  it("maps every kind to a bizStep and disposition that reads back to the same kind", () => {
    for (const kind of TRACE_KINDS) {
      const m = cbvFor(kind);
      expect(m.bizStep).toMatch(/^https:\/\/ref\.gs1\.org\/cbv\/BizStep-/);
      expect(kindFromCbv(m.bizStep, m.disposition)?.kind).toBe(kind);
    }
  });
  it("holding carries non_conformant or recalled", () => {
    expect(cbvFor("holding").disposition).toMatch(/Disp-non_conformant$/);
    expect(cbvFor("holding", "recalled").disposition).toMatch(/Disp-recalled$/);
    for (const h of HOLD_REASONS) expect(kindFromCbv(cbvFor("holding", h).bizStep, cbvFor("holding", h).disposition)).toEqual({ kind: "holding", hold: h });
  });
  it("names the specified steps", () => {
    expect(cbvFor("receiving").bizStep).toMatch(/BizStep-receiving$/);
    expect(cbvFor("storing").bizStep).toMatch(/BizStep-storing$/);
    expect(cbvFor("dispensing").bizStep).toMatch(/BizStep-dispensing$/);
    expect(cbvFor("returning").bizStep).toMatch(/BizStep-returning$/);
    expect(cbvFor("destroying").bizStep).toMatch(/BizStep-destroying$/);
  });
  it("does not read an unknown bizStep", () => expect(kindFromCbv("https://ref.gs1.org/cbv/BizStep-fantasy", undefined)).toBeNull());
});

describe("building, validating and parsing", () => {
  it("round trips any event through a document and back (PBT)", () => {
    fc.assert(fc.property(fc.array(eventArb, { minLength: 1, maxLength: 6 }), (events) => {
      const doc = buildEpcisDocument(events, { creationDate: 0 });
      const v = validateEpcisDocument(JSON.parse(JSON.stringify(doc)));
      expect(v.ok).toBe(true);
      const back = parseEpcisDocument(JSON.parse(JSON.stringify(doc)));
      expect(back.ok).toBe(true);
      expect(back.events.map(({ id, ...r }) => r)).toEqual(events.map((e) => JSON.parse(JSON.stringify(e))));
    }), { numRuns: 200 });
  });

  it("never emits an event with neither lot nor serial unless it is marked inferred (PBT)", () => {
    const loose = fc.record({ at: fc.integer({ min: 1, max: 2e12 }), kind: fc.constantFrom(...TRACE_KINDS), gtin: gtinArb, lot: fc.option(idArb, { nil: undefined }), serial: fc.option(idArb, { nil: undefined }), inferred: fc.option(fc.boolean(), { nil: undefined }) });
    fc.assert(fc.property(loose, (e) => {
      if (!isTraceable(e)) { expect(() => toObjectEvent(e)).toThrow(); return; }
      const o = toObjectEvent(e) as any;
      const hasLot = !!o["cbvmda:lotNumber"] || JSON.stringify(o.quantityList ?? []).includes("lgtin");
      const hasSerial = (o.epcList ?? []).length > 0;
      expect(hasLot || hasSerial || o["chimera:inferred"] === true).toBe(true);
      // an inferred serial is never an EPC
      if (e.inferred && e.serial) expect(JSON.stringify(o.epcList ?? [])).not.toContain(escapeUrnValue(e.serial));
    }), { numRuns: 400 });
  });

  it("carries an inferred NOSN serial as an extension and never as an EPC", () => {
    const g = ndc10ToGtin14("70004-417-05");
    const o = toObjectEvent({ at: 1_700_000_000_000, kind: "receiving", gtin: g, lot: "L1", serial: "NOSN-4-1", inferred: true }) as any;
    expect(o.epcList).toBeUndefined();
    expect(o["chimera:inferred"]).toBe(true);
    expect(o["chimera:inferredSerial"]).toBe("NOSN-4-1");
    expect(o.quantityList[0].epcClass).toMatch(/^urn:epc:class:lgtin:/);
    const back = parseEpcisDocument(buildEpcisDocument([{ at: 1_700_000_000_000, kind: "receiving", gtin: g, lot: "L1", serial: "NOSN-4-1", inferred: true }]));
    expect(back.events[0]).toMatchObject({ inferred: true, serial: "NOSN-4-1", lot: "L1" });
  });

  it("allows a bare product event only when marked inferred", () => {
    const g = ndc10ToGtin14("70004-417-05");
    expect(() => toObjectEvent({ at: 1, kind: "adjusting", gtin: g })).toThrow(/inferred/);
    expect((toObjectEvent({ at: 1, kind: "adjusting", gtin: g, inferred: true }) as any).quantityList[0].epcClass).toMatch(/idpat:sgtin/);
  });

  it("the validator refuses bad documents with a path and a reason", () => {
    const good = buildEpcisDocument([{ at: 1_700_000_000_000, kind: "receiving", gtin: ndc10ToGtin14("70004-417-05"), lot: "L1", serial: "S1" }]) as any;
    expect(validateEpcisDocument(good).ok).toBe(true);
    const cases: [string, (d: any) => void][] = [
      ["bad version", (d) => { d.schemaVersion = "1.2"; }],
      ["no lists", (d) => { delete d.epcisBody.eventList[0].epcList; }],
      ["bad epc", (d) => { d.epcisBody.eventList[0].epcList = ["urn:epc:id:sgtin:1.2.3"]; }],
      ["bad time", (d) => { d.epcisBody.eventList[0].eventTime = "yesterday"; }],
      ["unknown bizStep", (d) => { d.epcisBody.eventList[0].bizStep = "https://ref.gs1.org/cbv/BizStep-fantasy"; }],
      ["bad expiry", (d) => { d.epcisBody.eventList[0]["cbvmda:itemExpirationDate"] = "2027-02-30"; }],
      ["no identity", (d) => { d.epcisBody.eventList[0].epcList = undefined; d.epcisBody.eventList[0].quantityList = [{ epcClass: "urn:epc:idpat:sgtin:0370004.041705.*", quantity: 1 }]; delete d.epcisBody.eventList[0]["cbvmda:lotNumber"]; }],
      ["inferred serial leaked into epcList", (d) => { d.epcisBody.eventList[0]["chimera:inferredSerial"] = "S1"; }]
    ];
    for (const [name, mutate] of cases) {
      const d = JSON.parse(JSON.stringify(good));
      mutate(d);
      const r = validateEpcisDocument(d);
      expect(r.ok, name).toBe(false);
      if (!r.ok) expect(r.errors.length, name).toBeGreaterThan(0);
    }
    expect(validateEpcisDocument("nope").ok).toBe(false);
    expect(validateEpcisDocument({}).ok).toBe(false);
  });

  it("skips and reports event types other than ObjectEvent", () => {
    const d = buildEpcisDocument([{ at: 1_700_000_000_000, kind: "receiving", gtin: ndc10ToGtin14("70004-417-05"), lot: "L1" }]) as any;
    d.epcisBody.eventList.push({ type: "AggregationEvent" });
    const r = parseEpcisDocument(d);
    expect(r.ok).toBe(true);
    expect(r.skipped).toEqual([{ index: 1, type: "AggregationEvent" }]);
    expect(r.events).toHaveLength(1);
  });

  it("marks the document as a sandbox and carries the EPCIS 2.0 context", () => {
    const d = buildEpcisDocument([], { creationDate: 0 });
    expect(d.schemaVersion).toBe("2.0");
    expect(JSON.stringify(d["@context"])).toContain("epcis-context.jsonld");
    expect(String(d["chimera:notice"])).toMatch(/not a filing/i);
  });
});
