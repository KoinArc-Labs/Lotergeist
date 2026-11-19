import { gtinCheckDigit, isValidGtin, sgtinDigitalLink } from "@chimera-rx/gs1";

/**
 * EPC identifiers for a serialized pharmacy package.
 * SGTIN pure-identity URN: urn:epc:id:sgtin:<company prefix>.<indicator + item reference>.<serial>
 * LGTIN class URN (lot level, no serial): urn:epc:class:lgtin:<company prefix>.<indicator + item reference>.<lot>
 *
 * A GTIN-14 does not say where the GS1 company prefix ends. NDC-based GTINs carry the FDA labeler code inside the
 * prefix, so the split is a parameter. DEFAULT_COMPANY_PREFIX_LENGTH is a sandbox assumption, not a lookup.
 */
export const DEFAULT_COMPANY_PREFIX_LENGTH = 7;

const SAFE = /[A-Za-z0-9!'()*+,\-.:;=_]/;

/** GS1 TDS escaping for serial and lot in a URN: anything outside the allowed set becomes %XX (uppercase hex). */
export function escapeUrnValue(v: string): string {
  let out = "";
  for (const b of new TextEncoder().encode(v)) {
    const ch = String.fromCharCode(b);
    out += b < 0x80 && SAFE.test(ch) ? ch : `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

export function unescapeUrnValue(v: string): string | null {
  if (/%(?![0-9A-Fa-f]{2})/.test(v)) return null;
  try { return decodeURIComponent(v); } catch { return null; }
}

function split(gtin14: string, cpLen: number): { cp: string; item: string } {
  if (!/^\d{14}$/.test(gtin14) || !isValidGtin(gtin14)) throw new Error(`Not a valid GTIN-14: ${gtin14}`);
  if (!Number.isInteger(cpLen) || cpLen < 6 || cpLen > 12) throw new Error("Company prefix length must be 6 to 12.");
  return { cp: gtin14.slice(1, 1 + cpLen), item: gtin14[0]! + gtin14.slice(1 + cpLen, 13) };
}

export function gtinToSgtinUrn(gtin14: string, serial: string, cpLen = DEFAULT_COMPANY_PREFIX_LENGTH): string {
  if (!serial || serial.length > 20) throw new Error("A serial is 1 to 20 characters.");
  const { cp, item } = split(gtin14, cpLen);
  return `urn:epc:id:sgtin:${cp}.${item}.${escapeUrnValue(serial)}`;
}

export function gtinToLgtinUrn(gtin14: string, lot: string, cpLen = DEFAULT_COMPANY_PREFIX_LENGTH): string {
  if (!lot || lot.length > 20) throw new Error("A lot is 1 to 20 characters.");
  const { cp, item } = split(gtin14, cpLen);
  return `urn:epc:class:lgtin:${cp}.${item}.${escapeUrnValue(lot)}`;
}

/** Class pattern for a product with neither lot nor serial (only used for events marked inferred). */
export function gtinToProductPattern(gtin14: string, cpLen = DEFAULT_COMPANY_PREFIX_LENGTH): string {
  const { cp, item } = split(gtin14, cpLen);
  return `urn:epc:idpat:sgtin:${cp}.${item}.*`;
}

function rebuildGtin(cp: string, item: string): string | null {
  if (!/^\d{6,12}$/.test(cp) || item.length !== 13 - cp.length || !/^\d+$/.test(item)) return null;
  const body = item[0]! + cp + item.slice(1);
  return body + gtinCheckDigit(body);
}

export const SGTIN_URN_RE = /^urn:epc:id:sgtin:(\d{6,12})\.(\d{1,7})\.([A-Za-z0-9!'()*+,\-.:;=_%]{1,60})$/;
export const LGTIN_URN_RE = /^urn:epc:class:lgtin:(\d{6,12})\.(\d{1,7})\.([A-Za-z0-9!'()*+,\-.:;=_%]{1,60})$/;
export const PATTERN_URN_RE = /^urn:epc:idpat:sgtin:(\d{6,12})\.(\d{1,7})\.\*$/;

export interface ParsedEpc { form: "sgtin" | "lgtin" | "pattern" | "digital-link"; gtin: string; serial?: string; lot?: string; cpLen?: number }

export function parseEpc(epc: string): ParsedEpc | null {
  let m = SGTIN_URN_RE.exec(epc);
  if (m) {
    const gtin = rebuildGtin(m[1]!, m[2]!), serial = unescapeUrnValue(m[3]!);
    return gtin && serial && serial.length <= 20 ? { form: "sgtin", gtin, serial, cpLen: m[1]!.length } : null;
  }
  m = LGTIN_URN_RE.exec(epc);
  if (m) {
    const gtin = rebuildGtin(m[1]!, m[2]!), lot = unescapeUrnValue(m[3]!);
    return gtin && lot && lot.length <= 20 ? { form: "lgtin", gtin, lot, cpLen: m[1]!.length } : null;
  }
  m = PATTERN_URN_RE.exec(epc);
  if (m) {
    const gtin = rebuildGtin(m[1]!, m[2]!);
    return gtin ? { form: "pattern", gtin, cpLen: m[1]!.length } : null;
  }
  const d = /^https:\/\/id\.gs1\.org\/01\/(\d{14})\/21\/([^/?#]+)$/.exec(epc);
  if (d && isValidGtin(d[1]!)) {
    const serial = unescapeUrnValue(d[2]!);
    return serial && serial.length <= 20 ? { form: "digital-link", gtin: d[1]!, serial } : null;
  }
  return null;
}

/** GS1 Digital Link for an item (instance) or a lot. Serial and lot are percent-encoded. */
export function gtinToDigitalLink(gtin14: string, serial: string): string {
  return sgtinDigitalLink(gtin14, serial);
}
export function lotDigitalLink(gtin14: string, lot: string): string {
  return `https://id.gs1.org/01/${gtin14}/10/${encodeURIComponent(lot)}`;
}
