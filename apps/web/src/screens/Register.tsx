import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { get, msg, post, type User } from "../lib/api";
import { startScanner, type ScannerHandle } from "../lib/scanner";
import { btn, C, ErrorBox, Footer, input, MONO, Pill } from "../components/kit";
import { mainStyle, PageHeader } from "../components/Shell";

interface Item { upc: string; name: string; price_cents: number }
interface Rx { dispenseId: number; rx: string; drug: string; copayCents: number; blocked: string | null }
interface Receipt { saleId: number; at: number; store: string; cashier: string; status: string; note: string; total: string; lines: { kind: string; name: string; qty: number; priceCents: number; rx?: string; lot?: string; serial?: string }[] }
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Front-store register (FR3): over-the-counter items by scan or name, plus one patient's verified prescriptions. */
export function Register({ user }: { user: User }) {
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [pq, setPq] = useState("");
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [check, setCheck] = useState({ id: false, counsel: false, sign: false });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [err, setErr] = useState("");
  const [cam, setCam] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const handle = useRef<ScannerHandle | null>(null);

  const items = useQuery({ queryKey: ["reg-items", q], queryFn: () => get<Item[]>(`/api/register/items?q=${encodeURIComponent(q)}`) });
  const all = useQuery({ queryKey: ["reg-items", ""], queryFn: () => get<Item[]>("/api/register/items?q=") });
  const patients = useQuery({ queryKey: ["reg-pts", pq], queryFn: () => get<{ id: string; name: string }[]>(`/api/register/patients?q=${encodeURIComponent(pq)}`), enabled: pq.trim().length >= 2 && !patient });
  const ready = useQuery({ queryKey: ["reg-rx", patient?.id], queryFn: () => get<{ prescriptions: Rx[] }>(`/api/register/patients/${patient!.id}`), enabled: !!patient });
  useEffect(() => () => handle.current?.stop(), []);

  const byUpc = (upc: string) => all.data?.find((i) => i.upc === upc);
  const add = (upc: string) => setCart((c) => ({ ...c, [upc]: Math.min(20, (c[upc] ?? 0) + 1) }));
  const scanned = async (code: string) => {
    const hit = await get<Item[]>(`/api/register/items?q=${encodeURIComponent(code)}`);
    if (hit[0]) { add(hit[0].upc); setErr(""); setQ(""); } else setErr(`No item with barcode ${code}. Search by name instead.`);
  };
  async function toggleCam() {
    if (cam) { handle.current?.stop(); handle.current = null; setCam(false); return; }
    try {
      handle.current = await startScanner({ video: video.current!, kind: "retail", onCode: (c) => { void scanned(c); window.setTimeout(() => handle.current?.resume(), 1500); } });
      setCam(true);
    } catch (e) { setErr(msg(e)); }
  }

  const lines = Object.entries(cart).map(([upc, qty]) => ({ upc, qty, item: byUpc(upc) })).filter((l) => l.item);
  const rx = (ready.data?.prescriptions ?? []).filter((r) => picked.includes(r.dispenseId));
  const total = lines.reduce((a, l) => a + l.item!.price_cents * l.qty, 0) + rx.reduce((a, r) => a + r.copayCents, 0);
  const checklistOk = !rx.length || (check.id && check.counsel && check.sign);

  const sale = useMutation({
    mutationFn: () => post<Receipt>("/api/register/sales", { patientId: patient?.id, items: lines.map((l) => ({ upc: l.upc, qty: l.qty })), dispenseIds: picked, idChecked: check.id, counseled: check.counsel, signature: check.sign }),
    onSuccess: (r) => { setReceipt(r); setCart({}); setPicked([]); setPatient(null); setPq(""); setCheck({ id: false, counsel: false, sign: false }); setErr(""); ready.refetch(); },
    onError: (e) => setErr(msg(e))
  });

  const box = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 } as const;
  return (
    <>
      <PageHeader title="Register" sub={`Front counter · ${user.name}. Marked paid only: no payment is processed.`} />
      <main style={mainStyle()}>
        {receipt && (
          <section role="status" aria-label="Receipt" style={{ ...box, borderColor: C.ink2 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Receipt #{receipt.saleId} · {receipt.status.toUpperCase()}</h2>
            <div style={{ fontSize: 13, color: C.dim }}>{receipt.store} · {new Date(receipt.at).toLocaleString()} · cashier {receipt.cashier}</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {receipt.lines.map((l, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                  <span>{l.qty > 1 ? `${l.qty} × ` : ""}{l.name}{l.rx && <span style={{ display: "block", fontFamily: MONO, fontSize: 12, color: C.dimmer }}>Rx {l.rx} · lot {l.lot} · serial {l.serial}</span>}</span>
                  <span>{money(l.priceCents * l.qty)}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>Total</span><span>{receipt.total}</span></div>
            <div style={{ fontSize: 12, color: C.dimmer }}>{receipt.note} Prescription copays are a fixed synthetic amount.</div>
            <button onClick={() => setReceipt(null)} style={btn("ghost", { alignSelf: "flex-start" })}>New sale</button>
          </section>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
          <section aria-labelledby="otc" style={{ ...box, flex: "1 1 420px", minWidth: 0 }}>
            <h2 id="otc" style={{ margin: 0, fontSize: 16 }}>Items</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label htmlFor="rq" className="sr">Scan a retail barcode or search by name</label>
              <input id="rq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Scan the barcode, or search by name"
                onKeyDown={(e) => { if (e.key === "Enter" && /^\d{8,14}$/.test(q.trim())) void scanned(q.trim()); }}
                style={input({ flex: "1 1 240px" })} autoComplete="off" />
              <button onClick={toggleCam} style={btn("ghost", { minHeight: 44 })}>{cam ? "Stop camera" : "Use camera"}</button>
            </div>
            <video ref={video} playsInline muted style={{ width: "100%", maxHeight: cam ? 220 : 0, borderRadius: 10, background: "#000", display: cam ? "block" : "none" }} />
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
              {(items.data ?? []).map((i) => (
                <li key={i.upc} style={{ borderTop: `1px solid ${C.line}` }}>
                  <button onClick={() => add(i.upc)} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 12, minHeight: 48, padding: "8px 4px", background: "transparent", border: 0, color: C.ink, font: "inherit", fontSize: 14, textAlign: "left" }}>
                    <span>{i.name}<span style={{ display: "block", fontFamily: MONO, fontSize: 12, color: C.dimmer }}>{i.upc}</span></span>
                    <span>{money(i.price_cents)}</span>
                  </button>
                </li>
              ))}
              {!items.data?.length && <li style={{ color: C.dim, fontSize: 14, padding: 8 }}>Nothing found.</li>}
            </ul>
          </section>

          <section aria-labelledby="sale" style={{ ...box, flex: "1 1 380px", minWidth: 0 }}>
            <h2 id="sale" style={{ margin: 0, fontSize: 16 }}>This sale</h2>
            {lines.map((l) => (
              <div key={l.upc} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 14 }}>
                <span>{l.item!.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button aria-label={`Remove one ${l.item!.name}`} onClick={() => setCart((c) => { const n = { ...c, [l.upc]: c[l.upc]! - 1 }; if (n[l.upc]! <= 0) delete n[l.upc]; return n; })} style={btn("ghost", { minHeight: 44, minWidth: 44 })}>−</button>
                  <span style={{ minWidth: 20, textAlign: "center" }}>{l.qty}</span>
                  <button aria-label={`Add one ${l.item!.name}`} onClick={() => add(l.upc)} style={btn("ghost", { minHeight: 44, minWidth: 44 })}>+</button>
                  <span style={{ minWidth: 64, textAlign: "right" }}>{money(l.item!.price_cents * l.qty)}</span>
                </span>
              </div>
            ))}
            {rx.map((r) => <div key={r.dispenseId} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Rx {r.rx} · {r.drug}</span><span>{money(r.copayCents)}</span></div>)}
            {!lines.length && !rx.length && <p style={{ margin: 0, color: C.dim, fontSize: 14 }}>Empty. Add items, or pick a patient's ready prescriptions below.</p>}

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <strong style={{ fontSize: 14 }}>Prescriptions for pickup</strong>
              {patient ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Pill tone="violet">{patient.name} · {patient.id}</Pill>
                  <button onClick={() => { setPatient(null); setPicked([]); }} style={btn("ghost", { minHeight: 44 })}>Change patient</button>
                </div>
              ) : (
                <>
                  <label htmlFor="pq" className="sr">Find the patient</label>
                  <input id="pq" value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Patient name or ID" style={input()} autoComplete="off" />
                  {(patients.data ?? []).map((p) => <button key={p.id} onClick={() => setPatient(p)} style={btn("ghost", { justifyContent: "flex-start", minHeight: 44 })}>{p.name} · {p.id}</button>)}
                </>
              )}
              {patient && (ready.data?.prescriptions.length ? ready.data.prescriptions.map((r) => (
                <label key={r.dispenseId} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, opacity: r.blocked ? 0.7 : 1 }}>
                  <input type="checkbox" disabled={!!r.blocked} checked={picked.includes(r.dispenseId)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.dispenseId] : p.filter((x) => x !== r.dispenseId)))} style={{ width: 22, height: 22 }} />
                  <span>Rx {r.rx} · {r.drug}{r.blocked && <span style={{ display: "block", color: C.redText }}>Blocked: {r.blocked}</span>}</span>
                </label>
              )) : <span style={{ color: C.dim, fontSize: 14 }}>No fills waiting for this patient.</span>)}
              {rx.length > 0 && (
                <fieldset style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <legend style={{ fontSize: 12, color: C.dimmer }}>Pickup checks (required)</legend>
                  {([["id", "Photo ID checked"], ["counsel", "Counseling offered"], ["sign", "Signature captured"]] as const).map(([k, t]) => (
                    <label key={k} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, minHeight: 36 }}>
                      <input type="checkbox" checked={check[k]} onChange={(e) => setCheck({ ...check, [k]: e.target.checked })} style={{ width: 22, height: 22 }} />{t}
                    </label>
                  ))}
                </fieldset>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 600 }}><span>Total</span><span>{money(total)}</span></div>
            <ErrorBox e={err} />
            <button disabled={sale.isPending || (!lines.length && !rx.length) || !checklistOk} onClick={() => sale.mutate()} style={btn("primary", { minHeight: 48 })}>
              {sale.isPending ? "Completing…" : "Mark paid and print receipt"}
            </button>
            <span style={{ fontSize: 12, color: C.dimmer }}>Over-the-counter stock is not tracked; the register only records the sale.</span>
          </section>
        </div>
        <Footer />
      </main>
    </>
  );
}
