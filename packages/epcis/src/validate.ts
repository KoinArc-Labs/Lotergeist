import { z } from "zod";
import { KNOWN_BIZSTEPS } from "./cbv";
import { isIsoDate } from "./build";
import { parseEpc } from "./identifiers";

const ObjectEvent = z.object({
  type: z.literal("ObjectEvent"),
  eventTime: z.string().refine((s) => !Number.isNaN(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}T/.test(s), "eventTime must be an ISO 8601 date-time"),
  eventTimeZoneOffset: z.string().regex(/^[+-]\d{2}:\d{2}$/, "eventTimeZoneOffset must look like +00:00"),
  eventID: z.string().min(3).max(300).optional(),
  action: z.enum(["OBSERVE", "ADD", "DELETE"]),
  bizStep: z.string().max(200).optional(),
  disposition: z.string().max(200).optional(),
  epcList: z.array(z.string().max(200)).max(1000).optional(),
  quantityList: z.array(z.object({ epcClass: z.string().max(200), quantity: z.number().positive().optional(), uom: z.string().max(10).optional() }).passthrough()).max(1000).optional(),
  "cbvmda:lotNumber": z.string().min(1).max(20).optional(),
  "cbvmda:itemExpirationDate": z.string().refine(isIsoDate, "itemExpirationDate must be YYYY-MM-DD").optional(),
  "chimera:inferred": z.boolean().optional(),
  "chimera:inferredSerial": z.string().min(1).max(20).optional(),
  "chimera:patientId": z.string().max(30).optional(),
  "chimera:recallId": z.string().max(40).optional()
}).passthrough().superRefine((e, ctx) => {
  const add = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: "custom", message, path });
  const epcs = e.epcList ?? [], classes = e.quantityList ?? [];
  if (!epcs.length && !classes.length) add("An event needs an epcList or a quantityList.");
  epcs.forEach((x, i) => { const p = parseEpc(x); if (!p || p.form === "lgtin" || p.form === "pattern") add(`epcList[${i}] is not a well-formed SGTIN: ${x.slice(0, 60)}`, ["epcList", i]); });
  classes.forEach((c, i) => { const p = parseEpc(c.epcClass); if (!p || (p.form !== "lgtin" && p.form !== "pattern")) add(`quantityList[${i}].epcClass is not a well-formed LGTIN: ${c.epcClass.slice(0, 60)}`, ["quantityList", i]); });
  if (e.bizStep && !KNOWN_BIZSTEPS.has(e.bizStep) && !/^urn:epcglobal:cbv:bizstep:/.test(e.bizStep)) add(`Unsupported bizStep ${e.bizStep.slice(0, 80)}`, ["bizStep"]);
  if (!e.bizStep) add("bizStep is required for this pilot.", ["bizStep"]);
  const hasLot = !!e["cbvmda:lotNumber"] || classes.some((c) => parseEpc(c.epcClass)?.form === "lgtin");
  const hasSerial = epcs.some((x) => parseEpc(x)?.serial);
  if (!hasLot && !hasSerial && e["chimera:inferred"] !== true) add("An event with no lot and no serial must be marked chimera:inferred.");
  if (e["chimera:inferredSerial"] && hasSerial && epcs.some((x) => parseEpc(x)?.serial === e["chimera:inferredSerial"])) add("An inferred serial must not appear in epcList.");
});

export const EpcisDocumentSchema = z.object({
  "@context": z.union([z.string(), z.array(z.unknown()), z.record(z.unknown())]),
  type: z.literal("EPCISDocument"),
  schemaVersion: z.string().regex(/^2\.\d+/, "Only EPCIS 2.x documents are read"),
  creationDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "creationDate must be an ISO 8601 date-time"),
  epcisBody: z.object({ eventList: z.array(z.record(z.unknown())).max(5000, "At most 5000 events per document") })
}).passthrough();

export type ValidationResult = { ok: true; events: z.infer<typeof ObjectEvent>[]; skipped: { index: number; type: string }[] } | { ok: false; errors: { index: number | null; message: string }[] };

/** Validate a whole document. Non-ObjectEvent entries are skipped and reported, never trusted. */
export function validateEpcisDocument(doc: unknown): ValidationResult {
  const head = EpcisDocumentSchema.safeParse(doc);
  if (!head.success) return { ok: false, errors: head.error.issues.map((i) => ({ index: null, message: `${i.path.join(".") || "document"}: ${i.message}` })) };
  const errors: { index: number | null; message: string }[] = [];
  const events: z.infer<typeof ObjectEvent>[] = [];
  const skipped: { index: number; type: string }[] = [];
  head.data.epcisBody.eventList.forEach((raw, index) => {
    if (raw.type !== "ObjectEvent") { skipped.push({ index, type: String(raw.type ?? "unknown").slice(0, 40) }); return; }
    const r = ObjectEvent.safeParse(raw);
    if (r.success) events.push(r.data);
    else for (const i of r.error.issues) errors.push({ index, message: `${i.path.join(".") || "event"}: ${i.message}` });
  });
  return errors.length ? { ok: false, errors } : { ok: true, events, skipped };
}
