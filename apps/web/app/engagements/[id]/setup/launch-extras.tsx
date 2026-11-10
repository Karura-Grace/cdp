"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Launch panel for the setup page (journey 1, launch slice). It loads its own data from /v1/assessments/{id}/launch-state, so the setup
// page needs only the one line that mounts it. Sections: assessment version, launch approval, the DRAFT staff message templates,
// pre-flight detail (cohorts, L7, L8), reminders scheduled, tenant calendar, and the completion time statement once the survey is open.

interface Row { kind: string; on: string; audience: string; outside_window: boolean }
interface State {
  assessment: { assessment_id: string; status: string; window_open: string; window_close: string; supersedes: string | null; version_reason: string | null; setup_version: number; completion_estimate_text: string | null; staff_message_text: string | null; staff_message_edited_after_launch: boolean };
  approval: { needed: boolean; approved_by: string | null; approved_at: string | null };
  template: { version: string; approved: boolean; gaps: string[]; in_use: string | null; anonymity: string | null; drafts: Record<string, string> };
  section_i: { hints: string[]; has_section: boolean; payload: Record<string, unknown>; workshop_date: string | null; participants: string[]; status: string | null };
  reminders: Row[];
  calendar: { holidays: { day: string; label: string }[]; review_start: string | null; review_end: string | null };
  extras: { l7: { missing_email: string[]; not_on_list: string[]; no_longer_active: string[]; active: number; declared_headcount: number | null; count: number };
    l8: { inScope: boolean; leaders: { assignment_id: string; team_key: string; ok: boolean; reasons: string[] }[] }; cohorts: { name: string; size: number; rollup: boolean; ok: boolean }[] } | null;
  completion: { complete: number; median_seconds: number | null; needs_update: boolean } | null;
}

const human = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const AUDIENCE: Record<string, string> = { NOT_SUBMITTED: "people who have not submitted", STARTED_NOT_SUBMITTED: "people who started and have not submitted" };

export default function LaunchExtras({ engagementId, assessmentId, state: engState, locked }: { engagementId: string; assessmentId: string; state: string; locked: boolean }) {
  const router = useRouter();
  const [s, setS] = useState<State | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hol, setHol] = useState<{ day: string; label: string }[]>([]);
  const [rs, setRs] = useState(""), [re, setRe] = useState("");
  const [newHol, setNewHol] = useState({ day: "", label: "" });

  const load = useCallback(async () => {
    const r = await api("GET", `/v1/assessments/${assessmentId}/launch-state`);
    if (!r.ok) return setMsg({ ok: false, text: "The launch details could not be loaded." });
    const j = (await r.json()) as State;
    setS(j); setHol(j.calendar.holidays); setRs(j.calendar.review_start ?? ""); setRe(j.calendar.review_end ?? "");
  }, [assessmentId]);
  useEffect(() => { load(); }, [load]);

  async function act(fn: () => Promise<Response>, done: string, then?: () => void) {
    setBusy(true); setMsg(null);
    const r = await fn(); const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: (Array.isArray(j?.errors) ? (j.errors as string[])[0] : j?.title) ?? "That did not work." });
    setMsg({ ok: true, text: done }); then?.(); await load(); router.refresh();
  }

  if (!s) return <div className="card"><div className="sectionhead"><h2>Launch details</h2></div><p className="muted">{msg?.text ?? "Loading…"}</p></div>;
  const a = s.assessment, draft = a.status === "DRAFT", editable = draft && engState === "SETUP" && !locked;
  // after launch the calendar and the staff message wording stay open as audited text only edits (owner decision, 18 October 2026)
  const calEditable = editable || a.status === "LAUNCHED";
  const anon = (s.template.anonymity ?? "FULL") as string;

  const useTemplate = () => {
    const si = s.section_i;
    const base = si.has_section ? si.payload : { anonymity: "FULL", languages: ["en"], qualitative: "NONE", completion_estimate: "35–45 minutes", reminder_plan: "STANDARD" };
    return act(() => api("PUT", `/v1/engagements/${engagementId}/setup/I`, { payload: { ...base, anonymity: anon, staff_message: s.template.drafts[anon], staff_message_checked: true }, workshop_date: si.workshop_date, participants: si.participants }),
      "The DRAFT template is now the staff message in Section I. Section I is back to Draft: agree it again.");
  };
  const saveCalendar = () => act(() => api("PUT", `/v1/engagements/${engagementId}/calendar`, { holidays: hol, review_period_start: rs || null, review_period_end: re || null }), "Calendar saved.");

  return (
    <>
      {msg && <div className={msg.ok ? "note blue" : "note"} role={msg.ok ? "status" : "alert"}><b>{msg.text}</b></div>}

      <div className="card">
        <div className="sectionhead"><h2>Assessment version</h2><span className="tag grey">Version {a.setup_version}</span></div>
        <p className="muted">{a.supersedes ? <>This assessment replaces an earlier version. Reason recorded: <b>{a.version_reason}</b>.</> : "This is the first version of the assessment for this engagement."}</p>
        {draft && s.approval && (
          <p className="small muted" style={{ marginTop: 6 }}>
            Launch approval: {s.approval.approved_by ? `recorded ${s.approval.approved_at?.slice(0, 10)}` : "not recorded"}. {s.approval.needed ? "Launch needs it." : "Launch does not need it for now (consultant only); recording it is optional."}{" "}
            {!s.approval.approved_by && <button className="btn ghost sm" disabled={busy} onClick={() => act(() => api("POST", `/v1/assessments/${assessmentId}/approve-launch`), "Launch approval recorded.")}>Record my approval</button>}
          </p>
        )}
        {a.status === "LAUNCHED" && (
          <form className="addbox" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (confirm("Create a new assessment version? The launched assessment is replaced, setup opens again, and you must agree the changed sections and launch again. Survey links already issued stop working.")) act(() => api("POST", `/v1/assessments/${assessmentId}/new-version`, { reason: f.get("reason") }), "A new draft version was created. Setup is open again."); }}>
            <div className="field"><label className="flab" htmlFor="nv-reason">Change a scoring relevant setup field after launch (cohorts, requirements, business model, target orientation)</label>
              <input id="nv-reason" name="reason" required minLength={3} maxLength={500} placeholder="Reason for the new version (required, shown in the technical appendix)" /></div>
            <button className="btn ghost sm" style={{ marginTop: 10 }} disabled={busy}>Create a new version</button>
            <p className="small muted" style={{ marginTop: 6 }}>Only possible while nobody has submitted. Calendar edits and staff message wording do not need a new version: they are text only edits, saved and audited below.</p>
          </form>
        )}
      </div>

      {draft && (
        <div className="card">
          <div className="sectionhead"><h2>Staff message</h2><span className={`tag ${s.template.approved ? "ok" : "warn"}`}>{s.template.approved ? "Template approved" : "DRAFT templates, not yet approved"}</span></div>
          <p className="muted">The two templates below are <b>DRAFT</b> wording. Launch is blocked until the owner approves both templates, whether or not you use one or edit it. The choice in I2 sets which template you get. A word scan warns when the message seems to leave out the purpose, how results are used, the anonymity commitment or what happens next; it only warns, your tick in Section I is the rule.</p>
          <p className="small muted" style={{ marginTop: 6 }}>In use now: {s.template.in_use ? `the ${human(s.template.in_use)} template${s.template.in_use !== anon ? `, but I2 says ${human(anon)}` : ""}` : "your own text, or none yet"}.</p>
          <details style={{ marginTop: 8 }}><summary className="small" style={{ cursor: "pointer" }}>Read both templates (DRAFT)</summary>
            {Object.entries(s.template.drafts).map(([k, t]) => <div key={k} style={{ marginTop: 10 }}><b>{human(k)}</b> <span className="tag warn">DRAFT</span><pre style={{ whiteSpace: "pre-wrap", font: "inherit", margin: "6px 0 0" }}>{t}</pre></div>)}
          </details>
          {editable && <button className="btn ghost sm" style={{ marginTop: 10 }} disabled={busy} onClick={useTemplate}>Use the {human(anon)} template as the staff message</button>}
          {s.template.gaps.length > 0 && <div className="note" style={{ marginTop: 10 }}><b>Staff message warning:</b> it does not seem to state {s.template.gaps.join(", ")}. <span className="small">A warning only.</span></div>}
          {s.section_i.hints.length > 0 && <div className="note" style={{ marginTop: 10 }}><b>Qualitative complement:</b> {s.section_i.hints.join(" ")} <span className="small">A hint only.</span></div>}
        </div>
      )}

      {draft && s.extras && (
        <div className="card">
          <div className="sectionhead"><h2>Launch check detail</h2></div>
          <h3 style={{ marginBottom: 4 }}>I1 Cohort sizes</h3>
          {s.extras.cohorts.length === 0 ? <p className="muted">Section I has no cohorts yet.</p> : (
            <div className="tblwrap"><table className="tbl"><tbody>{s.extras.cohorts.map((c) => (
              <tr key={c.name}><td>{c.name}</td><td>{c.size} people</td><td style={{ textAlign: "right" }}>{c.ok ? <span className="tag ok">{c.rollup ? "Rolls up to parent" : "Large enough"}</span> : <span className="tag bad">Below the floor, blocks launch</span>}</td></tr>))}</tbody></table></div>
          )}
          <h3 style={{ margin: "14px 0 4px" }}>L7 Invitation list against active people</h3>
          <p className="muted">{s.extras.l7.count === 0 ? "The list matches the active people in scope." : `${s.extras.l7.count} difference${s.extras.l7.count === 1 ? "" : "s"} (a warning, not a block).`} {s.extras.l7.active} active people{s.extras.l7.declared_headcount ? `; the organisation record says a headcount of ${s.extras.l7.declared_headcount}` : ""}.</p>
          {([["missing_email", "Active but without a usable work email"], ["not_on_list", "Active but not on the invitation list"], ["no_longer_active", "On the invitation list but no longer active"]] as const).map(([k, l]) => s.extras!.l7[k].length > 0 && (
            <p key={k} className="small" style={{ marginTop: 4 }}><b>{l} ({s.extras!.l7[k].length}):</b> {s.extras!.l7[k].slice(0, 30).join(", ")}{s.extras!.l7[k].length > 30 ? " and more" : ""}</p>))}
          <h3 style={{ margin: "14px 0 4px" }}>L8 Leadership 360 raters</h3>
          {!s.extras.l8.inScope ? <p className="muted">No leaders are in scope, so there is nothing to configure.</p> : (
            <>
              <p className="muted">{s.extras.l8.leaders.filter((l) => !l.ok).length} of {s.extras.l8.leaders.length} leaders still need raters nominated and approved. This warns only: the 360 can start later in the window. <a href={`/engagements/${engagementId}/raters`}>Open the rater page</a>.</p>
              <div className="tblwrap"><table className="tbl"><tbody>{s.extras.l8.leaders.filter((l) => !l.ok).slice(0, 40).map((l) => <tr key={l.assignment_id}><td>{l.team_key}</td><td className="small muted">{l.reasons.join("; ")}</td></tr>)}</tbody></table></div>
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="sectionhead"><h2>Reminders scheduled</h2><span className="tag grey">{s.section_i.payload.reminder_plan === "CUSTOM" ? "Custom plan" : "Standard plan"}</span></div>
        <p className="muted">The dates the reminder plan produces for this window, skipping weekends and the public holidays below. Reminders stop when a person submits. Sending is done by the scheduler, which is not switched on yet, so nothing is sent from this list.</p>
        {s.reminders.length === 0 ? <p className="muted">No window yet.</p> : (
          <div className="tblwrap"><table className="tbl"><tbody>{s.reminders.map((r, i) => (
            <tr key={i}><td>{r.kind}</td><td>{r.on}</td><td className="small muted">to {AUDIENCE[r.audience] ?? r.audience}</td><td style={{ textAlign: "right" }}>{r.outside_window && <span className="tag bad">Outside the window</span>}</td></tr>))}</tbody></table></div>
        )}
      </div>

      <div className="card">
        <div className="sectionhead"><h2>Calendar</h2><span className={`tag ${hol.length ? "ok" : "warn"}`}>{hol.length ? `${hol.length} public holiday${hol.length === 1 ? "" : "s"}` : "No public holidays recorded"}</span></div>
        <p className="muted">Public holidays are entered here by the consultant; none are filled in for you. They are skipped when counting the survey window and placing reminders. The performance review period triggers a warning when the survey window overlaps it.</p>
        <div className="tblwrap"><table className="tbl"><tbody>
          {hol.map((h, i) => <tr key={h.day}><td style={{ width: 130 }}>{h.day}</td><td>{h.label}</td><td style={{ textAlign: "right" }}>{calEditable && <button className="btn ghost sm" aria-label={`Remove ${h.label}`} onClick={() => setHol(hol.filter((_, j) => j !== i))}>Remove</button>}</td></tr>)}
          {hol.length === 0 && <tr><td colSpan={3} className="muted">None yet.</td></tr>}
        </tbody></table></div>
        {calEditable && (
          <div className="addbox">
            <div className="formgrid">
              <div className="field"><label className="flab" htmlFor="h-day">Holiday date</label><input id="h-day" type="date" value={newHol.day} onChange={(e) => setNewHol({ ...newHol, day: e.target.value })} /></div>
              <div className="field"><label className="flab" htmlFor="h-name">Name</label><input id="h-name" maxLength={120} value={newHol.label} onChange={(e) => setNewHol({ ...newHol, label: e.target.value })} /></div>
            </div>
            <button type="button" className="btn ghost sm" style={{ marginTop: 10 }} disabled={!newHol.day || !newHol.label.trim() || hol.some((h) => h.day === newHol.day)}
              onClick={() => { setHol([...hol, { day: newHol.day, label: newHol.label.trim() }].sort((x, y) => x.day.localeCompare(y.day))); setNewHol({ day: "", label: "" }); }}>Add holiday</button>
            <div className="formgrid" style={{ marginTop: 14 }}>
              <div className="field"><label className="flab" htmlFor="r-s">Performance review period starts</label><input id="r-s" type="date" value={rs} onChange={(e) => setRs(e.target.value)} /></div>
              <div className="field"><label className="flab" htmlFor="r-e">Performance review period ends</label><input id="r-e" type="date" value={re} onChange={(e) => setRe(e.target.value)} /></div>
            </div>
            <button type="button" className="btn gold sm" style={{ marginTop: 12 }} disabled={busy} onClick={saveCalendar}>Save calendar</button>
          </div>
        )}
        {!calEditable && <p className="small muted" style={{ marginTop: 6 }}>Review period: {s.calendar.review_start ? `${s.calendar.review_start} to ${s.calendar.review_end}` : "not recorded"}. The calendar can no longer be changed.</p>}
        {a.status === "LAUNCHED" && <p className="small muted" style={{ marginTop: 6 }}>After launch, holiday and review period edits are saved as audited text only changes. They do not move the survey window or any link already issued.</p>}
      </div>

      {a.status === "LAUNCHED" && (
        <div className="card">
          <div className="sectionhead"><h2>Staff message wording</h2>{a.staff_message_edited_after_launch && <span className="tag grey">Edited after launch</span>}</div>
          <p className="muted">The wording can be changed while the survey is open. It is a text only edit, saved and audited, and it does not touch cohorts, anonymity or anything scoring reads. People see the new wording from now on.</p>
          <form className="addbox" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setMsg(null); const r = await api("PUT", `/v1/assessments/${assessmentId}/staff-message`, { text: f.get("text") }); const j = await r.json().catch(() => ({})); setBusy(false);
            if (!r.ok) return setMsg({ ok: false, text: j?.title ?? "That did not work." }); setMsg({ ok: true, text: `Wording saved.${Array.isArray(j.warnings) && j.warnings.length ? " Warning: " + j.warnings.join(" ") : ""}` }); await load(); router.refresh(); }}>
            <div className="field"><label className="flab" htmlFor="sm-text">Staff message</label><textarea id="sm-text" name="text" rows={8} required maxLength={3000} defaultValue={a.staff_message_text ?? ""} /></div>
            <button className="btn ghost sm" style={{ marginTop: 10 }} disabled={busy}>Save the wording</button>
          </form>
        </div>
      )}

      {a.status === "LAUNCHED" && s.completion && (
        <div className="card">
          <div className="sectionhead"><h2>Completion time statement</h2>{s.completion.needs_update && <span className="tag warn">Update suggested</span>}</div>
          <p className="muted">Respondents are told: <b>{a.completion_estimate_text ?? "35 to 45 minutes"}</b>. {s.completion.median_seconds === null
            ? `${s.completion.complete} response${s.completion.complete === 1 ? "" : "s"} so far; the measured median appears once enough have come in.`
            : `Measured median ${Math.round(s.completion.median_seconds / 60)} minutes over ${s.completion.complete} responses.`}
            {s.completion.needs_update && " After 30 responses the median is outside 30 to 50 minutes, so update the statement for future reminders."}</p>
          <form className="addbox" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); act(() => api("PUT", `/v1/assessments/${assessmentId}/completion-estimate`, { text: f.get("text") }), "Statement updated."); }}>
            <div className="field" style={{ maxWidth: 320 }}><label className="flab" htmlFor="ce">New statement</label><input id="ce" name="text" required maxLength={60} defaultValue={a.completion_estimate_text ?? ""} placeholder="for example 40 to 50 minutes" /></div>
            <button className="btn ghost sm" style={{ marginTop: 10 }} disabled={busy}>Update the statement</button>
          </form>
        </div>
      )}
    </>
  );
}
