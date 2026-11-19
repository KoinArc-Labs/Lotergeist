import { audit, type Ctx } from "./core";
import { envelopeKeyId, isEnvelope } from "./crypto";
import type { Db } from "./db";
import { PROTECTED } from "./protect";

/** Key administration for the protected columns. Output is counts and key ids only: never a value, never a key. */

export interface KeyStatus {
  currentKeyId: string;
  provider: string;
  perKey: Record<string, number>;
  plaintext: number;
  unreadable: number;
  columns: number;
}

export function keyStatus(db: Db): KeyStatus {
  const perKey: Record<string, number> = {};
  let plaintext = 0, unreadable = 0, columns = 0;
  for (const [table, cols] of Object.entries(PROTECTED)) for (const col of cols) {
    columns++;
    for (const r of db.raw.prepare(`SELECT ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL AND ${col} <> ''`).all() as { v: unknown }[]) {
      if (!isEnvelope(r.v)) { plaintext++; continue; }
      const id = envelopeKeyId(r.v)!;
      perKey[id] = (perKey[id] ?? 0) + 1;
      if (!db.cipher.hasKey(id)) unreadable++;
    }
  }
  return { currentKeyId: db.cipher.currentKeyId, provider: db.keyProvider.name, perKey, plaintext, unreadable, columns };
}

/**
 * Re-encrypt every protected value under a new key. Each database is done in one transaction (all rows or none).
 * The new key is made durable before any row uses it, and becomes the current key only after every database succeeded,
 * so a crash at any point leaves every row readable.
 */
export function rotateKeys(dbs: Db[], opts: { actorName?: string } = {}): { rotated: number; fromKeyId: string; toKeyId: string; note: string } {
  const first = dbs[0];
  if (!first) throw new Error("No databases to rotate.");
  const provider = first.keyProvider;
  const cipher = first.cipher;
  const fromKeyId = cipher.currentKeyId;
  const before = provider.load();
  const ring = provider.beginRotation();
  const target = ring.current;
  cipher.setRing(ring); // reads open old and new keys; the write key is now the new one
  let rotated = 0;
  try {
  for (const db of dbs) {
    db.tx(() => {
      for (const [table, cols] of Object.entries(PROTECTED)) for (const col of cols) {
        const rows = db.raw.prepare(`SELECT rowid AS rid, ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL AND ${col} <> ''`).all() as { rid: number; v: string }[];
        const upd = db.raw.prepare(`UPDATE ${table} SET ${col} = ? WHERE rowid = ?`);
        for (const r of rows) {
          const plain = isEnvelope(r.v) ? cipher.open(r.v) : String(r.v);
          if (isEnvelope(r.v) && envelopeKeyId(r.v) === target.id) continue;
          upd.run(cipher.seal(plain, target), r.rid);
          rotated++;
        }
      }
    });
  }
  } catch (e) {
    // A database that did not finish rolled back whole; put the write key back. Rows already moved stay readable (the ring still holds both keys).
    cipher.setRing({ current: before.current, byId: new Map([...before.byId, ...ring.byId]) });
    throw e;
  }
  const note = provider.commitRotation();
  for (const db of dbs) {
    // The audit chain holds ids and counts only. It is written after the commit so the event reflects a finished rotation.
    const ctx = { db, now: Date.now } as unknown as Ctx;
    audit(ctx, null, "keys.rotate", "keys", target.id, { keyId: fromKeyId }, { keyId: target.id, provider: provider.name }, opts.actorName ? `by ${opts.actorName}` : undefined);
  }
  return { rotated, fromKeyId, toKeyId: target.id, note };
}
