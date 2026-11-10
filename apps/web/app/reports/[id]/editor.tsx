"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEXT_SECTIONS } from "@/lib/report-text";
import { api } from "@/lib/api";

const MANDATORY = ["what_this_means", "what_to_do_next"];


// Consultant only, DRAFT reports. The text is written by the system and cannot be edited (owner ruling 22 Oct 2026): the consultant reads it, then
// releases it. Comments for the client are given in the debrief, outside the report. The checklist shows what the technical appendix still lacks.
export default function Editor({ reportId, sections, accepted, checklist = [] }: { reportId: string; sections: Record<string, string>; accepted: string[]; checklist?: { label: string; present: boolean }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function release() {
    if (!confirm("Release this report to the client? Once released it can no longer change.")) return;
    setBusy(true); setMsg(null);
    const r = await api("POST", `/v1/reports/${reportId}/release`);
    const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: [j?.title, ...(j?.reasons ?? [])].filter(Boolean).join(": ") || "Could not release." });
    router.refresh();
  }

  return (
    <section className="cds-sec" id="cds-draft">
      <div className="cds-card" style={{ borderLeft: "4px solid var(--o)", background: "#fff8f5" }}>
        <h2 style={{ fontFamily: "var(--font-poppins)", fontSize: 17 }}>Draft: not visible to the client</h2>
        <p className="muted small">The system wrote this text from the results. You review it and release it; it cannot be edited. Give your comments to the client in the debrief. Only you and other assigned consultants can see this until release.</p>
        {TEXT_SECTIONS.map((s) => sections[s.key] ? (
          <div key={s.key} style={{ marginTop: 10 }}>
            <div className="small"><b>{s.label}</b></div>
            <p style={{ whiteSpace: "pre-line", marginTop: 2 }}>{sections[s.key]}</p>
          </div>
        ) : null)}
        {msg && <div className={`note${msg.ok ? " blue" : ""}`} role="status">{msg.text}</div>}
        <div className="small" aria-label="Release checklist" style={{ marginTop: 12 }}><b>Technical appendix for release</b>
          <ul style={{ margin: "4px 0 10px", paddingLeft: 18 }}>{checklist.map((c) => <li key={c.label}>{c.present ? "Ready" : "Missing"}: {c.label}</li>)}</ul></div>
        <div className="navbtns" style={{ justifyContent: "flex-start" }}>
          <button className="btn gold" disabled={busy || !MANDATORY.every((k) => accepted.includes(k)) || checklist.some((c) => !c.present)} onClick={release}>Release to client</button>
        </div>
      </div>
    </section>
  );
}
