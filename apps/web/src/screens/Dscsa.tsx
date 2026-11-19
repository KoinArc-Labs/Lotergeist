import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type DragEvent } from "react";
import { get, msg, post, type User } from "../lib/api";
import { btn, C, card, ErrorBox, Footer, input, label, MONO, Pill, when } from "../components/kit";
import { mainStyle, PageHeader } from "../components/Shell";

const SANDBOX = "Sandbox, not a filing. Nothing is sent to anyone.";
const RESULT_TONE = { verified: "green", not_verified: "red", lot_recalled: "amber" } as const;
const RESULT_TEXT = { verified: "Verified", not_verified: "Not verified", lot_recalled: "Lot recalled" } as const;
const STATUS_TONE: Record<string, string> = { open: "amber", quarantined: "violet", closed_cleared: "green", closed_confirmed: "gray" };
const section = card({ padding: 22, display: "flex", flexDirection: "column", gap: 14 });
const field = { fontSize: 12, color: C.dimmer, display: "flex", flexDirection: "column" as const, gap: 4, flex: "1 1 150px" };
const th = { padding: "10px 12px", fontWeight: 500, textAlign: "left" as const, fontSize: 12, color: C.dimmer, background: C.well };
const td = { padding: "10px 12px", fontSize: 13, borderTop: `1px solid ${C.line}` };

/** DSCSA & trace: EPCIS export, advisory import, the sandbox verifier log and suspect product cases. */
export function Dscsa({ user }: { user: User }) {
  const pharmacist = user.role === "pharmacist";
  return (
    <>
      <PageHeader title="DSCSA & trace" sub="Lot and serial events in the open EPCIS 2.0 format, a sandbox verifier, and suspect product cases." />
      <main style={mainStyle()}>
        <div role="note" style={{ padding: "12px 16px", borderRadius: 10, background: "var(--accent-soft)", fontSize: 14, lineHeight: 1.5 }}>
          <strong>{SANDBOX}</strong> Exports are standard EPCIS 2.0 JSON-LD built from this pharmacy's ledger. Imported events are advisory trace data and can never add, move or release stock. The verifier is a synthetic stand-in, and no compliance is claimed.
        </div>
        {user.role === "cashier" || user.role === "admin"
          ? <p style={{ color: C.dim }}>A {user.role} does not use trace data. Sign in as a technician or pharmacist.</p>
          : <>
              <ExportCard pharmacist={pharmacist} />
              <ImportCard pharmacist={pharmacist} />
              <VerifyCard />
              <CasesCard pharmacist={pharmacist} />
            </>}
        <Footer />
      </main>
    </>
  );
}

function ExportCard({ pharmacist }: { pharmacist: boolean }) {
  const [f, setF] = useState({ from: "", to: "", lot: "", gtin: "", patients: false });
  const [preview, setPreview] = useState<{ count: number; text: string; skipped: number } | null>(null);
  const [err, setErr] = useState("");
  const qs = () => {
    const p = new URLSearchParams();
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    if (f.lot.trim()) p.set("lot", f.lot.trim());
    if (f.gtin.trim()) p.set("gtin", f.gtin.trim());
    if (f.patients) p.set("patients", "1");
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const show = async () => {
    setErr("");
    try {
      const d = await get<any>(`/api/epcis/export${qs()}`);
      const list = d.epcisBody.eventList as unknown[];
      setPreview({ count: list.length, skipped: d["chimera:skippedEvents"] ?? 0, text: JSON.stringify({ ...d, epcisBody: { eventList: list.slice(0, 3) } }, null, 2) });
    } catch (e) { setErr(msg(e)); setPreview(null); }
  };
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  return (
    <section aria-label="Export" style={section}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Export trace (EPCIS 2.0)</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={field}>From<input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} style={input()} /></label>
        <label style={field}>To<input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} style={input()} /></label>
        <label style={field}>Lot<input value={f.lot} maxLength={20} onChange={(e) => set("lot", e.target.value)} placeholder="e.g. PRORX050925-1" style={input({ fontFamily: MONO })} /></label>
        <label style={field}>GTIN-14<input value={f.gtin} maxLength={14} onChange={(e) => set("gtin", e.target.value)} placeholder="00370004417051" style={input({ fontFamily: MONO })} /></label>
      </div>
      {pharmacist && <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={f.patients} onChange={(e) => set("patients", e.target.checked)} style={{ width: 18, height: 18 }} />Include patient ids on dispensing events (ids only, never names)</label>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={show} style={btn("ghost")}>Preview</button>
        <a href={`/api/epcis/export${qs()}`} download style={btn("primary")}>Download .jsonld</a>
      </div>
      <ErrorBox e={err} />
      {preview && (
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: C.dim }}>{preview.count} events{preview.skipped ? `, ${preview.skipped} skipped (no GTIN or lot)` : ""}. First 3 shown.</p>
          <pre aria-label="File preview" style={{ margin: 0, padding: 14, borderRadius: 10, background: C.well, border: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 12, overflow: "auto", maxHeight: 320 }}>{preview.text}</pre>
        </div>
      )}
    </section>
  );
}

interface ImportResult { valid: boolean; dryRun: boolean; errors: { index: number | null; message: string }[]; counts: { events: number; new: number; duplicates: number; unknownProduct: number; skipped: number }; preview: { id: string; at: string; kind: string; gtin: string; lot: string | null; serial: string | null; known: boolean; duplicate: boolean }[]; note?: string }

function ImportCard({ pharmacist }: { pharmacist: boolean }) {
  const qc = useQueryClient();
  const [doc, setDoc] = useState<unknown>(null);
  const [name, setName] = useState("");
  const [res, setRes] = useState<ImportResult | null>(null);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const imports = useQuery({ queryKey: ["epcis-imports"], queryFn: () => get<{ imports: any[] }>("/api/epcis/imports") });
  const dry = async (d: unknown, n: string) => {
    setErr(""); setRes(null);
    try { setRes(await post<ImportResult>("/api/epcis/import", { document: d, dryRun: true, label: n })); } catch (e) { setErr(msg(e)); }
  };
  const read = async (file: File | undefined) => {
    if (!file) return;
    setErr(""); setRes(null);
    if (file.size > 1_800_000) { setErr("That file is over 1.8 MB."); return; }
    try { const d = JSON.parse(await file.text()); setDoc(d); setName(file.name); await dry(d, file.name); } catch { setErr("That file is not JSON."); setDoc(null); }
  };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); void read(e.dataTransfer.files[0]); };
  const confirm = useMutation({
    mutationFn: () => post<ImportResult>("/api/epcis/import", { document: doc, dryRun: false, label: name }),
    onSuccess: (r) => { setRes(r); void qc.invalidateQueries({ queryKey: ["epcis-imports"] }); },
    onError: (e) => setErr(msg(e))
  });
  return (
    <section aria-label="Import" style={section}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Import trace (advisory)</h2>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 28, borderRadius: 12, border: `2px dashed ${over ? C.violet : C.line2}`, background: over ? "var(--accent-soft)" : C.well, cursor: "pointer", textAlign: "center" }}>
        <span style={{ fontWeight: 600 }}>Drop an EPCIS 2.0 .json or .jsonld file here, or choose one</span>
        <span style={{ fontSize: 13, color: C.dim }}>A dry run runs first and shows what would be added. Nothing is stored until a pharmacist confirms, and stock never changes.</span>
        <input type="file" accept=".json,.jsonld,application/json,application/ld+json" onChange={(e) => void read(e.target.files?.[0])} aria-label="EPCIS file" style={{ marginTop: 6 }} />
      </label>
      <ErrorBox e={err} />
      {res && (
        <div role="status" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!res.valid
            ? <><Pill tone="red">Not valid EPCIS</Pill><ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{res.errors.slice(0, 8).map((e, i) => <li key={i}>{e.index !== null ? `Event ${e.index + 1}: ` : ""}{e.message}</li>)}</ul></>
            : <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill tone={res.dryRun ? "amber" : "green"}>{res.dryRun ? "Dry run, nothing stored" : "Stored as advisory trace data"}</Pill>
                  <Pill tone="gray">{res.counts.events} events</Pill><Pill tone="violet">{res.counts.new} new</Pill><Pill tone="gray">{res.counts.duplicates} duplicates</Pill>
                  {res.counts.unknownProduct > 0 && <Pill tone="amber">{res.counts.unknownProduct} unknown product</Pill>}
                  <Pill tone="green">Stock unchanged</Pill>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["When", "Step", "GTIN", "Lot", "Serial", ""].map((h) => <th key={h} scope="col" style={th}>{h}</th>)}</tr></thead>
                    <tbody>{res.preview.slice(0, 12).map((p, i) => <tr key={i}><td style={td}>{p.at.slice(0, 16).replace("T", " ")}</td><td style={td}>{p.kind}</td><td style={{ ...td, fontFamily: MONO }}>{p.gtin}</td><td style={{ ...td, fontFamily: MONO }}>{p.lot ?? "none"}</td><td style={{ ...td, fontFamily: MONO }}>{p.serial ?? "none"}</td><td style={td}>{p.duplicate ? "duplicate" : p.known ? "new" : "new, unknown product"}</td></tr>)}</tbody></table>
                </div>
                {res.dryRun && (pharmacist
                  ? <button onClick={() => confirm.mutate()} disabled={confirm.isPending || res.counts.new === 0} style={btn("primary", { alignSelf: "flex-start" })}>Confirm: store {res.counts.new} advisory events</button>
                  : <span style={{ fontSize: 13, color: C.dim }}>A pharmacist confirms an import.</span>)}
              </>}
        </div>
      )}
      <details>
        <summary style={{ cursor: "pointer", fontSize: 13, color: C.dim }}>Stored imports ({imports.data?.imports.length ?? 0})</summary>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}><thead><tr>{["Stored", "By", "Step", "Lot", "Serial", "File"].map((h) => <th key={h} scope="col" style={th}>{h}</th>)}</tr></thead>
            <tbody>{(imports.data?.imports ?? []).slice(0, 30).map((r) => <tr key={r.id}><td style={td}>{when(r.at)}</td><td style={td}>{r.by_name}</td><td style={td}>{r.kind}</td><td style={{ ...td, fontFamily: MONO }}>{r.lot ?? ""}</td><td style={{ ...td, fontFamily: MONO }}>{r.serial ?? ""}</td><td style={td}>{r.source_label}</td></tr>)}</tbody></table>
        </div>
      </details>
    </section>
  );
}

function VerifyCard() {
  const qc = useQueryClient();
  const log = useQuery({ queryKey: ["verifications"], queryFn: () => get<{ verifications: any[] }>("/api/dscsa/verifications") });
  const [f, setF] = useState({ gtin: "00370004088121", serial: "DEMO-OK-01", lot: "224016", expiry: "2028-02-29" });
  const [err, setErr] = useState("");
  const ask = useMutation({
    mutationFn: () => post("/api/dscsa/verify", { ...f, ...(f.expiry ? {} : { expiry: undefined }) }),
    onSuccess: () => { setErr(""); void qc.invalidateQueries({ queryKey: ["verifications"] }); },
    onError: (e) => setErr(msg(e))
  });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <section aria-label="Verification requests" style={section}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Verification requests <Pill tone="gray">sandbox verifier</Pill></h2>
      <p style={{ margin: 0, fontSize: 13, color: C.dim }}>Answers come from bundled fixtures and this store's supplier records. Try <code>DEMO-OK-01</code> (verified) or <code>SPOOF-001</code> (not verified).</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        {(["gtin", "serial", "lot", "expiry"] as const).map((k) => <label key={k} style={field}>{k === "gtin" ? "GTIN-14" : k[0]!.toUpperCase() + k.slice(1)}<input value={f[k]} onChange={(e) => set(k, e.target.value)} style={input({ fontFamily: MONO })} /></label>)}
        <button onClick={() => ask.mutate()} disabled={ask.isPending} style={btn("primary")}>Ask the sandbox verifier</button>
      </div>
      <ErrorBox e={err} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["#", "When", "By", "Serial", "Lot", "Answer", "Why"].map((h) => <th key={h} scope="col" style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(log.data?.verifications ?? []).slice(0, 25).map((v) => <tr key={v.id}><td style={td}>{v.id}</td><td style={td}>{when(v.at)}</td><td style={td}>{v.by}</td><td style={{ ...td, fontFamily: MONO }}>{v.serial}</td><td style={{ ...td, fontFamily: MONO }}>{v.lot}</td><td style={td}><Pill tone={RESULT_TONE[v.result as keyof typeof RESULT_TONE]}>{RESULT_TEXT[v.result as keyof typeof RESULT_TEXT]}</Pill></td><td style={td}>{String(v.reason).replace(/_/g, " ")}</td></tr>)}
            {!log.data?.verifications.length && <tr><td style={td} colSpan={7}>No requests yet.</td></tr>}
          </tbody></table>
      </div>
    </section>
  );
}

function CasesCard({ pharmacist }: { pharmacist: boolean }) {
  const qc = useQueryClient();
  const cases = useQuery({ queryKey: ["cases"], queryFn: () => get<{ cases: any[] }>("/api/dscsa/cases") });
  const [open, setOpen] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const detail = useQuery({ queryKey: ["case", open], queryFn: () => get<any>(`/api/dscsa/cases/${open}`), enabled: open !== null });
  const done = () => { setErr(""); setNote(""); void qc.invalidateQueries({ queryKey: ["cases"] }); void qc.invalidateQueries({ queryKey: ["case"] }); void qc.invalidateQueries({ queryKey: ["lots"] }); };
  const quarantine = useMutation({ mutationFn: (id: number) => post(`/api/dscsa/cases/${id}/quarantine`), onSuccess: done, onError: (e) => setErr(msg(e)) });
  const close = useMutation({ mutationFn: (a: { id: number; status: string }) => post(`/api/dscsa/cases/${a.id}/close`, { status: a.status, note }), onSuccess: done, onError: (e) => setErr(msg(e)) });
  const d = detail.data;
  return (
    <section aria-label="Suspect product cases" style={section}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Suspect product cases</h2>
      <p style={{ margin: 0, fontSize: 13, color: C.dim }}>{pharmacist ? "Open a case from a failed verification at receiving, or from a confirmed recalled lot." : "A pharmacist opens and closes cases. You can read them."} A recalled lot stays blocked even when its case is closed.</p>
      <ErrorBox e={err} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Case", "Opened", "From", "Lot", "Serial", "Status", ""].map((h) => <th key={h} scope="col" style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(cases.data?.cases ?? []).map((c) => (
              <tr key={c.id}><td style={td}>{c.id}</td><td style={td}>{when(c.openedAt)}</td><td style={td}>{c.source === "recall" ? `recall ${c.recallId}` : "failed verification"}</td><td style={{ ...td, fontFamily: MONO }}>{c.lot}</td><td style={{ ...td, fontFamily: MONO }}>{c.serial ?? "lot level"}</td>
                <td style={td}><Pill tone={STATUS_TONE[c.status] ?? "gray"}>{String(c.status).replace("_", " ")}</Pill></td>
                <td style={td}><button onClick={() => { setOpen(open === c.id ? null : c.id); setNote(""); setErr(""); }} aria-expanded={open === c.id} style={btn("ghost", { minHeight: 34 })}>{open === c.id ? "Hide" : "Open"}</button></td></tr>
            ))}
            {!cases.data?.cases.length && <tr><td style={td} colSpan={7}>No cases yet.</td></tr>}
          </tbody></table>
      </div>
      {open !== null && d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={label}>Draft report. Read it, edit it elsewhere if you need to. Chimera Rx does not send or file it.</span>
          <pre aria-label="Case draft" style={{ margin: 0, padding: 14, borderRadius: 10, background: C.well, border: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 12, whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 360 }}>{d.draft}</pre>
          {pharmacist && !String(d.status).startsWith("closed") && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {d.status === "open" && <button onClick={() => quarantine.mutate(d.id)} style={btn("red")}>Quarantine the package</button>}
              <input aria-label="Closing note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Closing note" style={input({ flex: "1 1 220px" })} />
              <button onClick={() => close.mutate({ id: d.id, status: "closed_confirmed" })} style={btn("ghost")}>Close: suspect confirmed</button>
              <button onClick={() => close.mutate({ id: d.id, status: "closed_cleared" })} disabled={!note.trim()} style={btn("ghost")}>Close: cleared (needs a note)</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
