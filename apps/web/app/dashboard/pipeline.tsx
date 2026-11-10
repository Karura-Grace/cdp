"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// One button for the next step of the consultant's pipeline. Each step is its own audited, idempotent endpoint.
// `dsh`: the button alone, styled for the new dashboard, whose card draws the "Next step" frame around it
export default function Pipeline({ label, url, body, dsh }: { label: string; url: string; body?: unknown; dsh?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function run() {
    setBusy(true); setErr("");
    const r = await api("POST", url, body ?? {});
    if (r.ok) { router.refresh(); return setBusy(false); }
    const j = await r.json().catch(() => null);
    setErr(j?.title ?? "That did not work."); setBusy(false);
  }
  if (dsh) return <><button className="dsh-pill is-or" onClick={run} disabled={busy}>{busy ? "Working…" : label}</button>{err && <span role="alert" style={{ color: "#B3261E", fontSize: 14 }}>{err}</span>}</>;
  return (
    <div className="stf-next">
      <span className="k">Next step</span>
      <button className="sbtn orange" onClick={run} disabled={busy}>{busy ? "Working…" : label}</button>
      {err && <span role="alert" className="ssmall" style={{ color: "var(--bad)" }}>{err}</span>}
    </div>
  );
}
