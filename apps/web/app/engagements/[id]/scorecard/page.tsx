import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { loadScorecard, priorityRefs } from "@/lib/scorecard";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import ScorecardClient from "./scorecard-client";
import "../../../console.css";

export const metadata: Metadata = { title: "Scorecard | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// The strategic scorecard (spec 1.4.3). PAC Consultant and Client Admin edit it while the engagement is in setup; the Executive reads it.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}/scorecard`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id, state").eq("engagement_id", id).maybeSingle();
  const role = eng ? (await db.rpc("rpc_actor_role", { p_engagement: id })).data as string | null : null;
  if (!eng || !role || !["PAC_CONSULTANT", "CLIENT_ADMIN", "EXECUTIVE"].includes(role)) redirect("/dashboard");
  const [objectives, priorities, { data: ten }, { nav, roleLabel }, tabs] = await Promise.all([
    loadScorecard(db, id), priorityRefs(id), admin().from("tenant").select("name").eq("tenant_id", eng.tenant_id).single(), staffNav(db, null), engagementTabs(db, id, "scorecard"),
  ]);
  return (
    <StaffShell section={tabs} title={`Scorecard · ${ten?.name ?? "Engagement"}`} subtitle="Objectives, the KPIs that measure them, and where each starts and must get to." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      <ScorecardClient engagementId={id} editable={role !== "EXECUTIVE" && eng.state === "SETUP"} locked={eng.state !== "SETUP"} priorities={priorities} initial={objectives} />
    </StaffShell>
  );
}
