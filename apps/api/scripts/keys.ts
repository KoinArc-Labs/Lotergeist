import { loadConfig } from "../src/config";
import { keyStatus, rotateKeys } from "../src/keyadmin";
import { createStores } from "../src/stores";

// pnpm --filter @chimera-rx/api keys:status | keys:rotate. Prints counts and key ids only, never values or keys.
process.env.ALLOW_UNREADABLE_KEYS = process.argv[2] === "status" ? "1" : process.env.ALLOW_UNREADABLE_KEYS;
const cmd = process.argv[2];
const cfg = loadConfig();
const { reg } = createStores(cfg);
const dbs = reg.ids.map((id) => ({ id, db: reg.db(id) }));

if (cmd === "status") {
  for (const { id, db } of dbs) {
    const s = keyStatus(db);
    console.log(`${id}: provider=${s.provider} current=${s.currentKeyId} protected-columns=${s.columns}`);
    for (const [k, n] of Object.entries(s.perKey)) console.log(`  key ${k}${k === s.currentKeyId ? " (current)" : ""}: ${n} values`);
    console.log(`  plaintext values: ${s.plaintext}, unreadable values: ${s.unreadable}`);
  }
} else if (cmd === "rotate") {
  const r = rotateKeys(dbs.map((d) => d.db), { actorName: "keys:rotate CLI" });
  console.log(`Rotated ${r.rotated} values from key ${r.fromKeyId} to key ${r.toKeyId}.`);
  console.log(r.note);
} else {
  console.error("Usage: keys.ts status | rotate");
  process.exit(2);
}
