"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function CompletionClient({ assessmentId, text, complete, medianSeconds, needsUpdate }: { assessmentId: string; text: string | null; complete: number; medianSeconds: number | null; needsUpdate: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await api("PUT", `/v1/assessments/${assessmentId}/completion-estimate`, { text: new FormData(e.currentTarget).get("text") });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: (await r.json().catch(() => null))?.title ?? "That did not work." });
    setMsg({ ok: true, text: "Statement updated. It shows on the survey invitation from now on." }); router.refresh();
  }
  return (
    <div className="card">
      <div className="sectionhead"><h2>Completion time statement</h2>{needsUpdate && <span className="tag warn">Update suggested</span>}</div>
      <p className="muted">People are told the survey takes: <b>{text ?? "35 to 45 minutes"}</b>.</p>
      <p className="muted" style={{ marginTop: 6 }}>{medianSeconds === null
        ? `${complete} complete response${complete === 1 ? "" : "s"} so far. The measured median time appears once enough have come in (a group too small to show is never shown).`
        : `The measured median is ${Math.round(medianSeconds / 60)} minutes over ${complete} complete responses.`}
        {needsUpdate && " After 30 responses the median is outside 30 to 50 minutes, so please update the statement."}</p>
      <form className="addbox" onSubmit={save}>
        <div className="field" style={{ maxWidth: 320 }}><label className="flab" htmlFor="ce">New statement</label>
          <input id="ce" name="text" required maxLength={60} defaultValue={text ?? ""} placeholder="for example 40 to 50 minutes" /></div>
        <button className="btn gold sm" style={{ marginTop: 10 }} disabled={busy}>Update the statement</button>
      </form>
      {msg && <p className="small" role={msg.ok ? "status" : "alert"} style={{ marginTop: 8 }}>{msg.text}</p>}
    </div>
  );
}
