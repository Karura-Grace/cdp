"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Monitor = { floor: number; cohorts: { cohort: string; invited: number; started: number; submitted: number; rate: number }[]; suppressed: { cohorts: number; invited: number };
  daily: { day: string; submitted: number }[]; window_close: string; extensions: { seq: number; old_close: string; new_close: string; working_days: number; reason: string }[] };
type Quality = { submitted: number; median_seconds: number; states: Record<string, number>; flags: Record<string, number>;
  flagged: { response_id: string; flags: string[]; excluded: boolean; duration_seconds: number | null }[]; voided: { response_id: string; reason: string; created_at: string }[] };
type Comment = { comment_id: string; question_code: string; body: string; redacted: string | null; reviewed: boolean };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const mins = (s: number | null) => (s === null ? "n/a" : `${Math.round(s / 60)} min`);
const send = async (url: string, body: unknown) => {
  const r = await api("POST", url, body);
  return r.ok ? null : ((await r.json().catch(() => null))?.title ?? "That did not work.");
};

export default function FieldingClient({ assessmentId, consultant, open, frozen, leaders }: { assessmentId: string; consultant: boolean; open: boolean; frozen: boolean; leaders: { id: string; name: string }[] }) {
  const base = `/v1/assessments/${assessmentId}`;
  const [m, setM] = useState<Monitor | null>(null);
  const [q, setQ] = useState<Quality | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`${base}/monitor`, { cache: "no-store" });
    if (r.ok) setM(await r.json());
    if (consultant && open) { const s = await fetch(`${base}/quality`, { cache: "no-store" }); if (s.ok) setQ(await s.json()); }
  }, [base, consultant, open]);
  useEffect(() => { load(); }, [load]);
  const act = async (url: string, body: unknown, ok: string) => { setMsg(null); const e = await send(url, body); setMsg(e ? { ok: false, text: e } : { ok: true, text: ok }); if (!e) load(); };

  return (
    <>
      {msg && <div className="note" role={msg.ok ? "status" : "alert"}>{msg.text}</div>}
      <div className="card">
        <h2>Responses by group</h2>
        <p className="muted small">Only groups with at least {m?.floor ?? 5} people invited are shown, and never who has or has not answered.</p>
        {!m ? <p className="muted">Loading…</p> : <>
          <table className="tbl"><thead><tr><th>Group</th><th>Invited</th><th>Started</th><th>Submitted</th><th>Rate</th></tr></thead>
            <tbody>{m.cohorts.map((c) => <tr key={c.cohort}><td>{c.cohort}</td><td>{c.invited}</td><td>{c.started}</td><td>{c.submitted}</td><td>{c.rate}%</td></tr>)}</tbody></table>
          {m.suppressed.cohorts > 0 && <p className="small muted" style={{ marginTop: 6 }}>{m.suppressed.cohorts} smaller group{m.suppressed.cohorts === 1 ? "" : "s"} ({m.suppressed.invited} people invited) not shown on their own.</p>}
          {m.daily.length > 0 && <p className="small muted" style={{ marginTop: 6 }}>Submitted by day: {m.daily.map((d) => `${day(d.day)} ${d.submitted}`).join(" · ")}</p>}
        </>}
      </div>

      <div className="card">
        <h2>Survey window</h2>
        {m && <p className="muted">Closes {day(m.window_close)}.{m.extensions.length ? ` Extended ${m.extensions.length} time${m.extensions.length === 1 ? "" : "s"}.` : ""}</p>}
        {m?.extensions.map((x) => <p key={x.seq} className="small">Extension {x.seq}: {x.working_days} working day{x.working_days === 1 ? "" : "s"}, {day(x.old_close)} to {day(x.new_close)}. {x.reason}</p>)}
        {consultant && open && (
          <form className="addbox" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); act(`${base}/extend`, { working_days: Number(f.get("days")), reason: f.get("reason") }, "Window extended."); }}>
            <p className="small muted">Extend as often as needed, for as long as needed (for example after a lockdown). Every extension is listed in the technical appendix.</p>
            <div className="formgrid">
              <div className="field"><label className="flab" htmlFor="xd">Working days</label><input id="xd" name="days" type="number" min={1} max={365} defaultValue={5} required /></div>
              <div className="field"><label className="flab" htmlFor="xr">Reason</label><input id="xr" name="reason" required minLength={3} maxLength={1000} /></div>
            </div>
            <button className="btn gold sm" style={{ marginTop: 10 }}>Extend the window</button>
          </form>)}
      </div>

      {consultant && open && q && (
        <div className="card">
          <h2>Data quality</h2>
          <p className="muted">{q.submitted} submitted · median time {mins(q.median_seconds)} · {Object.entries(q.flags).map(([k, n]) => `${k.toLowerCase().replace(/_/g, " ")} ${n}`).join(" · ") || "no quality flags"}</p>
          {q.flagged.length > 0 && <table className="tbl" style={{ marginTop: 8 }}><thead><tr><th>Response</th><th>Flags</th><th>Time</th></tr></thead>
            <tbody>{q.flagged.map((f) => <tr key={f.response_id}><td className="mono small">{f.response_id}</td><td>{f.flags.join(", ").toLowerCase().replace(/_/g, " ")}{f.excluded ? " (excluded by the rules)" : ""}</td><td>{mins(f.duration_seconds)}</td></tr>)}</tbody></table>}
          <p className="small muted" style={{ marginTop: 6 }}>Flags are information only. Nobody can void or change a response: what people key in is what is analysed.</p>
        </div>)}

      {consultant && frozen && leaders.length > 0 && <Comments base={base} leaders={leaders} />}
    </>
  );
}

// 360 rater comments: read each, keep it or redact what could identify someone. The original stays in the encrypted store.
function Comments({ base, leaders }: { base: string; leaders: { id: string; name: string }[] }) {
  const [asg, setAsg] = useState(leaders[0].id);
  const [list, setList] = useState<Comment[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => { const r = await fetch(`${base}/comments?assignment=${asg}`, { cache: "no-store" }); setList(r.ok ? (await r.json()).comments : []); }, [base, asg]);
  useEffect(() => { load(); }, [load]);
  const review = async (c: Comment, redacted: string | null) => { const e = await send(`${base}/comments`, { comment_id: c.comment_id, redacted }); setErr(e ?? ""); if (!e) load(); };
  return (
    <div className="card">
      <h2>360 comments for review</h2>
      <p className="muted small">The leader sees a comment only after you review it. Redact anything that could identify a rater or another person.</p>
      <label className="flab" htmlFor="cl">Leader</label>
      <select id="cl" value={asg} onChange={(e) => setAsg(e.target.value)}>{leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      {err && <p className="small" role="alert">{err}</p>}
      {!list ? <p className="muted">Loading…</p> : !list.length ? <p className="muted">No rater comments for this leader.</p> : list.map((c) => (
        <form key={c.comment_id} className="addbox" onSubmit={(e) => { e.preventDefault(); const t = String(new FormData(e.currentTarget).get("red") ?? "").trim(); review(c, t && t !== c.body ? t : null); }}>
          <p className="small"><b>{c.question_code}</b>{c.reviewed ? " · reviewed" : ""}</p>
          <p>{c.body}</p>
          <label className="flab" htmlFor={`r-${c.comment_id}`}>Text the leader sees</label>
          <textarea id={`r-${c.comment_id}`} name="red" rows={2} maxLength={2000} defaultValue={c.redacted ?? c.body} style={{ width: "100%" }} />
          <button className="btn ghost sm" style={{ marginTop: 6 }}>{c.reviewed ? "Save again" : "Mark reviewed"}</button>
        </form>))}
    </div>
  );
}
