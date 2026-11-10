import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import ReviewClient from "./review-client";
import "../../../../console.css";

export const metadata: Metadata = { title: "Setup review | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Client side of setup (decision 18 Oct 2026). The Client Admin drafts Sections A to D here; the consultant agrees from the drafts.
// Executives read the agreed sections (read only) and confirm each with a recorded tick. Everything is read through the caller's own client (RLS).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}/setup/review`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id, state").eq("engagement_id", id).maybeSingle();
  const role = eng ? ((await db.rpc("rpc_actor_role", { p_engagement: id })).data as string | null) : null;
  if (!eng || !role || !["PAC_CONSULTANT", "CLIENT_ADMIN", "EXECUTIVE"].includes(role)) redirect("/dashboard");

  const [{ data: tenant }, { data: rows }, { data: ticks }] = await Promise.all([
    admin().from("tenant").select("name, sector, headcount, geographies").eq("tenant_id", eng.tenant_id).single(),
    db.from("setup_record").select("section, perspective, status, payload_json, workshop_date, facilitator, locked_at").eq("engagement_id", id).in("perspective", ["AGREED", "EXECUTIVE"]).order("section"),
    db.from("setup_confirmation").select("section, user_id, confirmed_at").eq("engagement_id", id),
  ]);
  const agreed = (rows ?? []).filter((r) => r.perspective === "AGREED").map((r) => ({ section: r.section, status: r.locked_at ? "LOCKED" : r.status, payload: r.payload_json, workshop_date: r.workshop_date, facilitator: r.facilitator }));
  const drafts = Object.fromEntries((rows ?? []).filter((r) => r.perspective === "EXECUTIVE" && "ABCD".includes(r.section)).map((r) => [r.section, { status: r.status, payload: r.payload_json }]));
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, id, "setup")]);
  return (
    <StaffShell section={tabs} title={`Setup review · ${tenant?.name ?? "Engagement"}`} subtitle="Draft Sections A to D, then confirm what the consultant has agreed." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}
      actions={<a className="sbtn ghost" href={`/engagements/${id}/setup/perspectives`}>Executive and HR entries</a>}>
      <ReviewClient engagementId={id} role={role} locked={eng.state !== "SETUP"} me={user.id} agreed={agreed} drafts={drafts} ticks={ticks ?? []}
        tenant={{ name: tenant?.name ?? "", sector: tenant?.sector ?? null, headcount: tenant?.headcount ?? null, geographies: tenant?.geographies ?? [] }} />
    </StaffShell>
  );
}
