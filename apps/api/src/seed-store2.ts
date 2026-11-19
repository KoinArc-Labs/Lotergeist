import type { Db } from "./db";
import { DAY, gtinOf, hashPassword, ndc11Digits, suggestLocation } from "./domain";
import { DEMO_PASSWORD, PRODUCTS, SEED_VERSION } from "./seed";
import { STORE_2 } from "./stores";

/**
 * Second store (FR4.1): Birch Avenue Pharmacy · Store 2. Its own stock, staff, patients and fills, all invented
 * (example.com addresses, 555-01xx numbers). It stocks some of the same lots as Store 1 so that a recall confirmed in
 * one store visibly blocks the other, while each store lists only its own units and patients (FR4.4).
 */

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const NAMES = ["Rowan Hale", "Isla Brandt", "Theo Marsh", "Nia Calder", "Ezra Pike", "Mara Ellery", "Odin Shaw", "Luz Vance", "Kit Orme", "Zara Nye", "Remy Holt", "Tove Jessop"];

export function seedStore2(db: Db, now = Date.now()) {
  if (db.get("SELECT 1 FROM meta WHERE key = 'seeded'")) return false;
  const at = (daysAgo: number, h = 12) => now - daysAgo * DAY + (h - 12) * 3_600_000;
  db.tx(() => {
    db.run("INSERT INTO stores VALUES (?,?,?,?,?)", STORE_2, "Birch Avenue Pharmacy · Store 2", "0000002", "2 Birch Avenue (synthetic)", "(555) 010-2300");
    const users: [string, string, string, string, string, string, string, string][] = [
      ["u-okoro", "S. Okoro, PharmD", "s.okoro@birchavenuerx.example", "pharmacist", "SO", "Pharmacist in charge", "#2A2350", "Sam"],
      ["u-lund", "T. Lund, CPhT", "t.lund@birchavenuerx.example", "technician", "TL", "Technician", "#1F3A35", "Tess"],
      ["u-reyes", "C. Reyes", "c.reyes@birchavenuerx.example", "cashier", "CR", "Cashier · POS 1", "#3A2A1F", "Cam"]
    ];
    for (const u of users) db.run("INSERT INTO users (id, store_id, name, email, role, pw_hash, initials, title, tint, first_name) VALUES (?,?,?,?,?,?,?,?,?,?)", u[0], STORE_2, u[1], u[2], u[3], hashPassword(DEMO_PASSWORD), u[4], u[5], u[6], u[7]);
    for (const p of PRODUCTS) {
      db.run("INSERT INTO products (ndc11, ndc10, gtin, name, strength, form, pack_size, storage, maker, source, reorder_point) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ndc11Digits(p.ndc10), p.ndc10, gtinOf(p.ndc10), p.name, p.strength, p.form, p.pack, p.storage, p.maker, p.source, p.reorder);
    }
    NAMES.forEach((n, i) => {
      const id = `S-${pad(2001 + i, 4)}`;
      const sms = i % 3 !== 2 ? 1 : 0, email = i % 2 === 0 ? 1 : 0;
      db.run("INSERT INTO patients (id, name, dob, phone, email, preferred, sms_consent, email_consent, allergies) VALUES (?,?,?,?,?,?,?,?,?)",
        id, n, `19${pad(55 + i, 2)}-${pad(1 + i, 2)}-${pad(3 + i, 2)}`, `(555) 010-02${pad(i, 2)}`, email ? `${id.toLowerCase()}@example.com` : "", sms ? "sms" : email ? "email" : "phone", sms, email, "");
    });

    const lot = (ndc10: string, lotNo: string, expiry: string, n: number, sold: { patient: string; rx: string }[]) => {
      const ndc11 = ndc11Digits(ndc10);
      const loc = suggestLocation({ ndc11, name: ndc10, storage: PRODUCTS.find((p) => p.ndc10 === ndc10)!.storage });
      const lotId = Number(db.run("INSERT INTO lots (ndc11, lot, expiry, status) VALUES (?,?,?, 'active')", ndc11, lotNo, expiry).lastInsertRowid);
      const ids: number[] = [];
      for (let k = 0; k < n; k++) {
        ids.push(Number(db.run("INSERT INTO packages (serial, lot_id, gtin, expiry, location, zone, status, delivery_id, received_at, received_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
          `B2${lotNo.replace(/\W/g, "")}${pad(k + 1, 4)}`, lotId, gtinOf(ndc10), expiry, loc.location, loc.zone, "on_shelf", null, at(40), "T. Lund, CPhT").lastInsertRowid));
      }
      db.run("INSERT INTO lot_events (at, kind, lot_id, package_id, user_name, note) VALUES (?,?,?,?,?,?)", at(40), "Received", lotId, null, "T. Lund, CPhT", `${n} units`);
      sold.forEach((s, k) => {
        const rxId = Number(db.run("INSERT INTO prescriptions (rx, patient_id, ndc11, drug, qty, directions, prescriber, refills, status, due) VALUES (?,?,?,?,?,?,?,?,?,?)",
          s.rx, s.patient, ndc11, PRODUCTS.find((p) => p.ndc10 === ndc10)!.name, 1, "Use as directed", "Dr. M. Okafor", 1, "sold", new Date(at(20 - k)).toISOString().slice(0, 10)).lastInsertRowid);
        db.run("UPDATE packages SET status = 'dispensed' WHERE id = ?", ids[k]);
        db.run("INSERT INTO dispenses (rx_id, package_id, state, filled_by, filled_at, verified_by, verified_at, sold_at, register, id_checked, counseled, signature, contact_json, label_printed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          rxId, ids[k], "sold", "T. Lund, CPhT", at(20 - k), "S. Okoro, PharmD", at(20 - k) + 600_000, at(20 - k) + 1_800_000, "POS 1", 1, 1, 1, "{}", 1);
        db.run("INSERT INTO lot_events (at, kind, lot_id, package_id, user_name, note) VALUES (?,?,?,?,?,?)", at(20 - k) + 1_800_000, "Sold", lotId, ids[k], "C. Reyes", `Rx ${s.rx}`);
      });
    };
    // Same lots as Store 1 on purpose: recall D-0603-2026 / D-0611-2026 (insulin GX4471C) and D-0417-2026 (PRORX050925-1).
    lot("70004-623-15", "GX4471C", "2027-08-31", 14, [{ patient: "S-2001", rx: "B200001" }, { patient: "S-2004", rx: "B200002" }, { patient: "S-2006", rx: "B200003" }, { patient: "S-2009", rx: "B200004" }]);
    lot("70004-417-05", "PRORX050925-1", "2027-09-30", 18, [{ patient: "S-2002", rx: "B200011" }, { patient: "S-2005", rx: "B200012" }, { patient: "S-2010", rx: "B200013" }]);
    lot("70004-226-01", "AMX0626C", "2028-01-31", 12, [{ patient: "S-2003", rx: "B200021" }]);
    lot("70004-803-90", "AT24K118", "2027-12-31", 9, [{ patient: "S-2007", rx: "B200031" }, { patient: "S-2008", rx: "B200032" }]);
    lot("70004-145-90", "AM9921F", "2028-02-29", 10, []);

    db.run("INSERT INTO meta (key, value) VALUES ('seeded', ?)", String(now));
    db.run("INSERT INTO meta (key, value) VALUES ('seed_version', ?)", SEED_VERSION);
  });
  return true;
}
