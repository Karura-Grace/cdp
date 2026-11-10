import type { Metadata } from "next";
import { redirect } from "next/navigation";
import * as E from "@pac/cdp-engine";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import CompletionClient from "./completion-client";
import "../../../console.css";

export const metadata: Metadata = { title: "Completion time statement | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Client Admin screen (owner decision, 18 October 2026) for the completion time statement the survey tells people to expect (spec 2.5, D-11).
// After 30 complete responses the measured median is compared with the 30 to 50 minute range and the Client Admin is prompted to update the
// statement. Only counts and a median are read (rpc_completion_stats), never a response. The update goes to PUT /v1/assessments/{id}/completion-estimate.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}/completion`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id").eq("engagement_id", id).maybeSingle();
  const role = eng ? ((await db.rpc("rpc_actor_role", { p_engagement: id })).data as string | null) : null;
  if (!eng || role !== "CLIENT_ADMIN") redirect("/dashboard");

  const sa = admin();
  const { data: asm } = await sa.from("assessment").select("assessment_id, status, frozen_at, completion_estimate_text").eq("engagement_id", id).neq("status", "SUPERSEDED").maybeSingle();
  const { data: ten } = await sa.from("tenant").select("name").eq("tenant_id", eng.tenant_id).single();
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, id, "completion")]);
  let stat: { complete: number; median_seconds: number | null } | null = null, text: string | null = null;
  const open = !!asm && asm.status === "LAUNCHED" && !asm.frozen_at;
  if (asm && open) {
    const { data } = await sa.rpc("rpc_completion_stats", { p_assessment: asm.assessment_id, p_min: E.config.get("segments.floor") });
    stat = (data ?? { complete: 0, median_seconds: null }) as { complete: number; median_seconds: number | null };
    const { data: rec } = await sa.from("setup_record").select("payload_json").eq("engagement_id", id).eq("section", "I").eq("perspective", "AGREED").maybeSingle();
    text = asm.completion_estimate_text ?? (rec?.payload_json as { completion_estimate?: string } | null)?.completion_estimate ?? null;
  }
  return (
    <StaffShell section={tabs} title={`Completion time statement · ${ten?.name ?? "Engagement"}`} subtitle="How long the survey tells people it will take." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      {!asm || !open || !stat
        ? <div className="card"><p className="muted">The statement can be updated while the survey is open. {asm ? "It is not open now." : "There is no assessment yet."}</p></div>
        : <CompletionClient assessmentId={asm.assessment_id} text={text} complete={stat.complete} medianSeconds={stat.median_seconds}
            needsUpdate={stat.median_seconds !== null && E.completionStatementNeedsUpdate(stat.complete, stat.median_seconds)} />}
    </StaffShell>
  );
}
