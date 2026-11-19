import { useState } from "react";
import { Link } from "react-router-dom";
import { msg, post, type User } from "../lib/api";
import { btn, C, ErrorBox, label, Pill } from "./kit";

interface Verification { id: number; result: "verified" | "not_verified" | "lot_recalled"; reason: string; message: string; label: string }
const TONE = { verified: "green", not_verified: "red", lot_recalled: "amber" } as const;
const TEXT = { verified: "Verified (sandbox)", not_verified: "Not verified (sandbox)", lot_recalled: "Lot recalled (sandbox)" } as const;

/**
 * "Verify with manufacturer (sandbox)": shown at receiving when the supplier's transaction information does not match or the serial is unknown.
 * The answer is synthetic. It never moves the package: on "not verified" the existing flow (report a problem, quarantine) stays as it was.
 */
export function VerifyPanel({ out, user }: { out: any; user: User }) {
  const [res, setRes] = useState<Verification | null>(null);
  const [caseId, setCaseId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const f = (k: string) => out.fields.find((x: any) => x.k === k)?.v ?? "";
  const failed = out.checks.some((c: any) => c.id === "tits" && c.state === "fail");
  if (!failed || out.noSerial || user.role === "cashier") return null;
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(f("Expiry")) ? f("Expiry") : "";

  const verify = async () => {
    setBusy(true); setErr("");
    try { setRes(await post<Verification>("/api/dscsa/verify", { gtin: f("GTIN"), serial: f("Serial"), lot: f("Lot"), expiry, packageId: out.packageId })); }
    catch (e) { setErr(msg(e)); } finally { setBusy(false); }
  };
  const open = async () => {
    setErr("");
    try { setCaseId((await post<{ id: number }>("/api/dscsa/cases", { verificationId: res!.id })).id); } catch (e) { setErr(msg(e)); }
  };
  return (
    <div role="group" aria-label="Verify with manufacturer (sandbox)" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 12, border: `1px dashed ${C.line2}`, background: C.well }}>
      <span style={label}>Sandbox verifier. A synthetic answer from fixtures, not a manufacturer or a Verification Router Service response.</span>
      {!res && <button onClick={verify} disabled={busy} style={btn("ghost", { alignSelf: "flex-start" })}>{busy ? "Asking…" : "Verify with manufacturer (sandbox)"}</button>}
      {res && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Pill tone={TONE[res.result]}>{TEXT[res.result]}</Pill>
            <span style={{ fontSize: 14 }}>{res.message}</span>
          </div>
          {res.result !== "verified" && <p style={{ margin: 0, fontSize: 13, color: C.dim }}>Nothing changed on the package. Report a problem below to quarantine it.</p>}
          {res.result !== "verified" && user.role === "pharmacist" && (caseId
            ? <span style={{ fontSize: 13 }}>Case {caseId} opened. <Link to="/dscsa">Open DSCSA &amp; trace</Link></span>
            : <button onClick={open} style={btn("ghost", { alignSelf: "flex-start" })}>Open a suspect product case</button>)}
        </>
      )}
      <ErrorBox e={err} />
    </div>
  );
}
