import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { get, msg, post, dateLabel, type User } from "../lib/api";
import { btn, C, card, ErrorBox, Footer, MONO, Pill } from "../components/kit";
import { mainStyle, PageHeader } from "../components/Shell";

const section = card({ padding: 22, display: "flex", flexDirection: "column", gap: 14 });
const th = { padding: "10px 12px", fontWeight: 500, textAlign: "left" as const, fontSize: 12, color: C.dimmer, background: C.well };
const td = { padding: "10px 12px", fontSize: 13, borderTop: `1px solid ${C.line}`, verticalAlign: "top" as const };
const STATE_TONE: Record<string, string> = { upcoming: "cold", due: "amber", overdue: "red", ok: "green" };
const STATE_TEXT: Record<string, string> = { upcoming: "Due soon", due: "Due", overdue: "Overdue" };
const SANDBOX = "Sandbox: texts and emails go to the demo outbox only, and a voicemail is rendered but never dialled.";

interface Row {
  patientId: string; patientName: string; drug: string; lastFilledOn: string; daysSupply: number; lot: string; dueOn: string; daysUntilDue: number; state: string;
  pdcPercent: number; adherenceFlag: boolean; action: string; actionText: string; eligible: boolean; block: { recallId: string | null; lot: string } | null;
}
interface Adh { patientId: string; patientName: string; drug: string; pdcPercent: number; flagged: boolean; enoughHistory: boolean; coveredDays: number; windowDays: number }
interface Sync { patientId: string; patientName: string; pickupOn: string; note: string; items: { drug: string; dueOn: string; fillDays: number; kind: string }[] }
interface Draft { id: number; patientId: string; channel: string; subject: string | null; text: string; label: string }
interface Report {
  today: string; graceDays: number; lookaheadDays: number; flagBelow: number; worklist: Row[]; adherence: Adh[]; sync: Sync[]; drafts: Draft[]; canSend: boolean;
  counts: { due: number; blocked: number; needsNewRx: number; lowAdherence: number; offer: number };
}

/** Refills: who is due, how well they take their medicine, one-trip sync, and recall-aware blocks. */
export function Refills({ user }: { user: User }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["refills"], queryFn: () => get<Report>("/api/refills"), enabled: user.role === "pharmacist" || user.role === "technician" });
  const [err, setErr] = useState("");
  const [attest, setAttest] = useState(false);
  const [result, setResult] = useState<{ sent: number; voicemailRendered: number; skipped: { patientId: string; channel: string; why: string }[] } | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["refills"] });
  const draft = useMutation({ mutationFn: () => post("/api/refills/draft", {}), onSuccess: () => { setErr(""); setResult(null); setAttest(false); refresh(); }, onError: (e) => setErr(msg(e)) });
  const send = useMutation({ mutationFn: () => post("/api/refills/send", { attest }), onSuccess: (r) => { setErr(""); setResult(r); setAttest(false); refresh(); }, onError: (e) => setErr(msg(e)) });
  const r = q.data;
  const blocked = (r?.worklist ?? []).filter((w) => w.action === "blocked_recall");

  return (
    <>
      <PageHeader title="Refills" sub="Who is due, how well they stay on their medicine, and which refills a recall has put on hold." />
      <main style={mainStyle()}>
        <div role="note" style={{ padding: "12px 16px", borderRadius: 10, background: "var(--accent-soft)", fontSize: 14, lineHeight: 1.5 }}>
          <strong>The refill list knows the lot.</strong> Most refill tools see only the drug and the date. Chimera Rx scanned the lot at fill, so a refill is held back when the patient's last fill came from a recalled lot, and it stays held after the recall closes. {SANDBOX}
        </div>
        {user.role !== "pharmacist" && user.role !== "technician"
          ? <p style={{ color: C.dim }}>A {user.role} does not use the refill list. Sign in as a technician or pharmacist.</p>
          : !r ? <p style={{ color: C.dim }}>{q.isError ? msg(q.error) : "Loading the refill list…"}</p> : <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
              {([["Due or overdue", r.counts.due, "violet"], ["Can be offered", r.counts.offer, "green"], ["Blocked by a recall", r.counts.blocked, "red"], ["Need a new prescription", r.counts.needsNewRx, "amber"], ["Low adherence", r.counts.lowAdherence, "amber"]] as const).map(([l, n, tone]) => (
                <div key={l} style={card({ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6 })}>
                  <span style={{ fontSize: 13, color: C.dim }}>{l}</span>
                  <span style={{ fontSize: 30, fontWeight: 600 }}>{n}</span>
                  <Pill tone={tone}>{tone === "red" ? "recall" : tone === "green" ? "ready" : "review"}</Pill>
                </div>
              ))}
            </div>

            {blocked.length > 0 && (
              <div role="alert" style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--danger)", background: C.dangerSoft, color: C.red3, fontSize: 14, lineHeight: 1.5 }}>
                <strong>{blocked.length} refill{blocked.length === 1 ? " is" : "s are"} on hold because of a recall.</strong> No refill is offered for the recalled lot. <Link to="/recalls" style={{ color: C.red3, fontWeight: 600 }}>Open Recalls</Link> to replace the medicine from a clean lot.
              </div>
            )}

            <section aria-labelledby="wl" style={section}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <h2 id="wl" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Refill worklist</h2>
                <span style={{ fontSize: 12, color: C.dimmer }}>As of {dateLabel(r.today)} · grace {r.graceDays} days · looking ahead {r.lookaheadDays} days</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}>
                  <thead><tr>{["Patient", "Medicine", "Last fill", "Runs out", "Status", "What to do"].map((h) => <th key={h} scope="col" style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {r.worklist.length === 0 && <tr><td colSpan={6} style={{ ...td, color: C.dim }}>Nothing is due.</td></tr>}
                    {r.worklist.map((w) => {
                      const red = w.action === "blocked_recall";
                      return (
                        <tr key={`${w.patientId}-${w.drug}`} style={red ? { background: C.dangerSoft, color: C.red3 } : undefined}>
                          <td style={td}><div style={{ fontWeight: 500 }}>{w.patientName}</div><div style={{ fontFamily: MONO, fontSize: 12, color: red ? C.red3 : C.dimmer }}>{w.patientId}</div></td>
                          <td style={td}>{w.drug}{w.lot && <div style={{ fontFamily: MONO, fontSize: 12, color: red ? C.red3 : C.dimmer }}>lot {w.lot}</div>}</td>
                          <td style={td}>{dateLabel(w.lastFilledOn)}<div style={{ fontSize: 12, color: red ? C.red3 : C.dimmer }}>{w.daysSupply}-day supply</div></td>
                          <td style={td}>{dateLabel(w.dueOn)}<div style={{ fontSize: 12, color: red ? C.red3 : C.dimmer }}>{w.daysUntilDue < 0 ? `${-w.daysUntilDue} days ago` : w.daysUntilDue === 0 ? "today" : `in ${w.daysUntilDue} days`}</div></td>
                          <td style={td}>{red ? <Pill tone="red">Recall hold</Pill> : <Pill tone={STATE_TONE[w.state] ?? "gray"}>{STATE_TEXT[w.state] ?? w.state}</Pill>}{w.adherenceFlag && <div style={{ marginTop: 4 }}><Pill tone="amber">Low adherence {w.pdcPercent}%</Pill></div>}</td>
                          <td style={td}>{w.actionText}{w.block?.recallId && <> <Link to="/recalls" style={{ color: C.red3, fontWeight: 600 }}>Recall {w.block.recallId}</Link></>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="ad" style={section}>
              <h2 id="ad" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Adherence (PDC, last {180} days)</h2>
              <p style={{ margin: 0, fontSize: 13, color: C.dim, lineHeight: 1.5 }}>Proportion of days covered: days with medicine in hand divided by days in the window, from the first fill. The line marks {Math.round(r.flagBelow * 100)}%; below it is flagged.</p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {r.adherence.map((a) => (
                  <li key={`${a.patientId}-${a.drug}`} style={{ display: "grid", gridTemplateColumns: "minmax(170px, 260px) 1fr 90px", gap: 12, alignItems: "center", fontSize: 13 }}>
                    <span><span style={{ fontWeight: 500 }}>{a.patientName}</span> <span style={{ color: C.dimmer }}>· {a.drug}</span></span>
                    <span role="img" aria-label={`${a.drug} for ${a.patientName}: ${a.pdcPercent} percent of days covered`} style={{ position: "relative", height: 12, borderRadius: 999, background: C.track, overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${Math.min(100, a.pdcPercent)}%`, background: !a.enoughHistory ? C.dimmer : a.flagged ? C.red : C.green }} />
                      <span style={{ position: "absolute", left: `${r.flagBelow * 100}%`, top: 0, bottom: 0, width: 2, background: C.ink }} />
                    </span>
                    <span style={{ textAlign: "right", color: a.flagged ? C.red3 : C.dim }}>{a.enoughHistory ? `${a.pdcPercent}%` : "one fill"}</span>
                  </li>
                ))}
                {r.adherence.length === 0 && <li style={{ color: C.dim }}>No fills with a days supply on record.</li>}
              </ul>
            </section>

            <section aria-labelledby="sy" style={section}>
              <h2 id="sy" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Medication sync: one trip a month</h2>
              {r.sync.length === 0 && <p style={{ margin: 0, color: C.dim, fontSize: 14 }}>No patient has two or more offered refills to line up.</p>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
                {r.sync.map((s) => (
                  <div key={s.patientId} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontWeight: 600 }}>{s.patientName} <span style={{ fontFamily: MONO, fontSize: 12, color: C.dimmer }}>{s.patientId}</span></div>
                    <div style={{ fontSize: 13, color: C.dim }}>Pickup day {dateLabel(s.pickupOn)}</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>{s.items.map((i) => <li key={i.drug}>{i.drug}: {i.kind === "short" ? `${i.fillDays}-day short fill (runs out ${dateLabel(i.dueOn)})` : `full ${i.fillDays}-day fill`}</li>)}</ul>
                    <p style={{ margin: 0, fontSize: 12, color: C.dimmer, lineHeight: 1.5 }}>{s.note}</p>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="dr" style={section}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <h2 id="dr" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Reminders</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: C.dim }}>Rules pick who. The AI only words the message. A pharmacist approves before anything goes out. AI draft, a pharmacist approves.</p>
                </div>
                <button onClick={() => draft.mutate()} disabled={draft.isPending} style={btn("primary")}>{draft.isPending ? "Drafting…" : "Draft reminders"}</button>
              </div>
              <ErrorBox e={err} />
              {r.drafts.length === 0 && <p style={{ margin: 0, color: C.dim, fontSize: 14 }}>No drafts yet. Recalled-lot and Schedule II rows never get one.</p>}
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {r.drafts.map((d) => (
                  <li key={d.id} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: C.dimmer }}><Pill tone="violet">{d.channel === "sms" ? "Text" : d.channel === "email" ? "Email" : "Voicemail (not dialled)"}</Pill><span style={{ fontFamily: MONO }}>{d.patientId}</span><span>AI draft, a pharmacist approves</span></div>
                    {d.subject && <div style={{ fontWeight: 500, fontSize: 14 }}>{d.subject}</div>}
                    <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{d.text}</div>
                  </li>
                ))}
              </ul>
              {r.drafts.length > 0 && (r.canSend ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ flex: "1 1 420px", display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: C.violet, flexShrink: 0 }} />
                    I am the pharmacist on duty. I reviewed these reminders. Consent is checked again as each one is sent.
                  </label>
                  <button onClick={() => attest && send.mutate()} aria-disabled={!attest} disabled={send.isPending} style={{ minHeight: 50, padding: "0 24px", borderRadius: 10, border: 0, fontWeight: 600, fontSize: 15, ...(attest ? { background: C.violet, color: C.onAccent } : { background: C.line2, color: C.dimmer, cursor: "not-allowed" }) }}>{send.isPending ? "Sending…" : `Approve and send ${r.drafts.length}`}</button>
                </div>
              ) : <p style={{ margin: 0, fontSize: 13, color: C.dim }}>A pharmacist reviews and sends these. Ask the pharmacist on duty.</p>)}
              {result && (
                <div role="status" style={{ padding: "12px 14px", borderRadius: 10, background: C.okSoft, fontSize: 14, lineHeight: 1.5 }}>
                  Sent {result.sent} to the demo outbox{result.voicemailRendered ? `, ${result.voicemailRendered} voicemail script${result.voicemailRendered === 1 ? "" : "s"} rendered (not dialled)` : ""}.
                  {result.skipped.length > 0 && <> Skipped {result.skipped.length}: {result.skipped.map((s) => `${s.patientId} (${s.why})`).join("; ")}</>} <Link to="/outbox">Open the outbox</Link>.
                </div>
              )}
            </section>
          </>}
        <Footer />
      </main>
    </>
  );
}
