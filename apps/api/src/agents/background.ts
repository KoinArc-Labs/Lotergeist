import { audit, HttpError, todayIso, type Actor, type Ctx } from "../core";
import { getAgent, runAgent } from "./agent";
import { changedOrders, GUARDIAN_ID } from "./guardian";

/**
 * Background mode. A pharmacist or admin switches an agent on; a scheduler (the existing minute tick in server.ts) runs each enabled agent on
 * its trigger. A run never blocks a request: the tick is started with `void` and every error is caught here, so one failing agent or model
 * provider can never stop the loop. A provider failure leaves "rules only" output (agent.ts). AGENTS_BACKGROUND=0 turns the scheduler off.
 *
 *   rx-guardian      every new or changed order (checked each tick), and at least every 5 minutes
 *   night-watch      daily
 *   stock-advisor    daily
 *   refill-outreach  daily (drafts only; nothing is ever sent by an agent)
 */

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export interface BackgroundDef { id: string; trigger: string; intervalMs: number; event: boolean }
export const BACKGROUND: BackgroundDef[] = [
  { id: GUARDIAN_ID, trigger: "On every new or changed order, and every 5 minutes", intervalMs: 5 * MIN, event: true },
  { id: "night-watch", trigger: "Daily", intervalMs: DAY, event: false },
  { id: "stock-advisor", trigger: "Daily", intervalMs: DAY, event: false },
  { id: "refill-outreach", trigger: "Daily", intervalMs: DAY, event: false }
];
export const backgroundDef = (id: string) => BACKGROUND.find((b) => b.id === id);

/** The kill switch. Read at call time so a test or an operator can flip it without a restart. */
export const backgroundAllowed = () => process.env.AGENTS_BACKGROUND !== "0";

interface Row { agent: string; enabled: number; enabled_by: string | null; enabled_at: number | null; last_run_at: number | null; next_run_at: number | null; last_status: string | null; last_mode: string | null; last_error: string | null; runs_day: string | null; runs_today: number }

export function ensureSettings(ctx: Ctx) {
  for (const b of BACKGROUND) ctx.db.run("INSERT OR IGNORE INTO agent_settings (agent, enabled, runs_today) VALUES (?, 0, 0)", b.id);
}

export interface AgentBackgroundStatus {
  id: string; trigger: string; enabled: boolean; enabledBy: string | null; lastRunAt: number | null; nextRunAt: number | null; runsToday: number;
  lastStatus: "ok" | "error" | null; lastMode: "ai" | "rules only" | null; lastError: string | null; running: boolean;
}

const inflight = new Set<string>();
const keyOf = (ctx: Ctx, id: string) => `${ctx.stores?.current ?? "single"}:${id}`;

export function backgroundStatus(ctx: Ctx): AgentBackgroundStatus[] {
  ensureSettings(ctx);
  const day = todayIso(ctx);
  const rows = ctx.db.all<Row>("SELECT * FROM agent_settings");
  return BACKGROUND.map((b) => {
    const r = rows.find((x) => x.agent === b.id)!;
    return {
      id: b.id, trigger: b.trigger, enabled: !!r.enabled, enabledBy: r.enabled_by, lastRunAt: r.last_run_at, nextRunAt: r.enabled && backgroundAllowed() ? r.next_run_at : null,
      runsToday: r.runs_day === day ? r.runs_today : 0, lastStatus: (r.last_status as "ok" | "error" | null) ?? null, lastMode: (r.last_mode as "ai" | "rules only" | null) ?? null,
      lastError: r.last_error, running: inflight.has(keyOf(ctx, b.id))
    };
  });
}

export const agentsOn = (ctx: Ctx) => backgroundStatus(ctx).filter((s) => s.enabled).length;

function need(id: string) {
  const def = backgroundDef(id);
  if (!def || !getAgent(id)) throw new HttpError(422, "That agent has no background mode.", "not_background");
  return def;
}

export function setEnabled(ctx: Ctx, actor: Actor, id: string, on: boolean) {
  if (actor.role !== "pharmacist" && actor.role !== "admin") throw new HttpError(403, `A ${actor.role} cannot do that.`, "forbidden");
  need(id);
  ensureSettings(ctx);
  const was = !!ctx.db.get<Row>("SELECT * FROM agent_settings WHERE agent = ?", id)?.enabled;
  // Switching on schedules the first run for the next tick, so the pharmacist sees it work within a minute.
  ctx.db.run("UPDATE agent_settings SET enabled = ?, enabled_by = ?, enabled_at = ?, next_run_at = ? WHERE agent = ?", on ? 1 : 0, actor.name, ctx.now(), on ? ctx.now() : null, id);
  audit(ctx, actor, on ? "agent.enable" : "agent.disable", "agent", id, { enabled: was }, { enabled: on });
  return backgroundStatus(ctx).find((s) => s.id === id)!;
}

function record(ctx: Ctx, id: string, result: { ok: boolean; mode?: string; error?: string | null }) {
  const def = backgroundDef(id)!;
  const day = todayIso(ctx);
  const cur = ctx.db.get<Row>("SELECT * FROM agent_settings WHERE agent = ?", id);
  const runs = (cur?.runs_day === day ? cur.runs_today : 0) + 1;
  const now = ctx.now();
  ctx.db.run("UPDATE agent_settings SET last_run_at = ?, next_run_at = ?, last_status = ?, last_mode = ?, last_error = ?, runs_day = ?, runs_today = ? WHERE agent = ?",
    now, cur?.enabled ? now + def.intervalMs : null, result.ok ? "ok" : "error", result.mode ?? null, result.error ?? null, day, runs, id);
}

/** One run of one agent. Never throws. Returns false when the run was skipped because the same agent is still running. */
async function runOnce(ctx: Ctx, actor: Actor | null, id: string): Promise<boolean> {
  const k = keyOf(ctx, id);
  if (inflight.has(k)) return false;
  inflight.add(k);
  try {
    const r = await runAgent(ctx, actor, id, {});
    record(ctx, id, { ok: true, mode: r.mode, error: r.error });
  } catch (e) {
    record(ctx, id, { ok: false, error: String((e as Error).message ?? e).slice(0, 200) });
  } finally {
    inflight.delete(k);
  }
  return true;
}

/** "Run now": a pharmacist starts one background agent at once. It does not need the agent to be switched on. */
export async function runNow(ctx: Ctx, actor: Actor, id: string) {
  if (actor.role !== "pharmacist") throw new HttpError(403, `A ${actor.role} cannot do that.`, "forbidden");
  need(id);
  ensureSettings(ctx);
  audit(ctx, actor, "agent.run_now", "agent", id);
  const ran = await runOnce(ctx, actor, id);
  if (!ran) throw new HttpError(409, "That agent is already running. Try again in a moment.", "running");
  return backgroundStatus(ctx).find((s) => s.id === id)!;
}

/** The scheduler tick (once a minute). Runs every enabled agent that is due. Safe to call at any time; it never throws. */
export async function backgroundTick(ctx: Ctx): Promise<string[]> {
  const ran: string[] = [];
  if (!backgroundAllowed()) return ran;
  try {
    ensureSettings(ctx);
    const now = ctx.now();
    for (const r of ctx.db.all<Row>("SELECT * FROM agent_settings WHERE enabled = 1")) {
      const def = backgroundDef(r.agent);
      if (!def) continue;
      let due = (r.next_run_at ?? 0) <= now;
      try { if (!due && def.event && changedOrders(ctx).length > 0) due = true; } catch { /* a bad read must not stop the loop */ }
      if (!due) continue;
      if (await runOnce(ctx, null, def.id)) ran.push(def.id);
    }
  } catch { /* the loop never crashes */ }
  return ran;
}
