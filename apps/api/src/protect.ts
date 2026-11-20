/**
 * The protected columns (SEC-1): patient identity, contact details, clinical free text and anything that quotes them.
 * `Db` encrypts these on write and decrypts every row it returns, so routes and screens never see ciphertext.
 * Patient ids (S-0417), rx numbers, lot numbers, dates of service and flags stay clear: they are the keys the
 * pharmacy works by and the only identifiers the audit log is allowed to hold. Message subjects (outbox.subject,
 * notifications.subject) stay clear: they are fixed templates and existing flows filter on them; see docs/SECURITY.md.
 */
export const PROTECTED: Record<string, readonly string[]> = {
  patients: ["name", "dob", "phone", "email", "allergies", "conditions"],
  med_history: ["sig"],
  prescriptions: ["directions", "review_note"],
  dispenses: ["contact_json"],
  notifications: ["merged_text"],
  outbox: ["to_addr", "body"],
  prescriber_messages: ["body", "response_json"],
  outreach_calls: ["script", "note"],
  audio: ["text"],
  rx_findings: ["title", "body", "evidence"],
  audit: ["reason"],
  // REV-API: agent records quote the patients and drugs they were given; refill and recall drafts name the patient.
  ai_runs: ["input", "rule_output", "raw_output", "gated_output", "dropped"],
  ai_drafts: ["subject", "body"],
  suspect_cases: ["note", "close_note"],
  // Rx Guardian: a suggestion quotes the patient's history (drugs, dates, lots) and a pharmacist's free-text reason.
  suggestions: ["title", "evidence", "explanation", "decision_reason"]
};

/** Split on commas that are not inside quotes or parentheses. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = "", cur = "";
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote) quote = ""; continue; }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Count `?` placeholders that are outside quotes. */
function placeholders(s: string): number {
  let n = 0, quote = "";
  for (const ch of s) {
    if (quote) { if (ch === quote) quote = ""; continue; }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "?") n++;
  }
  return n;
}

const INSERT_RE = /^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)\s*;?\s*$/id;
const UPDATE_RE = /^\s*UPDATE\s+(?:OR\s+\w+\s+)?(\w+)\s+SET\s+([\s\S]*?)(?:\s+WHERE\s+[\s\S]*)?;?\s*$/id;
const TABLE_RE = /^\s*(?:INSERT\s+(?:OR\s+\w+\s+)?INTO\s+|UPDATE\s+(?:OR\s+\w+\s+)?|REPLACE\s+INTO\s+)(\w+)/i;
const STRING_LITERAL = /^'((?:[^']|'')*)'$/;

export interface Rewrite { sql: string; idx: number[] }

/**
 * For an INSERT or UPDATE on a protected table, find where the protected values go: the bound parameters (`idx`) are
 * sealed by the caller, and a plain string literal is sealed here and written back into the SQL text. Fails closed:
 * any other shape for a protected column (an expression, INSERT ... SELECT) throws, so plaintext cannot slip in.
 */
export function rewriteProtected(sql: string, seal: (plain: string) => string): Rewrite {
  const t = TABLE_RE.exec(sql)?.[1]?.toLowerCase();
  const prot = t ? PROTECTED[t] : undefined;
  if (!t || !prot) return { sql, idx: [] };
  const fix = (col: string, expr: string): string => {
    if (expr === "?") return expr;
    if (/^null$/i.test(expr)) return expr;
    const lit = STRING_LITERAL.exec(expr);
    if (!lit) throw new Error(`Protected column ${t}.${col} must be written through a bound parameter or a string literal.`);
    const plain = lit[1]!.replace(/''/g, "'");
    return plain === "" ? expr : `'${seal(plain)}'`;
  };
  const idx: number[] = [];
  const ins = INSERT_RE.exec(sql);
  if (ins) {
    const cols = ins[2]!.split(",").map((c) => c.trim().toLowerCase());
    const vals = splitTop(ins[3]!);
    if (cols.length !== vals.length) throw new Error(`Cannot map columns for protected table ${t}.`);
    let n = 0;
    const out = cols.map((c, i) => {
      const v = vals[i]!;
      if (prot.includes(c)) { v === "?" && idx.push(n); n += placeholders(v); return fix(c, v); }
      n += placeholders(v);
      return v;
    });
    const [start, end] = ins.indices![3]!;
    return { sql: sql.slice(0, start) + out.join(", ") + sql.slice(end), idx };
  }
  if (/^\s*INSERT/i.test(sql) || /^\s*REPLACE/i.test(sql)) throw new Error(`Unsupported write shape for protected table ${t}.`);
  const upd = UPDATE_RE.exec(sql);
  if (!upd) throw new Error(`Unsupported write shape for protected table ${t}.`);
  let n = 0;
  const out = splitTop(upd[2]!).map((a) => {
    const m = /^(\w+)\s*=\s*([\s\S]+)$/.exec(a);
    if (!m) throw new Error(`Cannot parse SET clause for protected table ${t}.`);
    const col = m[1]!.toLowerCase(), expr = m[2]!.trim();
    if (!prot.includes(col)) { n += placeholders(expr); return a; }
    if (expr === "?") idx.push(n);
    n += placeholders(expr);
    return `${m[1]} = ${fix(col, expr)}`;
  });
  const [start, end] = upd.indices![2]!;
  return { sql: sql.slice(0, start) + out.join(", ") + sql.slice(end), idx };
}
