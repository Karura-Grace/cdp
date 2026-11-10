import { servicesOf } from "@/lib/services";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { raterDefaults } from "@/lib/rater-defaults";
import { all, leaderScope, loadGraph, reportingChains } from "@/lib/org-graph";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import RatersClient from "./raters-client";
import "../../../console.css";

export const metadata: Metadata = { title: "Leadership 360 raters | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Rater proposals (spec 1.4.6, D-09). A leader proposes raters for their own 360; the line manager approves, or the Client Admin on their
// behalf. The consultant can propose on a leader's behalf and sees the state. A People Leader sees only the leaders they propose for or approve.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}/raters`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id").eq("engagement_id", id).maybeSingle();
  const role = eng ? (await db.rpc("rpc_actor_role", { p_engagement: id })).data as string | null : null;
  if (!eng || !role || !["PAC_CONSULTANT", "CLIENT_ADMIN", "PEOPLE_LEADER"].includes(role)) redirect("/dashboard");

  const sa = admin();
  if (!(await servicesOf(eng.tenant_id)).includes("LEADERSHIP_360")) redirect("/dashboard");   // a paid service (owner ruling 22 Oct 2026)
  const { data: asm } = await sa.from("assessment").select("assessment_id, status, frozen_at, window_open, window_close").eq("engagement_id", id).neq("status", "SUPERSEDED").maybeSingle();
  const { data: ten } = await sa.from("tenant").select("name").eq("tenant_id", eng.tenant_id).single();
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, id, "raters")]);
  const shell = (body: React.ReactNode) => (
    <StaffShell section={tabs} title={`Leadership 360 raters · ${ten?.name ?? "Engagement"}`} subtitle="Who rates each leader: proposed by the leader, approved by their line manager." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>{body}</StaffShell>
  );
  if (!asm || !["DRAFT", "LAUNCHED"].includes(asm.status) || asm.frozen_at) return shell(<div className="card"><p className="muted">Raters can be proposed while the assessment is a draft or open. {asm ? "This one is closed to changes." : "There is no assessment yet."}</p></div>);

  const windowStart = (asm.window_open ?? new Date().toISOString()).slice(0, 10);
  const { graph } = await loadGraph(sa, eng.tenant_id);
  const people = await all((a, b) => sa.from("person_of_record").select("person_id, employee_ref, display_name, email, employment_status").eq("tenant_id", eng.tenant_id).order("person_id").range(a, b));
  const personOfRef = new Map(people.map((p) => [p.employee_ref, p.person_id]));
  const nameOf = new Map(people.map((p) => [p.person_id, p.display_name ?? p.email]));
  const me = role === "PEOPLE_LEADER" ? ((await db.rpc("rpc_my_person")).data as string | null) : null;
  const chains = reportingChains(graph, windowStart);
  const noms = await all((a, b) => sa.from("rater_nomination").select("nomination_id, assignment_id, rater_person_id, rater_group, status, proposed_by, approved_at").eq("assessment_id", asm.assessment_id).order("nomination_id").range(a, b));

  const { data: wins } = await sa.from("rater_window").select("assignment_id, opens_on, closes_on").eq("assessment_id", asm.assessment_id);
  const leaders = leaderScope(graph, windowStart).flatMap((l) => {
    const gl = graph.leaders.find((x) => x.assignment_id === l.assignment_id)!;
    const leaderPerson = personOfRef.get(gl.employee_ref) ?? "";
    const chain = chains.find((c) => c.leader === gl.employee_ref && c.team_key === gl.team_key);
    const managerPerson = chain?.chain[1] ? personOfRef.get(chain.chain[1]) ?? null : null;
    const isMe = !!me && me === leaderPerson, manages = !!me && !!managerPerson && me === managerPerson;
    if (role === "PEOPLE_LEADER" && !isMe && !manages) return [];
    return [{
      assignment_id: l.assignment_id, team: graph.units.find((u) => u.unit_key === l.team_key)?.name ?? l.team_key, name: nameOf.get(leaderPerson) ?? gl.employee_ref,
      canPropose: role !== "PEOPLE_LEADER" || isMe, canApprove: role === "CLIENT_ADMIN" || manages, canWindow: role !== "PEOPLE_LEADER",
      window: (wins ?? []).find((w) => w.assignment_id === l.assignment_id) ?? null,
      defaults: raterDefaults(graph, windowStart, l.assignment_id, chain?.chain, personOfRef),
      rows: noms.filter((n) => n.assignment_id === l.assignment_id).map((n) => ({ person_id: n.rater_person_id, rater_group: n.rater_group, status: n.status, approved: !!n.approved_at })),
    }];
  }).sort((a, b) => a.name.localeCompare(b.name));
  const options = people.filter((p) => p.employment_status === "ACTIVE").map((p) => ({ person_id: p.person_id, label: p.display_name ?? p.email })).sort((a, b) => a.label.localeCompare(b.label));
  const labels = Object.fromEntries(people.map((p) => [p.person_id, p.display_name ?? p.email]));

  return shell(<RatersClient canAssign={role !== "PEOPLE_LEADER"} assessmentId={asm.assessment_id} asmWindow={{ open: asm.window_open?.slice(0, 10) ?? null, close: asm.window_close?.slice(0, 10) ?? null }} leaders={leaders} options={options} labels={labels} />);
}
