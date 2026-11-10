import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { State } from "@/components/state";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import * as E from "@pac/cdp-engine";
import { human } from "@/lib/format";
import type { Deltas } from "@/lib/trend";
import { baselineOf, changeOf, readingValue, refLabel, watchlistOf } from "@/lib/pulse";
import { emailConfigured } from "@/lib/email";
import { rolloverPreview } from "@/lib/rollover";
import { CheckTriggers, CompareButton, DecideTrigger, OrgChangeForm, PulseActions, PulseBuilder, RolloverButton } from "./measure-client";
import "../../../console.css";

export const metadata: Metadata = { title: "Measure | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

const ORIENT = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"] as const;
const DOT: Record<string, string> = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
const two = (s: string | null) => (s === null ? "–" : E.q(E.D(s), 2).toString());
const sign = (s: string | null) => (s === null ? "–" : Number(s) > 0 ? `+${s}` : s);
const CHANGE: Record<string, string> = { RESTRUCTURE: "Restructure", MERGER: "Merger", NEW_CEO: "New CEO", MODEL_TRANSITION_LIVE: "Business model change now live", OTHER: "Other" };
const TRIG: Record<string, string> = { PULSE_MOVEMENT: "Pulse movement", STRUCTURAL_COMPLETE: "Structural actions complete", ORG_CHANGE: "Organisational change", BOARD_REQUEST: "Board request", ANNUAL: "Twelve months since the baseline" };
const when = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Stage 6 (Measure): the cycle compared with the one before, the triggers that open a re-assessment, and recorded organisational changes.
// Everything shown comes from the two frozen score objects and the stored comparison; nothing is recomputed from responses.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}/measure`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id, cycle_no, previous_engagement_id").eq("engagement_id", id).maybeSingle();
  const role = eng ? (await db.rpc("rpc_actor_role", { p_engagement: id })).data as string | null : null;
  if (!eng || !role || !["PAC_CONSULTANT", "CLIENT_ADMIN", "EXECUTIVE"].includes(role)) redirect("/dashboard");
  const consultant = role === "PAC_CONSULTANT";

  const [{ data: cmp }, { data: trig }, { data: chg }, { data: ten }, { data: pls }, { data: pres }, base, rv, { data: rolled }] = await Promise.all([
    db.from("comparison").select("deltas_json, deltas_hash, created_at, baseline_assessment_id, version_relation").eq("engagement_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("reassessment_trigger").select("trigger_id, type, source_ref, raised_at, decision, reason, decided_at").eq("engagement_id", id).order("raised_at", { ascending: false }),
    db.from("org_change").select("org_change_id, type, effective_date, description").eq("engagement_id", id).order("effective_date", { ascending: false }),
    admin().from("tenant").select("name").eq("tenant_id", eng.tenant_id).single(),
    db.from("pulse").select("pulse_id, priority_id, review_point, items, baseline_json, status, closes_at, closed_at").eq("engagement_id", id).order("created_at", { ascending: false }),
    db.from("pulse_result").select("pulse_id, n_invited, n_responded, suppressed, reading_json, triggers_json").eq("engagement_id", id),
    consultant ? baselineOf(id) : null,
    consultant ? rolloverPreview(id) : null,
    db.from("rollover").select("new_engagement_id, setup_sections, actions_carried, created_at").eq("previous_engagement_id", id).maybeSingle().then((r) => ({ data: r.data })),
  ]);
  const offers = base ? base.plan.priorities.map((p) => ({ priority_id: p.priority_id, label: `${p.priority_id.replace("pri_", "Priority ")} · ${p.orientation}`, items: (watchlistOf(base.plan, p.priority_id)?.items ?? []).map((ref) => ({ ref, text: refLabel(ref) })) })).filter((o) => o.items.length) : [];
  const floor = E.config.get("segments.floor");
  const d = cmp?.deltas_json as unknown as Deltas | undefined;
  // delivery, shown beside the movement: how the previous cycle's actions went (counts only)
  const delivery = d ? await db.from("action").select("status").eq("assessment_id", d.baseline.assessment_id) : null;
  const acts = delivery?.data ?? [];
  const closed = acts.filter((a) => a.status === "CLOSED").length;
  const open = (trig ?? []).filter((t) => !t.decision);
  const maxAbs = d ? Math.max(1, ...ORIENT.map((o) => Math.abs(Number(d.now[o])))) : 1;

  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, id, "measure")]);
  return (
    <StaffShell section={tabs} title={`Measure · ${ten?.name ?? "Engagement"}`} subtitle="Whether the culture moved, what opens a re-assessment, and what has changed in the organisation." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}
      actions={<a className="sbtn ghost" href="/dashboard">All engagements</a>}>
      <div className="cds">
        <div className="stf-kpis">
          <div className="stf-kpi"><div className="l">Cycle</div><div className="v">{eng.cycle_no}</div><div className="n">{eng.previous_engagement_id ? "compared with the cycle before" : "the baseline"}</div></div>
          <div className="stf-kpi"><div className="l">Triggers to review</div><div className="v">{open.length}</div><div className="n">open for the PAC consultant</div></div>
          <div className="stf-kpi"><div className="l">Organisational changes</div><div className="v">{chg?.length ?? 0}</div><div className="n">recorded</div></div>
        </div>

        <section className="scard" aria-label="Trend comparison">
          <div className="scard-head"><div><h2>Trend comparison</h2><div className="ssmall smuted">This cycle against the one before, on the same measures.</div></div>
            {d && <span className="stag orange">{d.relation === "SAME" ? "Same instrument" : "Minor instrument change"}</span>}</div>
          {!d ? (
            !eng.previous_engagement_id ? (
              <State tone="empty" title="This is the baseline cycle">The first comparison appears once the next cycle has been scored and frozen. That is twelve months after this one, or sooner if a trigger below is accepted.</State>
            ) : consultant ? (
              <State tone="empty" title="No comparison stored yet" action={<CompareButton engagementId={id} label="Compare with the previous cycle" />}>Both cycles must be scored and frozen. The comparison is built from the two frozen score objects and then stored, so it never changes afterwards.</State>
            ) : (
              <State tone="unavailable" title="The comparison is not available yet">Your PAC consultant is preparing it. Comparisons reach client roles once the current report is released.</State>
            )
          ) : (
            <>
              {d.relation === "MINOR" && <State tone="warning" title="The instrument changed slightly between cycles">Movement is shown but should be read with care.</State>}
              <div className="stblwrap">
                <table className="stbl" aria-label="Orientation movement">
                  <thead><tr><th>Orientation</th><th>Now before</th><th>Now after</th><th>Change</th><th aria-hidden="true"></th><th>Gap before</th><th>Gap after</th></tr></thead>
                  <tbody>{ORIENT.map((o) => {
                    const v = Number(d.now[o]);
                    return (
                      <tr key={o}>
                        <td><span className="odot" style={{ background: DOT[o], display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 8 }}></span><b>{o}</b></td>
                        <td>{d.baseline_now[o]}</td><td>{d.current_now[o]}</td><td><b>{sign(d.now[o])}</b> <span className="ssmall smuted">{v > 0 ? "up" : v < 0 ? "down" : "no change"}</span></td>
                        <td aria-hidden="true" style={{ width: 160 }}><span style={{ display: "block", position: "relative", height: 10, background: "var(--paper-2)", borderRadius: 99 }}>
                          <span style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, background: "var(--ink)" }}></span>
                          <span style={{ position: "absolute", top: 0, height: 10, borderRadius: 99, background: DOT[o], [v >= 0 ? "left" : "right"]: "50%", width: `${(Math.abs(v) / maxAbs) * 50}%` }}></span></span></td>
                        <td>{d.baseline_gap[o]}</td><td>{d.current_gap[o]}</td>
                      </tr>);
                  })}</tbody>
                </table>
              </div>
              <h3 style={{ margin: "18px 0 8px", fontSize: 15 }}>Readiness and employee voice</h3>
              <div className="stf-kpis">
                {Object.entries(d.readiness).map(([k, v]) => <div className="stf-kpi" key={k}><div className="l">{k === "TPS" ? "Transformation Probability Score" : k}</div><div className="v">{two(v.current)}</div><div className="n">{two(v.baseline)} before · {sign(v.delta)}</div></div>)}
                <div className="stf-kpi"><div className="l">Employee Orientation Survey index</div><div className="v">{d.eos_index.current ?? "–"}</div><div className="n">{d.eos_index.baseline ?? "–"} before · {sign(d.eos_index.delta)}</div></div>
              </div>
              {(() => {
                const tv = d.trade_off as { verification?: { priority: string; target: string; trade_off: string; rise: string; verdict: string }[]; unintended_release?: string[] } | undefined;
                const unintended = tv?.unintended_release ?? [];
                return (
                  <>
                    <h3 style={{ margin: "18px 0 8px", fontSize: 15 }}>Trade-off verification</h3>
                    {unintended.length > 0 && <State tone="warning" title={`An orientation you meant to protect fell: ${unintended.join(", ")}`}>This is one of the most useful things a re-assessment shows. Review it with the sponsor before the next plan.</State>}
                    {(tv?.verification ?? []).length === 0 && unintended.length === 0 && <p className="smuted">No build priority had a recorded trade-off to verify, and no protected orientation fell.</p>}
                    {(tv?.verification ?? []).map((v) => <p key={v.priority} className="ssmall">{v.target} moved <b>{sign(v.rise)}</b>; the planned release was {v.trade_off}: <b>{human(v.verdict)}</b>.</p>)}
                  </>
                );
              })()}
              <h3 style={{ margin: "18px 0 8px", fontSize: 15 }}>Delivery, beside the movement</h3>
              <p className="ssmall">{acts.length ? `${closed} of ${acts.length} actions from the previous plan are closed.` : "No actions were recorded in the previous plan."} Movement and delivery are shown side by side. CDP never claims that an action caused a movement.</p>
              <p className="ssmall smuted">Stored {when(cmp!.created_at)} · {cmp!.deltas_hash.slice(0, 18)}…</p>
            </>
          )}
        </section>

        <section className="scard" aria-label="Pulses">
          <div className="scard-head"><div><h2>Pulses</h2><div className="ssmall smuted">A short check at 90 and 180 days on the watch-list of one priority, never more than {E.config.get("pulse.max_items")} items. Results are indicative and never replace a full assessment.</div></div></div>
          {consultant && offers.length > 0 && <PulseBuilder engagementId={id} offers={offers} max={E.config.get("pulse.max_items")} />}
          {(pls ?? []).length === 0 ? (
            <State tone="empty" title="No pulse yet">{consultant ? (offers.length ? "Create one above once the plan has been agreed with the client." : "A pulse needs a frozen baseline with a plan.") : "Your PAC consultant sets a pulse up once the plan is under way."}</State>
          ) : (pls ?? []).map((p) => {
            const r = (pres ?? []).find((x) => x.pulse_id === p.pulse_id);
            const rd = r?.reading_json as unknown as { baseline: Record<string, Record<string, string | number>>; current: Record<string, Record<string, string | number>>; movement: string[]; current_n: Record<string, number> } | null | undefined;
            return (
              <div key={p.pulse_id} style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line, #e7e2d8)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 15 }}>{p.priority_id.replace("pri_", "Priority ")} · {p.review_point === "+90d" ? "90 day" : "180 day"} pulse</h3>
                  <span className={"stag " + (p.status === "OPEN" ? "orange" : "")}>{human(p.status)}</span>
                  {p.status === "OPEN" && p.closes_at && <span className="ssmall smuted">closes {when(p.closes_at)}</span>}{p.status === "CLOSED" && p.closed_at && <span className="ssmall smuted">closed {when(p.closed_at)}</span>}
                  {r && <span className="stag">Indicative</span>}
                </div>
                <p className="ssmall smuted" style={{ margin: "6px 0" }}>{p.items.join(" · ")}</p>
                {r ? (r.suppressed || !rd ? (
                  <State tone="suppressed" title="Too few answers to show">{r.n_responded} of {r.n_invited} people answered. Results are shown only when {floor} or more people answered, so nobody can be identified.</State>
                ) : (
                  <div className="stblwrap"><table className="stbl" aria-label="Pulse movement">
                    <thead><tr><th>Item</th><th>Baseline</th><th>Pulse</th><th>Change</th></tr></thead>
                    <tbody>{p.items.map((ref) => {
                      const b = readingValue(rd.baseline, ref), c = readingValue(rd.current, ref);
                      const moved = rd.movement.includes(ref);
                      return <tr key={ref}><td><b>{ref}</b> <span className="ssmall smuted">{refLabel(ref)}</span></td><td>{b ?? "–"}</td><td>{c ?? "–"}</td>
                        <td>{b !== null && c !== null ? <>{changeOf(b, c, ref)} {moved && <span className="stag orange">Crossed the trigger line</span>}</> : <span className="smuted">Not comparable</span>}</td></tr>;
                    })}</tbody>
                  </table></div>
                )) : consultant ? <PulseActions id={p.pulse_id} status={p.status} emailReady={emailConfigured()} /> : <p className="ssmall smuted">{p.status === "OPEN" ? "Open now." : p.status === "CLOSED" ? "Closed. The consultant is preparing the results." : "Draft."}</p>}
                {r && !r.suppressed && <p className="ssmall smuted" style={{ marginTop: 6 }}>{r.n_responded} of {r.n_invited} people answered. A movement opens a review by the PAC consultant; it never starts a survey by itself.</p>}
              </div>
            );
          })}
        </section>

        <section className="scard" aria-label="Triggers">
          <div className="scard-head"><div><h2>Re-assessment triggers</h2><div className="ssmall smuted">A trigger opens a review by the PAC consultant. It never starts a survey by itself.</div></div>{consultant && <CheckTriggers engagementId={id} />}</div>
          {(trig ?? []).length === 0 ? (
            <State tone="empty" title="No triggers raised">Triggers are raised when a planned structural action closes, an organisational change is recorded, the board asks, or twelve months have passed since the baseline.</State>
          ) : (
            <div className="stblwrap"><table className="stbl"><thead><tr><th>Trigger</th><th>Source</th><th>Raised</th><th>Decision</th></tr></thead><tbody>
              {(trig ?? []).map((t) => (
                <tr key={t.trigger_id}><td><b>{TRIG[t.type] ?? human(t.type)}</b></td><td>{CHANGE[t.source_ref] ?? t.source_ref}</td><td>{when(t.raised_at)}</td>
                  <td>{t.decision ? <><span className={"stag " + (t.decision === "ACCEPTED" ? "orange" : "")}>{human(t.decision)}</span>{t.reason && <span className="ssmall smuted"> {t.reason}</span>}</> : consultant ? <DecideTrigger id={t.trigger_id} /> : <span className="smuted">Waiting for the PAC consultant</span>}</td></tr>))}
            </tbody></table></div>
          )}
        </section>

        <section className="scard" aria-label="Next cycle">
          <div className="scard-head"><div><h2>Next cycle</h2><div className="ssmall smuted">Starting the next assessment cycle carries over what still matters. The baseline stays exactly as it is and becomes the comparison for the next cycle.</div></div></div>
          {rolled ? (
            <State tone="empty" title={`The next cycle was created on ${when(rolled.created_at)}`}>{rolled.setup_sections} setup sections were copied as drafts to be agreed again, and {rolled.actions_carried} open actions were carried over. <a href={`/engagements/${rolled.new_engagement_id}/setup`}>Open the next cycle</a></State>
          ) : !consultant || !rv ? (
            <State tone="unavailable" title="The next cycle has not been created yet">Your PAC consultant starts it once a re-assessment is due.</State>
          ) : (
            <>
              <ul style={{ margin: "0 0 10px", paddingLeft: 18 }} className="ssmall">
                <li><b>Setup sections {rv.carries.setup_sections.join(", ") || "none agreed yet"}</b> are copied as drafts and must be agreed again at the next workshop, with dates and participants recorded again.</li>
                <li><b>{rv.carries.actions.length} open action{rv.carries.actions.length === 1 ? "" : "s"}</b> are carried over with their status and history, and are linked to the next findings, or retired as superseded, when the next plan is built.</li>
                <li><b>{rv.carries.backlog.length} backlog item{rv.carries.backlog.length === 1 ? "" : "s"}</b> and {rv.carries.g5_workshop_entries} keep-and-protect workshop entr{rv.carries.g5_workshop_entries === 1 ? "y" : "ies"} travel with it. The system entries are worked out again from the next classification.</li>
              </ul>
              {rv.canCreate ? <><p className="ssmall smuted" style={{ marginBottom: 8 }}>{rv.reason}</p><RolloverButton engagementId={id} /></> : <State tone="blocking" title="Not yet">{rv.blocker}</State>}
            </>
          )}
        </section>

        <section className="scard" aria-label="Organisational changes">
          <div className="scard-head"><div><h2>Organisational changes</h2><div className="ssmall smuted">Restructures, mergers, a new CEO or a live change of business model can open a re-assessment.</div></div></div>
          {(role === "CLIENT_ADMIN" || consultant) && <OrgChangeForm engagementId={id} />}
          {(chg ?? []).length === 0 ? <p className="smuted" style={{ marginTop: 12 }}>None recorded.</p> : (
            <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {(chg ?? []).map((c) => <li key={c.org_change_id} className="ssmall"><b>{CHANGE[c.type] ?? human(c.type)}</b> · {when(c.effective_date)} · {c.description}</li>)}
            </ul>)}
        </section>
      </div>
    </StaffShell>
  );
}
