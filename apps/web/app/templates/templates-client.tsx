"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function TemplatesClient({ approved, version, drafts }: { approved: boolean; version: string; drafts: Record<string, string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function set(v: boolean) {
    setBusy(true); setErr("");
    const r = await api("PUT", "/v1/platform/staff-templates", { approved: v });
    setBusy(false);
    if (!r.ok) return setErr((await r.json().catch(() => null))?.title ?? "That did not work.");
    router.refresh();
  }
  return (
    <>
      {err && <div className="note" role="alert"><b>{err}</b></div>}
      <div className="card">
        <div className="sectionhead"><h2>Approval</h2><span className={`tag ${approved ? "ok" : "warn"}`}>{approved ? "Approved" : "DRAFT, not approved"}</span></div>
        <p className="muted">Wording version {version}. Approving covers both texts below. Any later change to the wording withdraws the approval until you give it again. The organisation name and the engagement purpose are filled in for each client.</p>
        <button className={`btn ${approved ? "ghost" : "gold"} sm`} style={{ marginTop: 10 }} disabled={busy} onClick={() => set(!approved)}>{approved ? "Withdraw approval" : "Approve both templates"}</button>
      </div>
      {Object.entries(drafts).map(([k, t]) => (
        <div className="card" key={k}>
          <div className="sectionhead"><h2>{k === "FULL" ? "Full anonymity" : "Confidential, reported in aggregate"}</h2><span className="tag warn">DRAFT</span></div>
          <pre style={{ whiteSpace: "pre-wrap", font: "inherit", margin: 0 }}>{t}</pre>
        </div>
      ))}
    </>
  );
}
