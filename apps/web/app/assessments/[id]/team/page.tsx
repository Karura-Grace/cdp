import "@/app/console.css";
import { State } from "@/components/state";
import { notFound } from "next/navigation";
import { Gauge } from "@/components/gauge";
import { CultureMap } from "@/components/culture-map";
import { mapStone } from "@/lib/culture-route";
import { StaffShell } from "@/components/staff-shell";
import { ChartCard, Expander } from "@/components/portal";
import { TEAM_SAY } from "@/lib/report-copy";
import { ORIENTATIONS, ORIENT_COLOR, ORIENT_NAME, dp, signed, type Orientation } from "@/lib/format";
import ITEMS from "@/lib/l360-items.json";
import { staffGate } from "@/lib/session";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import { teamView } from "@/lib/team-view";
import { DevPlan, type DevItem } from "../leaders/actions";
import { Result, type LeaderResultView } from "../leaders/result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Prof = Record<Orientation, string>;
type Metrics = { n: number; now: Prof; preferred: Prof | null; diff: Prof; gap: Prof | null; readiness: { d7: string | null; d8: string | null; d9: string | null } };

// A People Leader's own view, after the report is released: their team's culture (only when enough people answered), their own
// Leadership 360 result and their own agreed development plan. Nothing about other teams or anyone's individual answers.
// Executives and People Leaders cannot read the assessment row, so it is looked up with the service role, after which the
// caller's own role is required and every result is read through their own token (RLS) or the guarded team view.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/assessments/${id}/team`);
  const { data: asm } = await admin().from("assessment").select("engagement_id, tenant_id").eq("assessment_id", id).maybeSingle();
  if (!asm) notFound();
  const { data: role } = await db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  if (role !== "PEOPLE_LEADER") notFound();
  const { data: ten } = await admin().from("tenant").select("name").eq("tenant_id", asm.tenant_id).maybeSingle();
  const view = await teamView(db, id, user.id);
  if (!view) notFound();   // no released report on a frozen score yet
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, asm.engagement_id, "team")]);
  const [{ data: res }, { data: dev }] = await Promise.all([
    db.from("leader_result").select("score_version, payload_json").eq("assessment_id", id).order("score_version", { ascending: false }).limit(1),
    db.from("development_item").select("*").eq("assessment_id", id).order("seq"),
  ]);
  const mine = res?.[0]?.payload_json as unknown as LeaderResultView | undefined;
  const sectionName = new Map((ITEMS.sections as { key: string; name: string }[]).map((x) => [x.key, x.name]));
  const items: DevItem[] = (dev ?? []).map((d) => ({ item_id: d.item_id, basis: d.basis, support: d.support, start_stop_keep: d.start_stop_keep, behaviour: d.behaviour,
    visible_change_30d: d.visible_change_30d, agreed_at: d.agreed_at,
    label: d.orientation ? `${ORIENT_NAME[d.orientation as Orientation]} (${sectionName.get(d.section ?? "") ?? ""})` : sectionName.get(d.section ?? "") ?? "" }));

  return (
    <StaffShell section={tabs} title={`My team · ${ten?.name ?? "Organisation"}`} subtitle="Your team's culture, your own leadership feedback and your development plan." nav={nav}
      email={user.email ?? ""} roleLabel={roleLabel} actions={<a className="sbtn ghost" href="/dashboard">Back</a>}>
      <div className="cds">
        {!view.linked && <div className="scard"><h2>Your login is not linked to a person yet</h2>
          <p className="smuted" style={{ marginTop: 6 }}>Ask your organisation&rsquo;s administrator to link your login to your name on the roster. Until then only the organisational report is shown.</p></div>}
        {view.linked && view.teams.length === 0 && <State tone="empty" icon="userX" title="You are not recorded as leading a team">Team results are shown to the person recorded as leading that team. Ask your organisation administrator to check the roster if this is wrong.</State>}
        {view.teams.map((t) => {
          const m = t.metrics as unknown as Metrics | null;
          const fine = m && m.preferred;
          return (
            <section key={t.assignment_id} className="scard" aria-labelledby={`t-${t.assignment_id}`}>
              <div className="scard-head"><div><h2 id={`t-${t.assignment_id}`}>{t.team}</h2>
                <div className="ssmall smuted">{m ? `${m.n} responses` : `Fewer than ${view.floor} responses`}</div></div></div>
              {!m ? <p className="smuted">Too few people answered to report this team. This protects anonymity; the team is counted in the organisation&rsquo;s results.</p> : (
                <div className="cds-two">
                  <ChartCard title="Culture map" say={TEAM_SAY.map}><div className="cds-chart" style={{ height: "auto" }}>
                    {fine ? <CultureMap now={m.now} pref={m.preferred!} title={`Culture map of ${t.team}`} stone={mapStone(m.now as never, m.preferred as never)} />
                      : <p className="ssmall smuted">Now culture: {ORIENTATIONS.map((o) => `${ORIENT_NAME[o]} ${dp(m.now[o], 0)}`).join(", ")}. The Preferred culture needs {view.floor} or more answers.</p>}
                  </div></ChartCard>
                  <ChartCard title="Against the whole organisation" say={TEAM_SAY.vsOrg}>
                    {ORIENTATIONS.map((o) => (
                      <div className="cds-gaprow" key={o}>
                        <div><strong style={{ color: ORIENT_COLOR[o] }}>{ORIENT_NAME[o]}</strong></div>
                        <div><span className="ssmall smuted">Team {dp(m.now[o], 0)}</span></div>
                        <div className="cds-gtag">{signed(m.diff[o], 0)}</div>
                      </div>
                    ))}
                    <div className="cds-gauges" style={{ marginTop: 10 }}>
                      <Gauge value={m.readiness.d8 ? dp(m.readiness.d8, 1) : null} label="Safety" why="Can people speak up?" />
                    </div>
                  </ChartCard>
                </div>
              )}
            </section>
          );
        })}
        {view.linked && <section className="scard"><div className="scard-head"><div><h2>Your leadership feedback</h2></div></div>
          {mine?.valid ? <><Result r={mine} /><Expander say={TEAM_SAY.feedback} /></> : <p className="smuted">{mine ? "Not enough feedback yet for a result." : "Your result appears here once it is released."}</p>}
          {items.length > 0 && <DevPlan assessmentId={id} assignmentId={dev![0].assignment_id} items={items} editable={false} />}
        </section>}
        <p className="ssmall smuted">Teams with fewer than {view.floor} answers are never shown. Each time you open this page it is recorded.</p>
      </div>
    </StaffShell>
  );
}
