"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const GROUPS = [["SUPERIOR", "Manager"], ["PEER", "Peer"], ["DIRECT_REPORT", "Direct report"], ["OTHER", "Other"]] as const;
interface Row { person_id: string; rater_group: string; status: string; approved: boolean }
interface Leader { assignment_id: string; team: string; name: string; canPropose: boolean; canApprove: boolean; canWindow: boolean; window: { opens_on: string; closes_on: string } | null; rows: Row[]; defaults: { superior: string | null; direct_reports: string[]; peers: string[] } | null }

export default function RatersClient({ assessmentId, asmWindow, leaders, options, labels, canAssign = false }: { canAssign?: boolean; assessmentId: string; asmWindow: { open: string | null; close: string | null }; leaders: Leader[]; options: { person_id: string; label: string }[]; labels: Record<string, string> }) {
  if (!leaders.length) return <div className="card"><p className="muted">No leaders are in scope for you on this assessment.</p></div>;
  return <>{canAssign && <AutoAssign assessmentId={assessmentId} />}{leaders.map((l) => <LeaderCard key={l.assignment_id} assessmentId={assessmentId} asmWindow={asmWindow} l={l} options={options} labels={labels} />)}</>;
}

// The system chooses the peers and direct reports of every leader at random and balanced (owner ruling 22 Oct 2026). The supervisor is chosen by
// the Client Admin on each leader first; the route refuses until every leader has one. Repeating it gives the same choice.
function AutoAssign({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setMsg(null);
    const r = await api("POST", `/v1/assessments/${assessmentId}/l360/assign`, {});
    const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j?.title ?? "That did not work." });
    const short = (j.below_floor ?? []).length;
    setMsg({ ok: true, text: `Raters chosen for ${j.assigned} leader${j.assigned === 1 ? "" : "s"}.${j.skipped_already_invited ? ` ${j.skipped_already_invited} left alone because their raters were already invited.` : ""}${short ? ` ${short} group${short === 1 ? " has" : "s have"} fewer than ${j.floor} people and will be merged in the results.` : ""}` });
    router.refresh();
  }
  return (
    <div className="card">
      <h2>Choose raters automatically</h2>
      <p className="muted small">Pick a supervisor for every leader first. The system then chooses each leader&apos;s peers (other leaders, the same department first) and direct reports (their own team) at random and evenly, so nobody rates more than three leaders. Choosing again gives the same result.</p>
      {msg && <div className={`note${msg.ok ? " blue" : ""}`} role="status">{msg.text}</div>}
      <button className="btn gold" disabled={busy} onClick={run}>Choose peers and direct reports</button>
    </div>
  );
}

function LeaderCard({ assessmentId, asmWindow, l, options, labels }: { assessmentId: string; asmWindow: { open: string | null; close: string | null }; l: Leader; options: { person_id: string; label: string }[]; labels: Record<string, string> }) {
  const router = useRouter();
  const waiting = l.rows.filter((r) => r.status === "PROPOSED");
  const fixed = l.rows.filter((r) => r.status !== "PROPOSED");
  const [rows, setRows] = useState<{ person_id: string; rater_group: string }[]>(waiting.map((r) => ({ person_id: r.person_id, rater_group: r.rater_group })));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [wo, setWo] = useState(l.window?.opens_on ?? ""), [wc, setWc] = useState(l.window?.closes_on ?? "");
  const taken = new Set([...fixed.map((r) => r.person_id), ...rows.map((r) => r.person_id)]);
  const peers = fixed.filter((r) => r.rater_group === "PEER").length + rows.filter((r) => r.rater_group === "PEER").length;

  async function send(fn: () => Promise<Response>, done: string) {
    setBusy(true); setMsg(null);
    const r = await fn(); const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j?.title ?? "That did not work." });
    setMsg({ ok: true, text: done }); router.refresh();
  }
  const fill = () => {
    const d = l.defaults; if (!d) return;
    const next = [...(d.superior ? [{ person_id: d.superior, rater_group: "SUPERIOR" }] : []), ...d.direct_reports.map((p) => ({ person_id: p, rater_group: "DIRECT_REPORT" })), ...d.peers.map((p) => ({ person_id: p, rater_group: "PEER" }))];
    setRows(next.filter((x) => !fixed.some((f) => f.person_id === x.person_id)));
  };
  const label = (id: string) => labels[id] ?? id;

  return (
    <div className="card">
      <div className="sectionhead"><h2>{l.name}</h2><span className="small muted">{l.team}</span></div>
      {fixed.length > 0 && <p className="small" style={{ marginBottom: 8 }}><b>Approved or invited:</b> {fixed.map((r) => `${label(r.person_id)} (${GROUPS.find((g) => g[0] === r.rater_group)?.[1]})`).join(", ")}</p>}
      {l.canPropose && (
        <>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 160px auto", gap: 8, marginBottom: 6 }}>
              <select aria-label="Rater" value={r.person_id} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, person_id: e.target.value } : x)))}>
                <option value="">Choose a person…</option>
                {options.filter((o) => o.person_id === r.person_id || !taken.has(o.person_id)).map((o) => <option key={o.person_id} value={o.person_id}>{o.label}</option>)}
              </select>
              <select aria-label="Relationship" value={r.rater_group} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, rater_group: e.target.value } : x)))}>
                {GROUPS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <button type="button" className="btn ghost sm" aria-label="Remove rater" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn ghost sm" onClick={() => setRows([...rows, { person_id: "", rater_group: "PEER" }])}>Add a rater</button>
            <button type="button" className="btn ghost sm" onClick={fill}>Fill from the organisation</button>
            <button type="button" className="btn gold sm" disabled={busy} onClick={() => send(() => api("PUT", `/v1/assessments/${assessmentId}/l360/proposals`, { assignment_id: l.assignment_id, raters: rows.filter((x) => x.person_id) }), "Proposal saved. It now waits for approval.")}>Save the proposal</button>
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>Defaults: the line manager, everyone in the team, and peers suggested from teams under the same parent. Peers must be 3 to 8 (now {peers}).</p>
        </>
      )}
      {!l.canPropose && waiting.length > 0 && <p className="small"><b>Proposed:</b> {waiting.map((r) => `${label(r.person_id)} (${GROUPS.find((g) => g[0] === r.rater_group)?.[1]})`).join(", ")}</p>}
      {l.canApprove && waiting.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
          <button type="button" className="btn gold sm" disabled={busy} onClick={() => send(() => api("POST", `/v1/assessments/${assessmentId}/l360/proposals`, { assignment_id: l.assignment_id, decision: "APPROVE" }), "Approved.")}>Approve the proposal</button>
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => send(() => api("POST", `/v1/assessments/${assessmentId}/l360/proposals`, { assignment_id: l.assignment_id, decision: "REJECT" }), "Sent back. The leader can propose again.")}>Send back</button>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <span className="flab">Rater window</span>
        {l.canWindow ? (
          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
            <div className="field"><label className="flab" htmlFor={`wo-${l.assignment_id}`}>Opens</label><input id={`wo-${l.assignment_id}`} type="date" min={asmWindow.open ?? undefined} max={asmWindow.close ?? undefined} value={wo} onChange={(e) => setWo(e.target.value)} /></div>
            <div className="field"><label className="flab" htmlFor={`wc-${l.assignment_id}`}>Closes</label><input id={`wc-${l.assignment_id}`} type="date" min={asmWindow.open ?? undefined} max={asmWindow.close ?? undefined} value={wc} onChange={(e) => setWc(e.target.value)} /></div>
            <button type="button" className="btn ghost sm" disabled={busy || !wo || !wc} onClick={() => send(() => api("PUT", `/v1/assessments/${assessmentId}/l360/windows`, { assignment_id: l.assignment_id, opens_on: wo, closes_on: wc }), "Rater window saved.")}>Save the window</button>
            {l.window && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => send(() => api("PUT", `/v1/assessments/${assessmentId}/l360/windows`, { assignment_id: l.assignment_id, opens_on: null, closes_on: null }), "Rater window removed.").then(() => { setWo(""); setWc(""); })}>Remove</button>}
          </div>
        ) : null}
        <p className="small muted" style={{ marginTop: 4 }}>{l.window ? `Raters can answer from ${l.window.opens_on} to ${l.window.closes_on}.` : "No separate window: raters can answer for the whole assessment window."}{asmWindow.open && asmWindow.close ? ` It must sit inside the assessment window (${asmWindow.open} to ${asmWindow.close}). Links are issued from the opening day and stop working after the closing day.` : ""}</p>
      </div>
      {msg && <p className="small" role={msg.ok ? "status" : "alert"} style={{ marginTop: 8 }}>{msg.text}</p>}
    </div>
  );
}
