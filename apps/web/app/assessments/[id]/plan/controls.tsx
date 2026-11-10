"use client";

import { useState } from "react";
import { ACCEPT, MAX_BYTES, TYPES } from "@/lib/evidence-files";
import { api } from "@/lib/api";
import { useCall } from "@/lib/use-call";



export function BuildPlan({ assessmentId }: { assessmentId: string }) {
  const { busy, run, note } = useCall();
  return <div className="stf-next"><span className="k">Next step</span>
    <button className="sbtn orange" disabled={busy} onClick={() => run(`/v1/assessments/${assessmentId}/plan`, "POST", {}, "Plan created.")}>{busy ? "Building…" : "Build the action plan"}</button>{note}</div>;
}

export function CompleteP0({ assessmentId, version, itemId }: { assessmentId: string; version: number; itemId: string }) {
  const { busy, run, note } = useCall();
  const [text, setText] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(`/v1/assessments/${assessmentId}/p0/${itemId}`, "POST", { score_version: version, note: text }, "Recorded."); }}
      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <input aria-label="What was done" placeholder="What was done (required)" value={text} onChange={(e) => setText(e.target.value)} minLength={3} maxLength={1000} required style={{ flex: "1 1 260px" }} />
      <button className="sbtn ghost" disabled={busy || text.trim().length < 3}>Mark done</button>{note}
    </form>
  );
}

const LABEL: Record<string, string> = {
  IN_REVIEW: "Send for review", IN_CO_DESIGN: "Start co-design", APPROVED: "Approve", PUBLISHED: "Publish", IN_PROGRESS: "Start",
  UNDER_REVIEW: "Send for review", CLOSED: "Close", RETIRED: "Retire", DISCARDED: "Discard",
};
const NEEDS_REASON = new Set(["DISCARDED", "RETIRED"]);

export type ActionView = {
  action_id: string; status: string; owner: string | null; sponsor: string | null; kpi: string | null; baseline_value: string | null; target_value: string | null;
  budget_amount: number | null; start_date: string; end_date: string; horizon: string; client_horizon?: string | null; client_decision?: string | null;
};

/** The client puts the priorities in its own order. Up and down buttons keep it simple and work with a keyboard; the database checks the order. */
export function RankPriorities({ assessmentId, version, items }: { assessmentId: string; version: number; items: { id: string; label: string; held: boolean }[] }) {
  const { busy, run, note } = useCall();
  const [list, setList] = useState(items);
  const move = (i: number, d: number) => setList((l) => { const n = [...l], j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const bad = list.some((x, i) => !x.held && list.slice(0, i).some((y) => y.held));
  return (
    <div>
      <ol style={{ margin: "6px 0 10px 18px", display: "grid", gap: 6 }}>
        {list.map((x, i) => (
          <li key={x.id}><span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><strong>{x.label}</strong>{x.held && <span className="stag orange">Held</span>}
            <button type="button" className="sbtn ghost" aria-label={`Move ${x.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>Up</button>
            <button type="button" className="sbtn ghost" aria-label={`Move ${x.label} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>Down</button></span></li>
        ))}
      </ol>
      {bad && <p className="ssmall" role="alert" style={{ color: "var(--bad)" }}>A held priority cannot rank above one that is not held. Move the held ones down.</p>}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}><button className="sbtn orange" disabled={busy || bad}
        onClick={() => run(`/v1/assessments/${assessmentId}/plan/order`, "PUT", { version, ranking: list.map((x) => x.id) }, "Order saved.")}>Save my order</button>{note}</div>
    </div>
  );
}

export function ActionControls({ a, moves, canEdit, canTrack, canMark = false, clientOwned = false, kpiOptions = [] }: { a: ActionView; moves: string[]; canEdit: boolean; canTrack: boolean; canMark?: boolean; clientOwned?: boolean; kpiOptions?: string[] }) {
  const edit = useCall(), move = useCall(), read = useCall(), ev = useCall(), mark = useCall();
  const [up, setUp] = useState("");
  const [reason, setReason] = useState("");
  const base = `/v1/actions/${a.action_id}`;
  const today = new Date().toISOString().slice(0, 10);
  const field = (name: keyof ActionView, label: string, type = "text") => (
    <div className="field"><label className="flab" htmlFor={`${a.action_id}-${name}`}>{label}</label>
      <input id={`${a.action_id}-${name}`} name={name} type={type} defaultValue={(a[name] ?? "") as string} inputMode={type === "number" ? "decimal" : undefined} step={type === "number" ? "any" : undefined} /></div>
  );
  return (
    <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
      {canEdit && (
        <form onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const fields = Object.fromEntries(["owner", "sponsor", "kpi", "baseline_value", "target_value", "budget_amount", "start_date", "end_date"].map((k) => [k, String(f.get(k) ?? "").trim() || null]));
          if (!fields.start_date) delete fields.start_date;
          if (!fields.end_date) delete fields.end_date;
          edit.run(base, "PATCH", { fields });
        }}>
          <div className="formgrid">
            {field("owner", "Owner")}{field("sponsor", "Sponsor")}
            <div className="field full"><label className="flab" htmlFor={`${a.action_id}-kpi`}>KPI</label><input id={`${a.action_id}-kpi`} name="kpi" defaultValue={a.kpi ?? ""} list={kpiOptions.length ? `${a.action_id}-kpis` : undefined} />{kpiOptions.length > 0 && <datalist id={`${a.action_id}-kpis`}>{kpiOptions.map((k) => <option key={k} value={k} />)}</datalist>}</div>
            {field("baseline_value", "Baseline", "number")}{field("target_value", "Target", "number")}
            {field("start_date", "Start", "date")}{field("end_date", "End", "date")}
            {a.horizon === "STRUCTURAL_12M_PLUS" && field("budget_amount", "Budget", "number")}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}><button className="sbtn ghost" disabled={edit.busy}>Save details</button>{edit.note}</div>
        </form>
      )}
      {canMark && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="ssmall"><strong>When:</strong></span>
          {(["NOW", "NEXT", "LATER"] as const).map((h) => (
            <button key={h} type="button" className={`sbtn ${a.client_horizon === h ? "orange" : "ghost"}`} aria-pressed={a.client_horizon === h} disabled={mark.busy}
              onClick={() => mark.run(base, "PATCH", { client: { horizon: a.client_horizon === h ? null : h } }, "Saved.")}>{h === "NOW" ? "Now" : h === "NEXT" ? "Next" : "Later"}</button>
          ))}
          {a.status === "IN_CO_DESIGN" && <button type="button" className="sbtn ghost" disabled={mark.busy}
            onClick={() => mark.run(base, "PATCH", { client: { decision: a.client_decision === "DEFERRED" ? null : "DEFERRED" } }, a.client_decision === "DEFERRED" ? "Back on the plan." : "Deferred.")}>{a.client_decision === "DEFERRED" ? "Undo defer" : "Defer"}</button>}
          {mark.note}
        </div>
      )}
      {moves.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {moves.some((m) => NEEDS_REASON.has(m)) && <input aria-label="Reason" placeholder="Reason (needed to discard or retire)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} style={{ flex: "1 1 220px" }} />}
          {moves.map((m) => (
            <button key={m} className={`sbtn ${NEEDS_REASON.has(m) ? "ghost" : "orange"}`} disabled={move.busy || (NEEDS_REASON.has(m) && reason.trim().length < 3)}
              onClick={() => move.run(base, "PATCH", { to: m, reason: reason.trim() || undefined }, "Moved.")}>{m === "APPROVED" && clientOwned ? "Accept" : LABEL[m] ?? m}</button>
          ))}
          {move.note}
        </div>
      )}
      {canTrack && ["PUBLISHED", "IN_PROGRESS", "UNDER_REVIEW"].includes(a.status) && (
        <div className="formgrid">
          <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); read.run(`${base}/kpi-readings`, "POST", { value: f.get("value"), read_on: f.get("read_on"), note: f.get("note") || undefined }, "Reading added."); }}>
            <div className="flab" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--grey)", marginBottom: 4 }}>Add a KPI reading</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input name="value" aria-label="Value" placeholder="Value" inputMode="decimal" required style={{ width: 110 }} />
              <input name="read_on" aria-label="Date" type="date" defaultValue={today} max={today} required style={{ width: 160 }} />
              <input name="note" aria-label="Note" placeholder="Note" maxLength={500} style={{ flex: 1, minWidth: 120 }} />
              <button className="sbtn ghost" disabled={read.busy}>Add</button>
            </div>{read.note}
          </form>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget, f = new FormData(form);
            const file = f.get("file") as File | null;
            const body: Record<string, unknown> = { kind: f.get("kind"), description: f.get("description"), link: f.get("link") || undefined };
            if (file && file.size) {
              if (file.size > MAX_BYTES || !TYPES[file.type]) return setUp("Upload a PDF, Word, Excel, PowerPoint, PNG or JPG file of up to 20 MB.");
              setUp("Uploading…");
              const t = await api("POST", `${base}/evidence/upload`, { file_name: file.name, size: file.size, content_type: file.type }).catch(() => null);
              const tj = t ? await t.json().catch(() => null) : null;
              if (!t?.ok) return setUp(tj?.title ?? "The upload could not start.");
              const put = await fetch(tj.url, { method: "PUT", headers: { "content-type": file.type }, body: file }).catch(() => null);
              if (!put?.ok) return setUp("The upload failed. Check your connection and try again.");
              body.file_key = tj.key; body.file_name = file.name; delete body.link;
            }
            setUp("");
            if (await ev.run(`${base}/evidence`, "POST", body, "Evidence added.")) form.reset();
          }}>
            <div className="flab" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--grey)", marginBottom: 4 }}>Add evidence</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <select name="kind" aria-label="Kind" style={{ width: 140 }}><option value="DOCUMENT">Document</option><option value="MINUTES">Minutes</option><option value="KPI_REPORT">KPI report</option></select>
              <input name="description" aria-label="Description" placeholder="What it shows" minLength={3} maxLength={1000} required style={{ flex: 1, minWidth: 140 }} />
              <input name="link" aria-label="Link" type="url" placeholder="https://… (or attach a file)" pattern="https://.*" style={{ flex: 1, minWidth: 140 }} />
              <input name="file" aria-label="File" type="file" accept={ACCEPT} style={{ flex: "1 1 100%" }} />
              <button className="sbtn ghost" disabled={ev.busy || up === "Uploading…"}>Add</button>
            </div>{up && <span className="ssmall" role="status">{up}</span>}{ev.note}
          </form>
        </div>
      )}
    </div>
  );
}
