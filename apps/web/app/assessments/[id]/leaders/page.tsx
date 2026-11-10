import { servicesOf } from "@/lib/services";
import "@/app/console.css";
import { State } from "@/components/state";
import { notFound } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { Expander, MeterTile } from "@/components/portal";
import { LEADER_SAY } from "@/lib/report-copy";
import { ORIENT_NAME, dp, human, type Orientation } from "@/lib/format";
import ITEMS from "@/lib/l360-items.json";
import { staffGate } from "@/lib/session";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { leaderExtras, type LeaderExtra } from "@/lib/leader-extras";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import { DevPlan, DraftPlans, IssueLinks, Nominate, type DevItem } from "./actions";

export const dynamic = "force-dynamic";

import { Result, type LeaderResultView } from "./result";

// Leadership 360. A PAC Consultant nominates raters, issues links and follows progress (counts only). Results come from the
// stored leader results of the frozen score; a Client Admin or Executive sees them only once a report on that score is
// released (RLS). No rater is ever named in results.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/assessments/${id}/leaders`);
  // Executives and People Leaders cannot read the assessment row, so it is looked up with the service role; the caller's own
  // role on its engagement (rpc_actor_role, their token) is then required, and every result below is read through RLS.
  const { data: asm } = await admin().from("assessment").select("assessment_id, engagement_id, tenant_id, status, frozen_at").eq("assessment_id", id).maybeSingle();
  if (!asm) notFound();
  if (!(await servicesOf(asm.tenant_id)).includes("LEADERSHIP_360")) notFound();   // a paid service (owner ruling 22 Oct 2026)
  const { data: role } = await db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  const consultant = role === "PAC_CONSULTANT";
  if (!consultant && role !== "CLIENT_ADMIN" && role !== "EXECUTIVE" && role !== "COACH") notFound();   // Coach: development plans only (RLS)

  const sa = admin();
  const [{ data: ten }, { data: snap }, { data: results }] = await Promise.all([
    sa.from("tenant").select("name").eq("tenant_id", asm.tenant_id).maybeSingle(),   // name only, after the role check
    sa.from("org_graph_snapshot").select("scope_json").eq("engagement_id", asm.engagement_id).maybeSingle(),
    db.from("leader_result").select("assignment_id, score_version, payload_json").eq("assessment_id", id).order("score_version", { ascending: false }),
  ]);
  const scope = ((snap?.scope_json ?? []) as { assignment_id: string; headcount_led: number }[]);
  const ids = scope.map((l) => l.assignment_id);
  const { data: las } = ids.length ? await sa.from("leader_assignment").select("assignment_id, person_id, team_id").in("assignment_id", ids) : { data: [] };
  const [{ data: people }, { data: teams }] = await Promise.all([
    sa.from("person_of_record").select("person_id, display_name, email, unit_id").eq("tenant_id", asm.tenant_id).eq("employment_status", "ACTIVE").order("display_name"),
    sa.from("org_unit").select("unit_id, name").eq("tenant_id", asm.tenant_id),
  ]);
  const pname = new Map((people ?? []).map((p) => [p.person_id, p.display_name ?? p.email]));
  const tname = new Map((teams ?? []).map((t) => [t.unit_id, t.name]));
  const latest = results?.[0]?.score_version;
  const resultOf = new Map((results ?? []).filter((r) => r.score_version === latest).map((r) => [r.assignment_id, r.payload_json as unknown as LeaderResultView]));

  const noms = consultant ? (await sa.from("rater_nomination").select("assignment_id, rater_person_id, rater_group, status").eq("assessment_id", id)).data ?? [] : [];
  const counts = consultant ? (((await sa.rpc("rpc_counts_360", { p_assessment_id: id })).data ?? []) as { assignment_id: string; kind: string; invited: number; submitted: number }[]) : [];
  const count = (a: string, k: string) => counts.find((c) => c.assignment_id === a && c.kind === k);
  const open = asm.status === "LAUNCHED" && !asm.frozen_at;
  const options = (people ?? []).map((p) => ({ person_id: p.person_id, label: `${p.display_name ?? p.email}${p.unit_id ? ` · ${tname.get(p.unit_id) ?? ""}` : ""}` }));
  const leaders = (las ?? []).map((l) => ({ ...l, name: pname.get(l.person_id) ?? "Leader", team: tname.get(l.team_id) ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const valid = [...resultOf.values()].filter((r) => r.valid).length;
  const extras = valid ? await leaderExtras(id, !!asm.frozen_at) : new Map<string, LeaderExtra>();
  // development plans: consultant always, Coach after release, nobody else (RLS)
  const { data: dev } = await db.from("development_item").select("*").eq("assessment_id", id).order("seq");
  const devVersion = Math.max(0, ...(dev ?? []).map((d) => d.score_version));
  const sectionName = new Map((ITEMS.sections as { key: string; name: string }[]).map((x) => [x.key, x.name]));
  const devOf = (aid: string): DevItem[] => (dev ?? []).filter((d) => d.assignment_id === aid && d.score_version === devVersion).map((d) => ({
    item_id: d.item_id, basis: d.basis, support: d.support, start_stop_keep: d.start_stop_keep, behaviour: d.behaviour, visible_change_30d: d.visible_change_30d, agreed_at: d.agreed_at,
    label: d.orientation ? `${ORIENT_NAME[d.orientation as Orientation]} (${sectionName.get(d.section ?? "") ?? ""})` : sectionName.get(d.section ?? "") ?? "",
  }));
  const needsDraft = consultant && latest !== undefined && [...resultOf.values()].some((r) => r.valid) && !(dev ?? []).some((d) => d.score_version === latest);
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, asm.engagement_id, "leaders")]);

  return (
    <StaffShell section={tabs} title={`Leadership 360 · ${ten?.name ?? "Engagement"}`} subtitle="How each leader's behaviour is seen by others, against the leadership the strategy needs." nav={nav}
      email={user.email ?? ""} roleLabel={roleLabel} actions={<a className="sbtn ghost" href="/dashboard">All engagements</a>}>
      <div className="cds">
        <div className={consultant ? "pt-grid3" : "pt-grid2"} style={{ marginBottom: 18 }}>
          <MeterTile label="Leaders in scope" value={String(leaders.length)} word="At launch" pct={leaders.length ? 100 : 0} say={LEADER_SAY.scope} />
          {consultant && (() => { const sub = counts.reduce((s, c) => s + c.submitted, 0), inv = counts.reduce((s, c) => s + c.invited, 0); return <MeterTile label="Forms returned" value={`${sub} of ${inv}`} word="Self and raters" tone={inv && sub >= inv ? "ok" : ""} pct={inv ? (sub / inv) * 100 : 0} say={LEADER_SAY.returned} />; })()}
          <MeterTile label="Leaders with a result" value={String(valid)} word={latest ? `Score version ${latest}` : "After scoring"} tone={valid ? "ok" : ""} pct={leaders.length ? (valid / leaders.length) * 100 : 0} say={LEADER_SAY.results} />
        </div>

        {needsDraft && <section className="scard"><div className="scard-head"><div><h2>Development plans</h2><p className="ssmall smuted">Drafted by the rules engine from each leader&rsquo;s 360; you complete and agree them. Seen by you and, once the report is released, the organisation&rsquo;s Coach.</p></div></div>
          <DraftPlans assessmentId={id} /></section>}
        {consultant && open && <section className="scard"><div className="scard-head"><div><h2>Links</h2><p className="ssmall smuted">Nominate at least three raters per leader, then issue the links. Email sending is not switched on yet, so copy each link to its person.</p></div></div>
          <IssueLinks assessmentId={id} /></section>}

        {leaders.length === 0 && <State tone="empty" icon="userX" title="No leaders in scope for this assessment" action={consultant ? <a className="sbtn ghost" href={`/engagements/${asm.engagement_id}/org`}>Open the organisation</a> : undefined}>Leadership 360 covers the leaders recorded as leading a team when the assessment launched, and this one launched with none, so no self or rater forms exist and there are no results to show. {consultant ? "Record team leaders on the organisation page before launch to use Leadership 360." : "Your PAC consultant can tell you whether Leadership 360 is part of this engagement."}</State>}
        {leaders.map((l) => {
          const r = resultOf.get(l.assignment_id);
          const mine = noms.filter((n) => n.assignment_id === l.assignment_id).map((n) => ({ person_id: n.rater_person_id, rater_group: n.rater_group, invited: n.status === "INVITED" }));
          const self = count(l.assignment_id, "SELF"), rat = count(l.assignment_id, "RATER");
          return (
            <section key={l.assignment_id} className="scard">
              <div className="scard-head">
                <div><h2>{l.name}</h2><div className="ssmall smuted">{l.team}</div></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {consultant && <span className="stag">{self ? (self.submitted ? "Self form returned" : "Self form sent") : "No self form yet"}</span>}
                  {consultant && <span className="stag">{rat ? `${rat.submitted} of ${rat.invited} raters returned` : `${mine.length} raters nominated`}</span>}
                  {r && <span className={`stag ${r.valid ? "ok" : "warn"}`}>{r.valid ? `Readiness ${dp(r.lri!, 2)} · ${human(r.lri_band ?? "")}` : "Not enough feedback"}</span>}
                </div>
              </div>
              {r?.valid && r.self_avg && r.other_avg && <><Result r={r} x={extras.get(l.assignment_id)} /><Expander say={LEADER_SAY.leader} /></>}
              {devOf(l.assignment_id).length > 0 && <DevPlan assessmentId={id} assignmentId={l.assignment_id} items={devOf(l.assignment_id)} editable={consultant} />}
              {r && !r.valid && <p className="ssmall smuted">{r.rater_count} rater form{r.rater_count === 1 ? "" : "s"}; a result needs a self form and at least three raters.</p>}
              {consultant && !asm.frozen_at && <div style={{ marginTop: 10 }}><Nominate assessmentId={id} assignmentId={l.assignment_id} people={options.filter((o) => o.person_id !== l.person_id)} current={mine} locked={!open} /></div>}
            </section>
          );
        })}
        <p className="ssmall smuted">Raters are grouped by relationship. A group with fewer than three raters is merged with others, and a manager&rsquo;s view is never shown on its own.</p>
      </div>
    </StaffShell>
  );
}
