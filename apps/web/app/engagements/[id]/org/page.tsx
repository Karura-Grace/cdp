import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { clientLogo } from "@/lib/report-extras";
import LogoForm from "./logo-form";
import TagsPanel from "./tags-panel";
import { servicesOf } from "@/lib/services";
import CoverColourForm from "./cover-colour-form";
import { invitedForEngagement, leaderScope, loadGraph, loadOverrides, reportingChains, validate } from "@/lib/org-graph";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import OrgClient from "./org-client";
import "../../../console.css";

export const metadata: Metadata = { title: "Organisation and leaders | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Every read here goes through the signed-in user's token, so RLS decides what appears: work emails reach only the
// PAC Consultant and the tenant's Client Admin. People Leaders see nothing yet (own-team scope needs a login-to-person link).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}/org`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id, cycle_no, state").eq("engagement_id", id).maybeSingle();
  const role = eng ? ((await db.rpc("rpc_actor_role", { p_engagement: id })).data as string | null) : null;
  if (!eng || !role || !["PAC_CONSULTANT", "CLIENT_ADMIN", "SUPER_ADMIN", "EXECUTIVE"].includes(role)) redirect("/dashboard");

  const { data: tenant } = await db.from("tenant").select("name").eq("tenant_id", eng.tenant_id).maybeSingle();
  const paid = await servicesOf(eng.tenant_id);
  const logo = await clientLogo(eng.tenant_id);
  const cover = role === "PAC_CONSULTANT" ? (await admin().from("tenant").select("cover_colour").eq("tenant_id", eng.tenant_id).maybeSingle()).data?.cover_colour ?? null : null;
  const { data: asm } = await admin().from("assessment").select("window_open, status").eq("engagement_id", id).neq("status", "SUPERSEDED").maybeSingle();
  const windowStart = asm?.window_open?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const { graph } = await loadGraph(db, eng.tenant_id);
  const overrides = await loadOverrides(db, id);
  const defects = validate(graph, windowStart, overrides, await invitedForEngagement(id));
  const { data: fielding } = await admin().from("engagement").select("engagement_id").eq("tenant_id", eng.tenant_id).eq("state", "FIELDING").neq("engagement_id", id);
  const editor = role === "PAC_CONSULTANT" || role === "CLIENT_ADMIN";
  const open = eng.state === "SETUP" && !fielding?.length;

  const teams = graph.units.filter((u) => u.type === "TEAM").map((u) => ({ key: u.unit_key, name: u.name }));
  const active = graph.people.filter((p) => p.employment_status === "ACTIVE").length;
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, id, "org")]);
  return (
    <StaffShell section={tabs} title={`Organisation and leaders · ${tenant?.name ?? "Organisation"}`} subtitle="Units, people, grades and who leads which team." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}
      actions={role === "PAC_CONSULTANT" ? <a className="sbtn ghost" href={`/engagements/${id}/setup`}>Setup and launch</a> : role === "CLIENT_ADMIN" ? <a className="sbtn ghost" href={`/engagements/${id}/setup/perspectives`}>Executive and HR entries</a> : undefined}>
      <div>
        {paid.includes("CLIENT_LOGO") && <LogoForm tenantId={eng.tenant_id} current={logo ? `data:${logo.type};base64,${logo.base64}` : null} />}
        {role === "PAC_CONSULTANT" && <CoverColourForm tenantId={eng.tenant_id} current={cover} />}
        {editor && <TagsPanel engagementId={id} showTags />}
        <OrgClient engagementId={id} editor={editor} consultant={role === "PAC_CONSULTANT"} open={open}
          lockedWhy={eng.state !== "SETUP" ? "The engagement has launched, so the graph is fixed." : fielding?.length ? "Another engagement of this organisation is collecting responses." : ""}
          windowStart={windowStart} windowFromAssessment={!!asm?.window_open} defects={defects} overrides={overrides}
          counts={{ units: graph.units.length, teams: teams.length, people: graph.people.length, active, leaders: graph.leaders.length, grades: graph.grades.length, locations: graph.locations.length }}
          teams={teams} leaders={editor ? graph.leaders : graph.leaders.map((l) => ({ ...l, employee_ref: "–" }))}
          chains={editor ? reportingChains(graph, windowStart) : []} scope={leaderScope(graph, windowStart).map((s) => ({ team_key: s.team_key, headcount_led: s.headcount_led }))} />
      </div>
    </StaffShell>
  );
}
