import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { get, msg, post, type User } from "../lib/api";
import { C } from "./kit";

interface Scenario { id: string; title: string; brief: string; start: string }

/** Scenario library (FR6, US1.1): a pharmacist resets the demo into a known story; everyone sees the active brief. */
export function Scenarios({ user }: { user: User }) {
  const q = useQuery({ queryKey: ["scenarios"], queryFn: () => get<{ active: string | null; scenarios: Scenario[] }>("/api/demo/scenarios") });
  const [err, setErr] = useState("");
  const start = useMutation({
    mutationFn: (id: string) => post<{ scenario: Scenario }>(`/api/demo/scenarios/${id}`),
    onSuccess: (r) => { window.location.hash = `#${r.scenario.start}`; window.location.reload(); },
    onError: (e) => setErr(msg(e))
  });
  const reset = useMutation({ mutationFn: () => post("/api/demo/reset"), onSuccess: () => window.location.reload(), onError: (e) => setErr(msg(e)) });
  const canPick = user.role === "pharmacist";
  const active = q.data?.scenarios.find((s) => s.id === q.data?.active);
  if (!q.data) return null;
  if (!canPick && !active) return null;
  return (
    <section aria-labelledby="scn" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 id="scn" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Demo scenarios</h2>
        {canPick && (
          <button onClick={() => reset.mutate()} disabled={reset.isPending || start.isPending}
            style={{ minHeight: 44, padding: "0 16px", borderRadius: 10, border: `1px solid ${C.line2}`, background: "transparent", color: C.ink, font: "inherit", fontSize: 14 }}>
            {reset.isPending ? "Resetting…" : "Reset demo"}
          </button>
        )}
      </div>
      {active && (
        <div role="status" style={{ padding: "14px 16px", borderRadius: 10, background: "var(--accent-soft)", color: C.ink, fontSize: 14, lineHeight: 1.5 }}>
          <strong>Now running: {active.title}.</strong> {active.brief} <a href={`#${active.start}`} style={{ color: C.ink }}>Go there</a>
        </div>
      )}
      {canPick && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {q.data.scenarios.map((s) => (
            <li key={s.id}>
              <button onClick={() => start.mutate(s.id)} disabled={start.isPending || reset.isPending} aria-pressed={s.id === q.data?.active}
                style={{ width: "100%", minHeight: 64, textAlign: "left", padding: "12px 14px", borderRadius: 10, border: `1px solid ${s.id === q.data?.active ? C.ink2 : C.line2}`, background: "transparent", color: C.ink, font: "inherit", fontSize: 14 }}>
                <span style={{ display: "block", fontWeight: 600 }}>{s.title}</span>
                <span style={{ display: "block", fontSize: 12, color: C.dimmer, marginTop: 4 }}>Resets the demo, then sets this up</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {err && <div role="alert" style={{ color: C.redText, fontSize: 14 }}>{err}</div>}
    </section>
  );
}
