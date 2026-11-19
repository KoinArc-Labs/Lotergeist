import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, msg, post, type User } from "../lib/api";
import { btn, C, ErrorBox, Footer, MONO, Pill } from "../components/kit";
import { mainStyle, PageHeader } from "../components/Shell";
import { useState } from "react";

type Kind = "reorder" | "expiry" | "shortage";
interface Row { key: string; product: string; reason: string; decision: string | null; explanation?: string; [k: string]: unknown }
interface Help { advisory: string; llm: string | null; canAct: boolean; reorder: Row[]; expiry: Row[]; shortages: Row[] }

/** AI stock help (FR8): rule-based suggestions with their numbers. Advice only; a pharmacist accepts or dismisses. */
export function StockHelp({ user }: { user: User }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["stock-help"], queryFn: () => get<Help>("/api/stock-help") });
  const [err, setErr] = useState("");
  const decide = useMutation({
    mutationFn: (b: { kind: Kind; key: string; decision: "accepted" | "dismissed" }) => post("/api/stock-help/decision", b),
    onSuccess: () => { setErr(""); void qc.invalidateQueries({ queryKey: ["stock-help"] }); },
    onError: (e) => setErr(msg(e))
  });
  const h = q.data;
  const section = (title: string, kind: Kind, rows: Row[], empty: string) => (
    <section aria-label={title} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>{title} <span style={{ color: C.dimmer, fontWeight: 400 }}>({rows.length})</span></h2>
      {!rows.length && <p style={{ margin: 0, color: C.dim, fontSize: 14 }}>{empty}</p>}
      {rows.map((r) => (
        <article key={r.key} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6, opacity: r.decision === "dismissed" ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
            <strong style={{ fontSize: 14 }}>{r.product}{kind === "expiry" && <span style={{ fontFamily: MONO, fontWeight: 400, color: C.dimmer }}> · lot {String(r.lot)}</span>}</strong>
            {kind === "reorder" && <Pill tone="amber">Order {String(r.suggestedQty)}</Pill>}
            {kind === "expiry" && <Pill tone="orange">Dispense first</Pill>}
            {kind === "shortage" && <Pill tone="red">{String(r.status)}</Pill>}
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: C.ink2 }}>{r.reason}</p>
          {r.explanation && <p style={{ margin: 0, fontSize: 13, color: C.dim }}><Pill tone="violet">AI advice</Pill> {r.explanation}</p>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {r.decision ? <Pill tone={r.decision === "accepted" ? "green" : "gray"}>{r.decision === "accepted" ? "Accepted" : "Dismissed"}</Pill> : null}
            {h?.canAct && (
              <>
                <button disabled={decide.isPending} onClick={() => decide.mutate({ kind, key: r.key, decision: "accepted" })} style={btn("ghost", { minHeight: 44 })}>Accept</button>
                <button disabled={decide.isPending} onClick={() => decide.mutate({ kind, key: r.key, decision: "dismissed" })} style={btn("ghost", { minHeight: 44 })}>Dismiss</button>
              </>
            )}
          </div>
        </article>
      ))}
    </section>
  );
  return (
    <>
      <PageHeader title="Stock help" sub="Advice from rules, with the numbers shown. Nothing is ordered or moved for you." />
      <main style={mainStyle()}>
        <div role="note" style={{ padding: "12px 16px", borderRadius: 10, background: "var(--accent-soft)", fontSize: 14 }}>
          {h?.advisory} {h?.llm ? `Plain-words explanations come from ${h.llm}; they never change a number.` : "No LLM is configured, so each suggestion shows the rule's own reason."}
          {!h?.canAct && h && <> {user.role === "technician" ? "A technician can read suggestions; a pharmacist accepts or dismisses them." : ""}</>}
        </div>
        <ErrorBox e={err} />
        {section("Reorder", "reorder", h?.reorder ?? [], "Nothing is below its target.")}
        {section("Expiry risk", "expiry", h?.expiry ?? [], "No lot looks likely to expire unused.")}
        {section("Shortages", "shortage", h?.shortages ?? [], "None of the products you stock is on the shortage list.")}
        <Footer />
      </main>
    </>
  );
}
