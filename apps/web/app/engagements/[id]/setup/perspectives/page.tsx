import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import { PERSPECTIVE_SECTIONS, loadComparison } from "@/lib/setup-compare";
import RequirementsPanel from "../requirements-panel";
import PerspectivesClient from "./perspectives-client";
import "../../../../console.css";

export const metadata: Metadata = { title: "Executive and HR entries | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Sections E, F and G are captured separately by the executive team and by senior HR, then compared and agreed (spec 1.1, S1-07).
// The consultant and the Client Admin enter the two perspectives; the consultant judges text differences and agrees the record. Executives read.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}/setup/perspectives`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id, state").eq("engagement_id", id).maybeSingle();
  const role = eng ? ((await db.rpc("rpc_actor_role", { p_engagement: id })).data as string | null) : null;
  if (!eng || !role || !["PAC_CONSULTANT", "CLIENT_ADMIN", "EXECUTIVE"].includes(role)) redirect("/dashboard");

  const { data: tenant } = await admin().from("tenant").select("name, sector, headcount, geographies").eq("tenant_id", eng.tenant_id).single();
  const comparisons = await Promise.all(PERSPECTIVE_SECTIONS.map((s) => loadComparison(id, s)));
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, id, "setup")]);
  return (
    <StaffShell section={tabs} title={`Executive and HR entries · ${tenant?.name ?? "Engagement"}`} subtitle="Capture Sections E, F and G separately, compare them, then the consultant agrees the record." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}
      actions={role === "PAC_CONSULTANT" ? <a className="sbtn ghost" href={`/engagements/${id}/setup`}>Back to setup</a> : undefined}>
      <RequirementsPanel engagementId={id} />
      <PerspectivesClient engagementId={id} role={role} locked={eng.state !== "SETUP"} comparisons={comparisons} tenant={{ name: tenant?.name ?? "", sector: tenant?.sector ?? null, headcount: tenant?.headcount ?? null, geographies: tenant?.geographies ?? [] }} />
    </StaffShell>
  );
}
