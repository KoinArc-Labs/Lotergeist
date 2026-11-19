import crypto from "node:crypto";
import { HttpError, type Ctx } from "./core";
import { newToken } from "./domain";

/**
 * Second sign-in factor (FR7, US6.1). After a correct password the user needs a 6-digit code. The code goes to the
 * sandbox outbox only: nothing is sent to a real address (pharmacy-safety.md rule 2). Codes last 5 minutes, work once,
 * and five wrong codes lock the account for 15 minutes, as wrong passwords already do.
 */

export const CODE_TTL_MS = 5 * 60_000;
const MAX_TRIES = 5;
const LOCK_MS = 15 * 60_000;

const hash = (challenge: string, code: string) => crypto.createHash("sha256").update(`${challenge}:${code}`).digest("hex");

export function startChallenge(ctx: Ctx, user: { id: string; email: string; name: string }) {
  const challenge = newToken();
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const now = ctx.now();
  ctx.db.run("DELETE FROM mfa_codes WHERE user_id = ?", user.id);
  ctx.db.run("INSERT INTO mfa_codes (challenge, user_id, code_hash, expires, used, tries) VALUES (?,?,?,?,0,0)", challenge, user.id, hash(challenge, code), now + CODE_TTL_MS);
  ctx.db.run("INSERT INTO outbox (channel, to_addr, subject, body, status, created_at, delivered_at, notification_id, provider) VALUES (?,?,?,?,?,?,?,?,?)",
    "email", user.email, "Your Chimera Rx sign-in code", `Your sign-in code is ${code}. It works once and expires in 5 minutes. (Sandbox message: demo environment, nothing was sent.)`, "delivered", now, now, null, "sandbox");
  return { challenge, expiresAt: now + CODE_TTL_MS };
}

/** Returns the user id when the code is right. Throws on a wrong, used or expired code, and locks after five wrong tries. */
export function checkCode(ctx: Ctx, challenge: string, code: string): string {
  const row = ctx.db.get<any>("SELECT * FROM mfa_codes WHERE challenge = ?", challenge);
  const bad = new HttpError(401, "That code is not right or has expired. Sign in again to get a new one.", "bad_code");
  if (!row || row.used) throw bad;
  const now = ctx.now();
  const user = ctx.db.get<any>("SELECT locked_until FROM users WHERE id = ?", row.user_id);
  if (user && user.locked_until > now) throw new HttpError(423, "Too many wrong codes. This account is locked for 15 minutes.", "locked");
  if (row.expires < now) throw bad;
  const ok = hash(challenge, code.trim()) === row.code_hash;
  if (!ok) {
    const tries = row.tries + 1;
    if (tries >= MAX_TRIES) {
      ctx.db.run("UPDATE users SET locked_until = ? WHERE id = ?", now + LOCK_MS, row.user_id);
      ctx.db.run("DELETE FROM mfa_codes WHERE challenge = ?", challenge);
      throw new HttpError(423, "Too many wrong codes. This account is locked for 15 minutes.", "locked");
    }
    ctx.db.run("UPDATE mfa_codes SET tries = ? WHERE challenge = ?", tries, challenge);
    throw new HttpError(401, `That code is not right. ${MAX_TRIES - tries} attempt${MAX_TRIES - tries === 1 ? "" : "s"} left.`, "bad_code");
  }
  ctx.db.run("UPDATE mfa_codes SET used = 1 WHERE challenge = ?", challenge);
  return row.user_id as string;
}

/** Demo only (FR7.3): the sign-in page shows the code from the sandbox outbox so a judge can read it without a session. */
export function demoCodeHint(ctx: Ctx, challenge: string): string | null {
  const row = ctx.db.get<{ user_id: string }>("SELECT user_id FROM mfa_codes WHERE challenge = ? AND used = 0", challenge);
  if (!row) return null;
  const u = ctx.db.get<{ email: string }>("SELECT email FROM users WHERE id = ?", row.user_id);
  const m = ctx.db.get<{ body: string }>("SELECT body FROM outbox WHERE to_addr = ? AND subject = 'Your Chimera Rx sign-in code' ORDER BY id DESC LIMIT 1", u?.email ?? "");
  return /\b(\d{6})\b/.exec(m?.body ?? "")?.[1] ?? null;
}
