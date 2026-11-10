"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

type Note = { annotation_id: string; body: string; created_at: string };

// Notes on one finding. They sit beside the finding and never change its verdict; clients do not see them.
export default function Annotations({ assessmentId, findingId, notes }: { assessmentId: string; findingId: string; notes: Note[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const r = await api("POST", `/v1/assessments/${assessmentId}/annotations`, { finding_id: findingId, body: text });
    setBusy(false);
    if (!r.ok) return setErr((await r.json().catch(() => null))?.title ?? "That did not work.");
    setText(""); router.refresh();
  }
  return (
    <div style={{ marginTop: 8 }}>
      {notes.map((n) => <p key={n.annotation_id} className="small" style={{ background: "#fff8f5", padding: "6px 10px", borderRadius: 8, marginTop: 4 }}>{n.body} <span className="muted">{new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span></p>)}
      <form onSubmit={add} className="cds-toolbar" style={{ marginTop: 6 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Add a note (never changes the verdict)" aria-label={`Note on ${findingId}`} style={{ flex: 1 }} />
        <button className="sbtn ghost" type="submit" disabled={busy || !text.trim()}>Add note</button>
      </form>
      {err && <div className="cds-explain" role="alert">{err}</div>}
    </div>
  );
}
