"use client";

import { useState } from "react";
import { useCall } from "@/lib/use-call";

export const DECISION: Record<string, string> = {
  CONTINUE: "Continue as planned", ADJUST_INTERVENTION: "Adjust the intervention", ADJUST_RESOURCING: "Adjust the resourcing", SUSPEND_AND_REDIAGNOSE: "Suspend and rediagnose",
  RETIRE_AND_REINSTATE_PRECONDITION: "Retire and reinstate the pre-condition", RETIRE_SUPERSEDED: "Retire: the finding is superseded", REASSIGN_WITHIN_14_DAYS: "Reassign within 14 days", RETIRE_NOT_ACHIEVED: "Retire: not achieved",
};
type Rec = { decision: string; inputs: { kpi_direction: string; progress: string | null; readings: number; precondition_open: boolean; owner_present: boolean; adjustments_without_movement: number } };

// The adjust or retire review of one action (engine adjustOrRetire). The consultant answers the two judgements the platform cannot know,
// reads the engine's recommendation with the inputs behind it, then confirms it or chooses another decision with a reason.
export function ReviewPanel({ actionId, done }: { actionId: string; done: string[] }) {
  const { busy, run, note } = useCall();
  const points = ["+90d", "+180d"].filter((p) => !done.includes(p));
  const [point, setPoint] = useState(points[0] ?? "+90d");
  const [m, setM] = useState<"1" | "0">("1");
  const [f, setF] = useState<"1" | "0">("1");
  const [rec, setRec] = useState<Rec | null>(null);
  const [pick, setPick] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const look = async () => {
    setErr(""); setRec(null); setPick("");
    const r = await fetch(`/v1/actions/${actionId}/review?milestones_on_track=${m}&finding_supported=${f}`).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok) return setErr(j?.title ?? "That did not work. Check your connection.");
    setRec(j);
  };
  if (!points.length) return <p className="ssmall smuted" style={{ marginTop: 10 }}>Both reviews are recorded.</p>;
  const chosen = pick || rec?.decision || "";
  const differs = !!rec && chosen !== rec.decision;
  const i = rec?.inputs;
  return (
    <div style={{ marginTop: 12, padding: 12, border: "1px solid var(--line, #e7e2d8)", borderRadius: 10 }}>
      <div className="flab" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--grey)", marginBottom: 6 }}>Adjust or retire review</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="ssmall">Review point<br /><select value={point} onChange={(e) => setPoint(e.target.value)}>{points.map((p) => <option key={p} value={p}>{p === "+90d" ? "90 days" : "180 days"}</option>)}</select></label>
        <label className="ssmall">Milestones on track?<br /><select value={m} onChange={(e) => { setM(e.target.value as "1" | "0"); setRec(null); }}><option value="1">Yes</option><option value="0">No</option></select></label>
        <label className="ssmall">Is the finding still supported?<br /><select value={f} onChange={(e) => { setF(e.target.value as "1" | "0"); setRec(null); }}><option value="1">Yes</option><option value="0">No</option></select></label>
        <button type="button" className="sbtn ghost" onClick={look}>See the engine&rsquo;s recommendation</button>
      </div>
      {err && <p className="ssmall" role="alert" style={{ color: "var(--bad)", marginTop: 6 }}>{err}</p>}
      {rec && i && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <p className="ssmall"><b>Engine recommends: {DECISION[rec.decision]}.</b> KPI direction {i.kpi_direction.toLowerCase()}
            {i.progress !== null ? ` (${Math.round(Number(i.progress) * 100)}% of the way, ${i.readings} readings)` : " (no usable readings)"} · owner {i.owner_present ? "set" : "missing"} · pre-condition {i.precondition_open ? "open" : "clear"} · {i.adjustments_without_movement} earlier adjustment{i.adjustments_without_movement === 1 ? "" : "s"}.</p>
          <p className="ssmall smuted">Movement and delivery are shown side by side. This does not claim that the action caused the movement.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select aria-label="Decision" value={chosen} onChange={(e) => setPick(e.target.value)}>{Object.entries(DECISION).map(([k, v]) => <option key={k} value={k}>{v}{k === rec.decision ? " (engine)" : ""}</option>)}</select>
            {differs && <input aria-label="Reason for overriding the engine" placeholder="Reason for choosing a different decision (required)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} style={{ flex: "1 1 260px" }} />}
            <button type="button" className="sbtn orange" disabled={busy || (differs && reason.trim().length < 3)}
              onClick={async () => {
                if (!confirm(`Record this review: ${DECISION[chosen]}? It cannot be changed afterwards.`)) return;
                if (await run(`/v1/actions/${actionId}/review`, "POST", { review_point: point, milestones_on_track: m === "1", finding_supported: f === "1", decision: chosen, reason: reason.trim() || undefined }, "Review recorded.")) setRec(null);
              }}>Record the review</button>
            {note}
          </div>
        </div>
      )}
    </div>
  );
}
