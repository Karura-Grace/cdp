import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { MeterTile } from "@/components/portal";
import { ENG_SAY } from "@/lib/report-copy";
import { State } from "@/components/state";
import Pipeline from "@/app/dashboard/pipeline";
import { staffNav } from "@/lib/staff-nav";
import Roi from "./roi";
import { engagementTabs } from "@/lib/engagement-tabs";
import { fieldingCounts, rate } from "@/lib/fielding";
import { human } from "@/lib/format";
import { STAGES, consultantNext, journey } from "@/lib/journey";
import { loadFacts } from "@/lib/lifecycle";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Engagement | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// The engagement console: where it stands, the next step, and every other page one tab away.
// Counts only: invitations and submissions, never who answered. Reports come through RLS, so client roles see released ones only.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id, cycle_no, state").eq("engagement_id", id).maybeSingle();
  const role = eng ? ((await db.rpc("rpc_actor_role", { p_engagement: id })).data as string | null) : null;
  if (!eng || !role) redirect("/dashboard");
  const consultant = role === "PAC_CONSULTANT";
  const sa = admin();

  const [{ data: ten }, { data: asm }, { data: reports }, { count: people }, { data: setup }] = await Promise.all([
    sa.from("tenant").select("name, headcount").eq("tenant_id", eng.tenant_id).single(),
    sa.from("assessment").select("assessment_id, status, window_open, window_close, frozen_at").eq("engagement_id", id).neq("status", "SUPERSEDED").maybeSingle(),
    db.from("report").select("report_id, assessment_id, type, status, released_at").order("created_at", { ascending: false }),
    consultant || role === "CLIENT_ADMIN" ? sa.from("person_of_record").select("person_id", { count: "exact", head: true }).eq("tenant_id", eng.tenant_id) : Promise.resolve({ count: null }),
    consultant ? db.from("setup_record").select("section, status, locked_at").eq("engagement_id", id).eq("perspective", "AGREED") : Promise.resolve({ data: null }),
  ]);
  const reps = (reports ?? []).filter((r) => r.assessment_id === asm?.assessment_id);
  const fl = consultant && asm && asm.status !== "DRAFT" ? await fieldingCounts(asm.assessment_id) : null;
  const attrition = consultant ? (((await sa.from("setup_record").select("payload_json").eq("engagement_id", id).eq("section", "C").eq("perspective", "AGREED").maybeSingle()).data?.payload_json as { attrition_pct?: number } | null)?.attrition_pct ?? null) : null;
  const agreed = (setup ?? []).filter((s) => s.status === "AGREED" || s.locked_at).length;

  let next: { label: string; url?: string; href?: string; body?: unknown } | null = null;
  if (consultant && eng.state === "SETUP" && (!asm || asm.status === "DRAFT")) next = { label: asm ? "Review setup and launch" : "Set up the assessment", href: `/engagements/${id}/setup` };
  else if (consultant && asm) {
    const [{ data: scores }, { data: evals }, facts] = await Promise.all([
      db.from("score_object").select("assessment_id, version, frozen_at").eq("assessment_id", asm.assessment_id).order("version"),
      db.from("evaluation").select("assessment_id, score_version").eq("assessment_id", asm.assessment_id),
      loadFacts(["REPORTING", "DEBRIEF", "PLANNING", "IMPLEMENTATION", "PULSE", "RE_ASSESSMENT"].includes(eng.state) ? [id] : []),
    ]);
    next = consultantNext(eng, asm, scores ?? [], evals ?? [], reps, facts.get(id));
  } else if (role === "CLIENT_ADMIN" && eng.state === "SETUP") next = { label: "Load the organisation, people and leaders", href: `/engagements/${id}/org` };

  const j = journey(role, eng.state);
  const at = STAGES.findIndex((s) => s.states.includes(eng.state));
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, id, "overview")]);
  return (
    <StaffShell title={ten?.name ?? "Engagement"} subtitle={`Cycle ${eng.cycle_no}${asm?.window_close ? ` · survey window closes ${asm.window_close.slice(0, 10)}` : ""}`} nav={nav} email={user.email ?? ""}
      roleLabel={roleLabel} section={tabs} actions={<>{consultant && <><a className="sbtn ghost" href="/preview">Preview the survey</a><a className="sbtn ghost" href="/preview/360?as=rater">Preview the 360</a></>}<a className="sbtn ghost" href="/dashboard">All engagements</a></>}>
      <section className="scard">
        <p className="stf-where"><b>Step {j.step} of {j.of}: {j.stage}.</b><span className="stf-who">{j.text}</span></p>
        <div className="stf-stages" aria-label={`Stage: ${human(eng.state)}`}>
          {STAGES.map((s, i) => <div key={s.label} className={`stf-stage${i < at ? " done" : i === at ? " now" : ""}`}>{s.label}</div>)}
        </div>
        {next && (next.url ? <Pipeline label={next.label} url={next.url} body={next.body} />
          : next.href ? <div className="stf-next"><span className="k">Next step</span><a className="sbtn orange" href={next.href}>{next.label}</a></div>
          : <div className="stf-next"><span className="k">Next step</span><span className="ssmall">{next.label}</span></div>)}
      </section>

      <div className="stf-kpis">
        {people !== null && <MeterTile label="People loaded" value={String(people)} word={people ? "Loaded" : "None yet"} tone={people ? "ok" : "warn"} pct={people ? 100 : 0} say={ENG_SAY.people} />}
        {consultant && <MeterTile label="Setup sections agreed" value={`${agreed} of 9`} word={agreed >= 9 ? "Ready" : "In progress"} tone={agreed >= 9 ? "ok" : ""} pct={(agreed / 9) * 100} say={ENG_SAY.setup} />}
        {fl && <MeterTile label="Survey responses" value={`${fl.submitted} of ${fl.invited}`} word={`${rate(fl)}% response rate`} pct={rate(fl)} say={ENG_SAY.responses} />}
        <MeterTile label="Reports released" value={String(reps.filter((r) => r.status === "RELEASED").length)} word={consultant ? `${reps.filter((r) => r.status !== "RELEASED").length} draft` : "For you"} tone={reps.some((r) => r.status === "RELEASED") ? "ok" : ""} pct={reps.length ? (reps.filter((r) => r.status === "RELEASED").length / reps.length) * 100 : 0} say={ENG_SAY.reports} />
      </div>

      {consultant && <Roi headcount={ten?.headcount ?? null} attrition={attrition} />}

      <section className="scard">
        <div className="scard-head"><div><h2>Reports</h2><div className="ssmall smuted">{consultant ? "Drafts stay with PAC until you release them." : "Reports appear here once your PAC consultant releases them."}</div></div></div>
        {reps.length === 0 ? <State tone="empty" title="No reports yet">{consultant ? "Reports are created after the score is frozen and the findings are run." : "Nothing has been released yet."}</State> : (
          <div className="stblwrap"><table className="stbl">
            <thead><tr><th>Report</th><th>Status</th><th style={{ textAlign: "right" }} /></tr></thead>
            <tbody>{reps.slice(0, SHOWN).map(reportRow)}</tbody>
          </table></div>)}
        {reps.length > SHOWN && <details><summary className="ssmall">Show {reps.length - SHOWN} older reports</summary>
          <div className="stblwrap"><table className="stbl"><tbody>{reps.slice(SHOWN).map(reportRow)}</tbody></table></div></details>}
      </section>
    </StaffShell>
  );
}

const SHOWN = 8;   // newest first; older ones fold away
const reportRow = (r: { report_id: string; type: string; status: string; released_at: string | null }) => (
  <tr key={r.report_id}>
    <td><strong>{human(r.type)}</strong></td>
    <td>{r.status === "RELEASED" ? <span className="stag ok">Released {r.released_at?.slice(0, 10)}</span> : <span className="stag warn">Draft</span>}</td>
    <td style={{ textAlign: "right" }}><a className="sbtn ghost" href={`/reports/${r.report_id}`}>Open</a></td>
  </tr>);
