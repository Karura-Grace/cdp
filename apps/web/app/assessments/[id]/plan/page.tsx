import { actionDepth } from "@/lib/playbook-view";
import "@/app/console.css";
import { notFound } from "next/navigation";
import * as E from "@pac/cdp-engine";
import { StaffShell } from "@/components/staff-shell";
import { ORIENT_COLOR, ORIENT_NAME, dp, human, signed, type Orientation } from "@/lib/format";
import { CLIENT_PLAN_ROLES, movesFor, rulesOf } from "@/lib/plan";
import { staffGate } from "@/lib/session";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import { ActionControls, BuildPlan, CompleteP0, RankPriorities, type ActionView } from "./controls";
import { ReviewPanel } from "./review-panel";
import { Expander, MeterTile } from "@/components/portal";
import { PLAN_SAY, orientationSay } from "@/lib/report-copy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RAG_TAG: Record<E.Rag, string> = { GREEN: "ok", AMBER: "warn", RED: "orange" };
const TRACKED = ["PUBLISHED", "IN_PROGRESS", "UNDER_REVIEW"];
const STATUS_TAG = (s: string) => (s === "CLOSED" ? "ok" : TRACKED.includes(s) ? "blue" : s === "DISCARDED" || s === "RETIRED" ? "" : "warn");
const HORIZON: Record<string, string> = { QUICK_WIN_0_3M: "Quick win (0 to 3 months)", MEDIUM_3_12M: "Medium (3 to 12 months)", STRUCTURAL_12M_PLUS: "Structural (12 months +)" };
const ESC: Record<string, string> = { OWNER_REMINDER: "Reminder to owner", OWNER_DAILY: "Owner chased daily", SPONSOR: "Sponsor involved", TIER_OWNER: "Priority owner involved", EXCO_DECISION: "ExCo decision", CEO_IMMEDIATE: "CEO now" };
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// The action plan for the latest score version: pre-conditions (P0), priorities and their actions with RAG status,
// escalation and the workflow moves the engine allows the signed-in role. Every read uses the user's own token (RLS):
// client roles see it only after release, and never actions still in draft.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/assessments/${id}/plan`);
  // Executives and People Leaders cannot read the assessment row, so it is looked up with the service role; the caller's own
  // role on its engagement (rpc_actor_role, their token) is then required, and every result below is read through RLS.
  const { data: asm } = await admin().from("assessment").select("assessment_id, engagement_id, tenant_id").eq("assessment_id", id).maybeSingle();
  if (!asm) notFound();
  const { data: role } = await db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  if (!role || role === "COACH") notFound();
  const consultant = role === "PAC_CONSULTANT";
  // From rules 2.2 the client owns the plan: it edits, accepts, defers, ranks and publishes; the consultant reads (engine TRANSITIONS_2_2, design J4b).
  const rules = await rulesOf(id);
  const clientOwned = rules === "2.2";
  const clientRole = CLIENT_PLAN_ROLES.includes(role);
  const canRank = clientOwned && (role === "CLIENT_ADMIN" || role === "EXECUTIVE");
  const { data: ten } = await admin().from("tenant").select("name").eq("tenant_id", asm.tenant_id).maybeSingle();   // name only, after the role check
  const { data: plan } = await db.from("plan").select("score_version, start_date, payload_hash").eq("assessment_id", id).order("score_version", { ascending: false }).limit(1).maybeSingle();
  const { data: ev } = consultant ? await db.from("evaluation").select("score_version").eq("assessment_id", id).limit(1).maybeSingle() : { data: null };
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, asm.engagement_id, "plan")]);
  const shell = (body: React.ReactNode) => (
    <StaffShell section={tabs} title={`Action plan · ${ten?.name ?? "Engagement"}`} subtitle="Priorities from the findings, the actions that deliver them, and how they are tracking." nav={nav}
      email={user.email ?? ""} roleLabel={roleLabel} actions={<a className="sbtn ghost" href="/dashboard">All engagements</a>}><div className="cds">{body}</div></StaffShell>
  );
  if (!plan) {
    return shell(<div className="scard"><h2>No action plan yet</h2>
      <p className="smuted" style={{ margin: "6px 0 12px" }}>{consultant ? (ev ? "The findings are ready. The plan is built from them by the rules engine; every action starts as a draft for you to review." : "Run findings first; the plan is built from them.") : "The plan appears here once your PAC Consultant has built it and the report has been released to you."}</p>
      {consultant && ev && <BuildPlan assessmentId={id} />}</div>);
  }
  const v = plan.score_version;
  const [{ data: pris0 }, { data: p0 }, { data: acts }, { data: ord }] = await Promise.all([
    db.from("priority").select("*").eq("assessment_id", id).eq("score_version", v).order("sequence"),
    db.from("priority_zero_item").select("*").eq("assessment_id", id).eq("score_version", v).order("item_id"),
    db.from("action").select("*").eq("assessment_id", id).eq("score_version", v).order("engine_ref"),
    db.from("plan_client_order").select("ranking").eq("assessment_id", id).eq("score_version", v).order("set_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // the client's own order when it has set one (the engine's sequence is never changed), else the engine's order
  const rank = new Map((ord?.ranking ?? []).map((pid, i) => [pid, i]));
  const pris = [...(pris0 ?? [])].sort((a, b) => (rank.get(a.priority_id) ?? 1e6 + a.sequence) - (rank.get(b.priority_id) ?? 1e6 + b.sequence));
  // KPIs the client already tracks (Setup C): offered when it fills an action's KPI (Q-AP8). Names only, read after the role check.
  const { data: setupC } = clientOwned && clientRole ? await admin().from("setup_record").select("payload_json").eq("engagement_id", asm.engagement_id).eq("section", "C").eq("perspective", "AGREED").maybeSingle() : { data: null };
  const kpiOptions = (((setupC?.payload_json as { kpis?: { name?: unknown }[] } | null)?.kpis) ?? []).map((k) => String(k.name ?? "")).filter(Boolean);
  const ids = (acts ?? []).map((x) => x.action_id);
  const [{ data: readings }, { data: evidence }, { data: events }, { data: reviews }] = ids.length ? await Promise.all([
    db.from("kpi_reading").select("action_id, value, read_on, note").in("action_id", ids).order("read_on"),
    db.from("action_evidence").select("evidence_id, action_id, kind, description, link, file_name, file_size, created_at").in("action_id", ids).order("created_at"),
    db.from("action_event").select("action_id, from_status, to_status, reason, at").in("action_id", ids).order("at"),
    db.from("action_review").select("action_id, review_point, engine_decision, final_decision, override_reason, decided_at").in("action_id", ids).order("decided_at"),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const today = new Date().toISOString().slice(0, 10);
  const doneFindings = new Set((p0 ?? []).filter((z) => z.completed_at).flatMap((z) => z.finding_ids));
  const heldBy = (blocked: string[]) => (p0 ?? []).filter((z) => !z.completed_at && z.finding_ids.some((f) => blocked.includes(f))).map((z) => z.item);

  const rows = (acts ?? []).map((x) => {
    const rs = (readings ?? []).filter((r) => r.action_id === x.action_id);
    const tracked = TRACKED.includes(x.status);
    const rag = tracked ? E.rag(x as never, today, { readings: rs.map((r) => r.value) }) : null;
    const over = tracked ? Math.max(0, days(x.end_date, today)) : 0;
    const esc = tracked ? E.escalation(over, 0, { visibleSignalMissed: x.is_visible_signal && over > 0, daysUntilDue: days(today, x.end_date) }) : null;
    const prog = rs.length && x.baseline_value !== null && x.target_value !== null ? E.kpiProgress(x.baseline_value, x.target_value, rs[rs.length - 1].value) : null;
    return { x, rs, rag, esc, prog };
  });
  const tally = (r: E.Rag) => rows.filter((w) => w.rag === r).length;
  const openP0 = (p0 ?? []).filter((z) => !z.completed_at).length;
  const canP0 = consultant || role === "EXECUTIVE";
  const live = rows.filter((w) => TRACKED.includes(w.x.status)).length, closed = rows.filter((w) => w.x.status === "CLOSED").length;

  return shell(<>
    <div className="pt-grid4" style={{ marginBottom: 18 }}>
      <MeterTile label="Actions" value={String(rows.length)} word={`${live} live · ${closed} closed`} pct={rows.length ? (closed / rows.length) * 100 : 0} say={PLAN_SAY.actions} />
      <MeterTile label="On track" value={String(tally("GREEN"))} word={`${tally("AMBER")} at risk · ${tally("RED")} off track`} tone={tally("RED") ? "bad" : tally("AMBER") ? "warn" : live ? "ok" : ""} pct={live ? (tally("GREEN") / live) * 100 : 0} say={PLAN_SAY.track} />
      <MeterTile label="Pre conditions open" value={String(openP0)} word={`of ${(p0 ?? []).length}`} tone={openP0 ? "orange" : "ok"} pct={(p0 ?? []).length ? (((p0 ?? []).length - openP0) / (p0 ?? []).length) * 100 : 100} say={PLAN_SAY.p0} />
      <MeterTile label="Plan start" value={plan.start_date} word={`Score version ${v}`} pct={0} say={PLAN_SAY.start} />
    </div>

    {(p0 ?? []).length > 0 && (
      <section className="scard" aria-labelledby="p0h">
        <div className="scard-head"><div><h2 id="p0h">Pre conditions (P0)</h2><p className="ssmall smuted">Must be done before the actions they block can be published. Owned by the CEO and CHRO.</p></div></div>
        <Expander say={PLAN_SAY.p0} />
        {(p0 ?? []).map((z) => (
          <div key={z.item_id} className="cds-check">
            <div className="top"><strong>{z.item}</strong><span className={`stag ${z.completed_at ? "ok" : "warn"}`}>{z.completed_at ? `Done ${z.completed_at.slice(0, 10)}` : "Open"}</span></div>
            {z.completion_note && <p className="ssmall smuted" style={{ marginTop: 4 }}>{z.completion_note}</p>}
            {!z.completed_at && canP0 && <CompleteP0 assessmentId={id} version={v} itemId={z.item_id} />}
          </div>
        ))}
      </section>
    )}

    {canRank && pris.length > 1 && (
      <section className="scard" aria-labelledby="rankh">
        <div className="scard-head"><div><h2 id="rankh">Your order of priorities</h2><p className="ssmall smuted">The system proposes an order. Put the priorities in the order you will work on them. A priority held by a pre condition cannot go above one that is not held.</p></div></div>
        <RankPriorities assessmentId={id} version={v} items={pris.map((p) => ({ id: p.priority_id, label: `${human(p.classification)} ${ORIENT_NAME[p.orientation as Orientation] ?? p.orientation}`, held: p.blocked_by.some((f) => !doneFindings.has(f)) }))} />
      </section>
    )}

    {pris.map((p) => {
      const o = p.orientation as Orientation;
      const blocked = p.blocked_by.filter((f) => !doneFindings.has(f));
      const mine = rows.filter((w) => w.x.priority_id === p.priority_id);
      return (
        <section key={p.priority_id} className="scard" aria-labelledby={`h-${p.priority_id}`}>
          <div className="scard-head">
            <div><h2 id={`h-${p.priority_id}`}><span style={{ color: ORIENT_COLOR[o] }}>Priority {p.sequence}: {human(p.classification)} {ORIENT_NAME[o] ?? o}</span></h2>
              <div className="ssmall smuted">Gap {signed(p.gap, 1)} · {human(p.urgency_tier)} · owner {p.owner_role} · due {p.due}{p.trade_off_orientation ? ` · releases ${ORIENT_NAME[p.trade_off_orientation as Orientation]}` : ""}</div></div>
            {blocked.length > 0 && <span className="stag orange" title={heldBy(blocked).join(" · ") || blocked.join(", ")}>Held until {heldBy(blocked).length || blocked.length} pre condition{(heldBy(blocked).length || blocked.length) === 1 ? " is" : "s are"} done</span>}
          </div>
          <Expander say={orientationSay(o, p.classification)} />
          <div className="stblwrap"><table className="stbl">
            <thead><tr className="planhead"><th>Action</th><th>Status</th><th>Owner</th><th>Due</th><th>KPI</th><th>RAG</th></tr></thead>
            <tbody>{mine.map(({ x, rs, rag, esc, prog }) => (
              <tr key={x.action_id}><td colSpan={6} style={{ padding: 0 }}>
                <details>
                  <summary style={{ display: "grid", gridTemplateColumns: "minmax(220px,2.4fr) 1fr 1fr .8fr 1.2fr .7fr", gap: 10, padding: "12px 14px", cursor: "pointer", alignItems: "center" }}>
                    <span><strong>{x.objective}</strong>{x.is_visible_signal && <span className="stag blue" style={{ marginLeft: 6 }}>Visible signal</span>}<br /><span className="ssmall smuted">{HORIZON[x.horizon]}</span></span>
                    <span><span className={`stag ${STATUS_TAG(x.status)}`}>{x.status === "IN_CO_DESIGN" && clientOwned ? "Proposed" : human(x.status)}</span>{x.client_decision === "DEFERRED" && <span className="stag" style={{ marginLeft: 4 }}>Deferred</span>}{x.client_horizon && <span className="stag blue" style={{ marginLeft: 4 }}>{human(x.client_horizon)}</span>}</span>
                    <span className="ssmall">{x.owner ?? <span className="smuted">Not set</span>}</span>
                    <span className="ssmall" style={{ fontVariantNumeric: "tabular-nums" }}>{x.end_date}</span>
                    <span className="ssmall">{x.kpi ? <>{x.kpi}<br /><span className="smuted">{x.baseline_value ?? "?"} → {x.target_value ?? "?"}{prog !== null ? ` · ${dp(prog.times(100).toString(), 0)}% of the way` : ""}</span></> : <span className="smuted">No KPI</span>}</span>
                    <span>{rag ? <span className={`stag ${RAG_TAG[rag]}`}>{human(rag)}</span> : <span className="ssmall smuted">Not live</span>}</span>
                  </summary>
                  <div style={{ padding: "0 14px 14px" }}>
                    <p className="ssmall">{x.intervention}</p>
                    {(() => { const d = actionDepth(x, p.trade_off_orientation ?? null); return d.why ? (
                      <dl className="ssmall" style={{ margin: "8px 0", display: "grid", gap: 6 }}>
                        <div><dt><strong>Why</strong></dt><dd>{d.why}</dd></div>
                        {d.how.length > 0 && <div><dt><strong>How</strong></dt><dd><ul style={{ margin: "2px 0 0 18px" }}>{d.how.map((h) => <li key={h}>{h}</li>)}</ul></dd></div>}
                        <div><dt><strong>Owner and KPI</strong></dt><dd>{x.owner ?? "Owner not set yet"}. {x.kpi ? `Measured by ${x.kpi}.` : "No KPI set yet."}</dd></div>
                        {d.signal && <div><dt><strong>Visible signal within 30 days</strong></dt><dd>{d.signal}</dd></div>}
                        {(d.unlocks.length > 0 || d.watch.length > 0) && <div><dt><strong>What it unlocks</strong></dt><dd>{d.unlocks.join(" ")}{d.watch.length > 0 && <> Re-measured in: {d.watch.join(", ")}.</>}</dd></div>}
                        <div className="smuted">Playbook version {d.version}</div>
                      </dl>) : null; })()}
                    {esc && <p className="ssmall" style={{ color: "var(--bad)", marginTop: 4 }}>Escalation: {ESC[esc] ?? human(esc)}.</p>}
                    {rs.length > 0 && <p className="ssmall smuted" style={{ marginTop: 4 }}>Readings: {rs.map((r) => `${r.read_on} ${r.value}`).join(" · ")}</p>}
                    {(evidence ?? []).filter((e) => e.action_id === x.action_id).map((e, i) => <p key={i} className="ssmall smuted">Evidence ({human(e.kind)}): {e.description}{e.link && <> · <a href={e.link} rel="noopener noreferrer" target="_blank">link</a></>}{e.file_name && <> · <a href={`/v1/evidence/${e.evidence_id}/file`}>{e.file_name}</a> ({Math.max(1, Math.round((e.file_size ?? 0) / 1024))} KB)</>}</p>)}
                    {(reviews ?? []).filter((r) => r.action_id === x.action_id).map((r) => (
                      <p key={r.review_point} className="ssmall" style={{ marginTop: 4 }}><b>{r.review_point === "+90d" ? "90 day" : "180 day"} review:</b> {human(r.final_decision)}{r.final_decision !== r.engine_decision && <> (engine recommended {human(r.engine_decision)}{r.override_reason ? `; ${r.override_reason}` : ""})</>} <span className="smuted">{r.decided_at.slice(0, 10)}</span></p>))}
                    {consultant && x.status === "UNDER_REVIEW" && <ReviewPanel actionId={x.action_id} done={(reviews ?? []).filter((r) => r.action_id === x.action_id).map((r) => r.review_point)} />}
                    <ActionControls a={x as unknown as ActionView} moves={movesFor(x.status, role, rules)} kpiOptions={kpiOptions} clientOwned={clientOwned}
                      canEdit={clientOwned ? clientRole && x.status === "IN_CO_DESIGN" : consultant && ["DRAFT", "IN_REVIEW", "IN_CO_DESIGN"].includes(x.status)}
                      canMark={clientOwned && clientRole && ["IN_CO_DESIGN", "APPROVED"].includes(x.status)} canTrack />
                    {(events ?? []).some((e) => e.action_id === x.action_id) && <p className="ssmall smuted" style={{ marginTop: 10 }}>History: {(events ?? []).filter((e) => e.action_id === x.action_id).map((e) => `${e.at.slice(0, 10)} ${human(e.to_status)}${e.reason ? ` (${e.reason})` : ""}`).join(" · ")}</p>}
                  </div>
                </details>
              </td></tr>
            ))}</tbody>
          </table></div>
        </section>
      );
    })}
    <p className="ssmall smuted">Plan {plan.payload_hash.slice(0, 19)}… from score version {v}. RAG and escalation follow the engine&rsquo;s rules on the latest KPI reading and the due date.</p>
  </>);
}
