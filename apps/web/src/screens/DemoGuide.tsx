import { Link } from "react-router-dom";
import { type User } from "../lib/api";
import { Scenarios } from "../components/Scenarios";
import { C, Footer } from "../components/kit";
import { mainStyle, PageHeader } from "../components/Shell";

const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 10 } as const;

/** Everything that exists only for the demo lives here, so the product screens stay product screens. Hidden when LG_DEMO=0. */
export function DemoGuide({ user }: { user: User }) {
  const link = { color: C.violet2 };
  return (
    <>
      <PageHeader title="Demo guide" sub="Tools for showing Chimera Rx on synthetic data. Nothing here is part of the product." />
      <main style={mainStyle()}>
        <section aria-labelledby="dg-path" style={card}>
          <h2 id="dg-path" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>The three-minute path</h2>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, fontSize: 14 }}>
            <li><Link to="/recalls" style={link}>Recalls</Link>: read the fax, confirm the lots</li>
            <li><Link to="/inventory?filter=recall" style={link}>Inventory</Link>: the quarantined units</li>
            <li><Link to="/patients" style={link}>Patients</Link>: who took a recalled lot home</li>
            <li><Link to="/recalls" style={link}>Recalls</Link>: send the messages (use the AI draft)</li>
            <li><Link to="/agents" style={link}>AI agents</Link>, <Link to="/dscsa" style={link}>DSCSA &amp; trace</Link> and <Link to="/refills" style={link}>Refills</Link></li>
          </ol>
          <p style={{ margin: 0, fontSize: 13, color: C.dim }}>The full script and the longer path are in docs/DEMO.md and docs/DEMO_SCRIPT.md in the repository.</p>
        </section>

        <Scenarios user={user} />

        <section aria-labelledby="dg-tools" style={card}>
          <h2 id="dg-tools" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Demo tools</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, fontSize: 14 }}>
            <li><Link to="/labels" style={link}>Test labels</Link>: real GS1 DataMatrix codes to hold up to the camera, or print</li>
            {user.role !== "cashier" && <li><Link to="/outbox" style={link}>Sandbox outbox</Link>: every text, email and voicemail the demo "sends". Nothing leaves this computer.</li>}
          </ul>
        </section>

        <section aria-labelledby="dg-acct" style={card}>
          <h2 id="dg-acct" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Demo accounts</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>All accounts share the password <code>moonlight-rx-2026</code>. Store 7: <code>j.rivera</code> (pharmacist), <code>k.patel</code> (technician), <code>m.diaz</code> (cashier), <code>s.grant</code> (admin), all at <code>@elmstreetrx.example</code>. Store 2 (when two stores are on): <code>s.okoro</code>, <code>t.lund</code>, <code>c.reyes</code> at <code>@birchavenuerx.example</code>.</p>
        </section>
        <Footer />
      </main>
    </>
  );
}
