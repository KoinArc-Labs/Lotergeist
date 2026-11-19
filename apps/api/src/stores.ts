import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import type { Config } from "./config";
import { Db } from "./db";

/**
 * Two stores (FR4). Each store has its own SQLite database, so its stock, staff, patients, deliveries and
 * prescriptions cannot be read through another store's queries at all (NFR3). Store filtering lives in one place:
 * `RoutedDb` picks the database from the store the signed-in session belongs to, and every module keeps using
 * `ctx.db` as before. Background jobs run once per store through `StoreRegistry.each`.
 */

export const STORE_1 = "store-7";
export const STORE_2 = "store-2";

export class StoreRegistry {
  private als = new AsyncLocalStorage<string>();
  readonly dbs = new Map<string, Db>();
  constructor(readonly defaultId: string = STORE_1) {}
  add(id: string, db: Db) { this.dbs.set(id, db); }
  get ids() { return [...this.dbs.keys()]; }
  has(id: string) { return this.dbs.has(id); }
  /** the store the current request or job belongs to */
  get current(): string { return this.als.getStore() ?? this.defaultId; }
  db(id: string): Db { const d = this.dbs.get(id); if (!d) throw new Error(`Unknown store ${id}`); return d; }
  run<T>(id: string, fn: () => T): T { return this.als.run(id, fn); }
  /** run a callback inside the store's context, as a middleware-style hook (Fastify onRequest) */
  enter(id: string, done: () => void) { this.als.run(id, done); }
  async each<T>(fn: (id: string) => Promise<T> | T): Promise<T[]> {
    const out: T[] = [];
    for (const id of this.ids) out.push(await this.run(id, () => fn(id)));
    return out;
  }
  others(id: string) { return this.ids.filter((x) => x !== id); }
}

/** A `Db` that forwards to the current store's database. The placeholder connection it opens is never used. */
export class RoutedDb extends Db {
  constructor(private reg: StoreRegistry) { super(":memory:"); }
  private target(): Db { return this.reg.db(this.reg.current); }
  override all<T = Record<string, any>>(sql: string, ...p: unknown[]): T[] { return this.target().all<T>(sql, ...p); }
  override get<T = Record<string, any>>(sql: string, ...p: unknown[]): T | undefined { return this.target().get<T>(sql, ...p); }
  override run(sql: string, ...p: unknown[]) { return this.target().run(sql, ...p); }
  override tx<T>(fn: () => T): T { return this.target().tx(fn); }
  override clearAll() { return this.target().clearAll(); }
}

export function storeFile(cfg: Config, id: string): string {
  if (id === STORE_1) return cfg.sqlitePath;
  return cfg.sqlitePath === ":memory:" ? ":memory:" : path.join(cfg.dataDir, `chimera-rx-${id}.sqlite`);
}

export function createStores(cfg: Config, ids: string[] = [STORE_1, STORE_2]) {
  const reg = new StoreRegistry();
  for (const id of ids) reg.add(id, new Db(storeFile(cfg, id)));
  return { reg, db: new RoutedDb(reg) };
}

/** Cookie value carries the store so the right database can be chosen before the session is looked up. */
export const withStore = (storeId: string, token: string) => `${storeId}~${token}`;
export function splitStore(value: string | undefined, reg: StoreRegistry): { store: string; token: string } {
  const i = value?.indexOf("~") ?? -1;
  if (value && i > 0 && reg.has(value.slice(0, i))) return { store: value.slice(0, i), token: value.slice(i + 1) };
  return { store: reg.defaultId, token: value ?? "" };
}
