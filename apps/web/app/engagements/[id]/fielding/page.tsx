import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import FieldingClient from "./fielding-client";
import "../../../console.css";

export const metadata: Metadata = { title: "Fielding | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Journey 2: the survey while it runs. Client Admin and PAC Consultant see responses by cohort (five or more invited only) and the
// window with its extensions; the consultant also extends the window, reads the quality monitor, voids a response with a reason, and,
// after freeze, reviews the 360 rater comments. Every number comes from the /v1 routes; nothing here reads a response.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}/fielding`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id").eq("engagement_id", id).maybeSingle();
  const role = eng ? ((await db.rpc("rpc_actor_role", { p_engagement: id })).data as string | null) : null;
  if (!eng || (role !== "PAC_CONSULTANT" && role !== "CLIENT_ADMIN")) redirect("/dashboard");
  const sa = admin();
  const { data: asm } = await sa.from("assessment").select("assessment_id, status, frozen_at, window_close").eq("engagement_id", id).neq("status", "SUPERSEDED").maybeSingle();
  const { data: ten } = await sa.from("tenant").select("name").eq("tenant_id", eng.tenant_id).single();
  // leaders with raters on this assessment, by name, for the comment review (consultant, after freeze)
  let leaders: { id: string; name: string }[] = [];
  if (asm && role === "PAC_CONSULTANT" && asm.frozen_at) {
    const ids = [...new Set(((await sa.from("rater_nomination").select("assignment_id").eq("assessment_id", asm.assessment_id)).data ?? []).map((r) => r.assignment_id))];
    const { data: la } = ids.length ? await sa.from("leader_assignment").select("assignment_id, person_id").in("assignment_id", ids) : { data: [] };
    const { data: ppl } = la?.length ? await sa.from("person_of_record").select("person_id, display_name, employee_ref").in("person_id", la.map((x) => x.person_id)) : { data: [] };
    leaders = (la ?? []).map((x) => { const p = ppl?.find((y) => y.person_id === x.person_id); return { id: x.assignment_id, name: p?.display_name ?? p?.employee_ref ?? x.assignment_id }; })
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, id, "fielding")]);
  return (
    <StaffShell section={tabs} title={`Fielding · ${ten?.name ?? "Engagement"}`} subtitle="Responses, the survey window and data quality while the survey runs." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      {!asm || asm.status === "DRAFT"
        ? <div className="card"><p className="muted">Nothing to show until the survey is launched.</p></div>
        : <FieldingClient assessmentId={asm.assessment_id} consultant={role === "PAC_CONSULTANT"} open={asm.status === "LAUNCHED" && !asm.frozen_at} frozen={!!asm.frozen_at} leaders={leaders} />}
    </StaffShell>
  );
}
