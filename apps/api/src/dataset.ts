import type { Db } from "./db";
import { DAY, gtinOf, ndc11Digits, rng, suggestLocation, type Storage } from "./domain";

/**
 * Larger synthetic dataset (FR5, US2.4). Adds about 140 synthetic products, 500 patients and 5,000 sold fills over
 * 6 months on top of the demo seed, from a fixed seed so two runs give identical data (FR5.2).
 *
 * Everything is invented: labeler 70005 is not a real NDC labeler code, patient IDs are S-1000..S-1499, phones use
 * (555) 010-01xx and emails use example.com (pharmacy-safety.md rule 1).
 *
 * One product is the "timing" product: levothyroxine lot LV2611A is dispensed often, so recall D-0650-2026 (a synthetic
 * fixture) has a large impact list for the published timing run (FR2.2).
 */

export interface DatasetOptions { seed?: number; patients?: number; fills?: number; products?: number; days?: number; now?: number }
export interface DatasetSummary { seed: number; products: number; lots: number; patients: number; fills: number; legacyFills: number; packages: number }

export const TIMING_RECALL = { number: "D-0650-2026", ndc10: "70005-100-90", lot: "LV2611A" };

const GENERICS: [string, string, string, Storage][] = [
  ["Levothyroxine", "50 mcg", "tablet", "room"], ["Losartan", "50 mg", "tablet", "room"], ["Omeprazole", "20 mg", "capsule", "room"],
  ["Simvastatin", "40 mg", "tablet", "room"], ["Hydrochlorothiazide", "25 mg", "tablet", "room"], ["Gabapentin", "300 mg", "capsule", "room"],
  ["Montelukast", "10 mg", "tablet", "room"], ["Escitalopram", "10 mg", "tablet", "room"], ["Pantoprazole", "40 mg", "tablet", "room"],
  ["Furosemide", "20 mg", "tablet", "room"], ["Prednisone", "10 mg", "tablet", "room"], ["Tamsulosin", "0.4 mg", "capsule", "room"],
  ["Meloxicam", "15 mg", "tablet", "room"], ["Clopidogrel", "75 mg", "tablet", "room"], ["Rosuvastatin", "10 mg", "tablet", "room"],
  ["Bupropion XL", "150 mg", "tablet", "room"], ["Trazodone", "50 mg", "tablet", "room"], ["Carvedilol", "12.5 mg", "tablet", "room"],
  ["Cetirizine", "10 mg", "tablet", "room"], ["Fluoxetine", "20 mg", "capsule", "room"], ["Glipizide", "5 mg", "tablet", "room"],
  ["Duloxetine", "30 mg", "capsule", "room"], ["Spironolactone", "25 mg", "tablet", "room"], ["Topiramate", "25 mg", "tablet", "room"],
  ["Insulin lispro", "100 U/mL", "pen injector", "cold"], ["Insulin aspart", "100 U/mL", "pen injector", "cold"], ["Liraglutide", "6 mg/mL", "pen injector", "cold"],
  ["Enoxaparin", "40 mg/0.4 mL", "syringe", "cold"], ["Etanercept", "50 mg/mL", "syringe", "cold"],
  ["Hydrocodone/APAP", "5/325 mg", "tablet", "c2"], ["Methylphenidate ER", "36 mg", "tablet", "c2"], ["Morphine ER", "15 mg", "tablet", "c2"],
  ["Amphetamine salts", "20 mg", "tablet", "c2"], ["Cephalexin", "500 mg", "capsule", "room"], ["Azithromycin", "250 mg", "tablet", "room"]
];
const PACKS = ["30 ct", "90 ct", "100 ct", "500 ct"];
const MAKERS = ["Pale Harbor Pharma", "Marrowfield Labs", "Hollow Creek Pharma", "Nightjar Biologics", "Ashen Vale Generics"];
const FIRSTS = ["Avery", "Blake", "Casey", "Drew", "Emery", "Finley", "Gray", "Harper", "Indy", "Jules", "Kendall", "Logan", "Morgan", "Noel", "Oakley", "Parker", "Quinn", "Reese", "Sage", "Taylor", "Uma", "Vale", "Wren", "Yael", "Zion"];
const LASTS = ["Ashby", "Brook", "Calder", "Dale", "Ellery", "Fenn", "Garrow", "Holt", "Iver", "Jessop", "Kerr", "Lowe", "Marsh", "Nye", "Orme", "Pike", "Rook", "Shaw", "Thorne", "Vance"];

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function generateHistory(db: Db, o: DatasetOptions = {}): DatasetSummary {
  const seed = o.seed ?? 20261204;
  const R = rng(seed);
  const nProducts = o.products ?? 140;
  const nPatients = o.patients ?? 500;
  const nFills = o.fills ?? 5000;
  const days = o.days ?? 182;
  // Anchor to a fixed day so the same seed gives the same rows whatever day it runs (FR5.2).
  const now = o.now ?? Date.UTC(2026, 10, 18, 12);
  const start = now - days * DAY;
  const sum: DatasetSummary = { seed, products: 0, lots: 0, patients: 0, fills: 0, legacyFills: 0, packages: 0 };

  db.tx(() => {
    // ---------- products: 70005-ppp-ss (5-3-2)
    const products: { ndc10: string; ndc11: string; name: string; storage: Storage; weight: number }[] = [];
    for (let i = 0; i < nProducts; i++) {
      const [g, strength, form, storage] = GENERICS[i % GENERICS.length]!;
      const pack = PACKS[Math.floor(i / GENERICS.length) % PACKS.length]!;
      const ndc10 = `70005-${pad(100 + i, 3)}-${i % GENERICS.length === 0 && i === 0 ? "90" : pad(10 + (i % 80), 2)}`;
      const ndc11 = ndc11Digits(ndc10);
      const name = `${g} ${strength} · ${pack}`;
      db.run("INSERT OR IGNORE INTO products (ndc11, ndc10, gtin, name, strength, form, pack_size, storage, maker, source, reorder_point) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ndc11, ndc10, gtinOf(ndc10), name, strength, form, pack, storage, MAKERS[i % MAKERS.length], "synthetic", 4);
      // A few products carry most fills, like a real pharmacy's top sellers; the timing product carries the most.
      products.push({ ndc10, ndc11, name, storage, weight: i === 0 ? 40 : i < 20 ? 8 : 1 });
      sum.products++;
    }
    const totalW = products.reduce((a, p) => a + p.weight, 0);
    const pickProduct = () => { let x = R.next() * totalW; for (const p of products) { x -= p.weight; if (x <= 0) return p; } return products[products.length - 1]!; };

    // ---------- patients
    const pts: string[] = [];
    for (let i = 0; i < nPatients; i++) {
      const id = `S-${pad(1000 + i, 4)}`;
      const name = `${FIRSTS[i % FIRSTS.length]} ${LASTS[Math.floor(i / FIRSTS.length) % LASTS.length]}`;
      const ch = R.next();
      const sms = ch < 0.55 ? 1 : 0, email = ch > 0.35 ? 1 : 0;
      db.run("INSERT OR IGNORE INTO patients (id, name, dob, phone, email, preferred, sms_consent, email_consent, allergies) VALUES (?,?,?,?,?,?,?,?,?)",
        id, name, `19${pad(40 + (i % 60), 2)}-${pad(1 + (i % 12), 2)}-${pad(1 + ((i * 11) % 28), 2)}`, `(555) 010-01${pad(i % 100, 2)}`,
        email ? `${id.toLowerCase()}@example.com` : "", sms ? "sms" : email ? "email" : "phone", sms, email, "");
      pts.push(id);
      sum.patients++;
    }

    // ---------- plan fills, then create lots with enough packages (plus some left on the shelf)
    const plan = new Map<string, number[]>(); // ndc11 -> fill times
    for (let i = 0; i < nFills; i++) {
      const p = pickProduct();
      const t = start + Math.floor(R.next() * (days - 1) * DAY);
      (plan.get(p.ndc11) ?? plan.set(p.ndc11, []).get(p.ndc11)!).push(t);
    }
    let rxSeq = 0;
    for (const p of products) {
      const times = (plan.get(p.ndc11) ?? []).sort((a, b) => a - b);
      // one lot per ~2 months of fills; the timing product's first lot is LV2611A
      const nLots = Math.max(1, Math.min(3, Math.ceil(times.length / 60)));
      const loc = suggestLocation({ ndc11: p.ndc11, name: p.name, storage: p.storage });
      for (let L = 0; L < nLots; L++) {
        const lot = p.ndc10 === TIMING_RECALL.ndc10 && L === 0 ? TIMING_RECALL.lot : `G${p.ndc10.slice(6, 9)}${String.fromCharCode(65 + L)}${pad(R.int(10, 99), 2)}`;
        const expiry = `${2027 + (L % 2)}-${pad(1 + R.int(0, 11), 2)}-28`;
        const lotId = Number(db.run("INSERT OR IGNORE INTO lots (ndc11, lot, expiry, status) VALUES (?,?,?, 'active')", p.ndc11, lot, expiry).lastInsertRowid);
        sum.lots++;
        const mine = times.filter((_, k) => k % nLots === L);
        const recvAt = (mine[0] ?? now - 7 * DAY) - 3 * DAY;
        const left = R.int(2, 6);
        const gtin = gtinOf(p.ndc10);
        const pkgIds: number[] = [];
        for (let n = 0; n < mine.length + left; n++) {
          pkgIds.push(Number(db.run("INSERT INTO packages (serial, lot_id, gtin, expiry, location, zone, status, delivery_id, received_at, received_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
            `${lot}${pad(n + 1, 5)}`, lotId, gtin, expiry, loc.location, loc.zone, "on_shelf", "HIST", recvAt, "K. Patel, CPhT").lastInsertRowid));
          sum.packages++;
        }
        db.run("INSERT INTO lot_events (at, kind, lot_id, package_id, user_name, note) VALUES (?,?,?,?,?,?)", recvAt, "Received", lotId, null, "K. Patel, CPhT", `${pkgIds.length} units · synthetic history`);
        mine.forEach((t, k) => {
          const rx = `H${pad(++rxSeq, 6)}`;
          const patient = pts[R.int(0, pts.length - 1)]!;
          // Fills in the first month predate the counter scanner: no package was recorded (the gap Chimera Rx closes).
          const legacy = t < start + 30 * DAY && R.next() < 0.25;
          const rxId = Number(db.run("INSERT INTO prescriptions (rx, patient_id, ndc11, drug, qty, directions, prescriber, refills, status, due) VALUES (?,?,?,?,?,?,?,?,?,?)",
            rx, patient, p.ndc11, p.name, 1, "Use as directed", "Dr. L. Moreno", 1, "sold", iso(t)).lastInsertRowid);
          const pkg = legacy ? null : pkgIds[k]!;
          if (pkg) db.run("UPDATE packages SET status = 'dispensed' WHERE id = ?", pkg);
          db.run("INSERT INTO dispenses (rx_id, package_id, state, filled_by, filled_at, verified_by, verified_at, sold_at, register, id_checked, counseled, signature, contact_json, label_printed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rxId, pkg, "sold", "K. Patel, CPhT", t, "J. Rivera, PharmD", t + 600_000, t + 1_800_000, "POS 2", 1, 1, 1, "{}", 1);
          sum.fills++;
          if (legacy) sum.legacyFills++;
        });
      }
    }
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('dataset', ?)", JSON.stringify(sum));
  });
  return sum;
}

/** Lot-capture rate (FR2.3): share of sold fills whose package (lot and serial) was recorded. */
export function lotCaptureRate(db: Db) {
  const r = db.get<{ total: number; captured: number }>(
    "SELECT count(*) AS total, sum(CASE WHEN d.package_id IS NOT NULL AND k.serial IS NOT NULL AND k.serial <> '' THEN 1 ELSE 0 END) AS captured FROM dispenses d LEFT JOIN packages k ON k.id = d.package_id WHERE d.state = 'sold'")!;
  return { total: r.total, captured: r.captured ?? 0, rate: r.total ? (r.captured ?? 0) / r.total : 0 };
}
