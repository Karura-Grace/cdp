import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { staffGate } from "@/lib/session";
import { serverDb } from "@/lib/supabase/server";
import OrgClient, { type Org } from "./org-client";
import "../console.css";

export const metadata: Metadata = { title: "Organisations | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Super Admin only (Table 13). Reads go through the user's own token; RLS lets a Super Admin read every tenant and engagement.
export default async function Page() {
  const db = await serverDb();
  const { user } = await staffGate(db, "/organisations");
  const scope = (await db.rpc("rpc_actor_scope")).data as { role: string | null } | null;
  if (scope?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const [{ data: tenants }, { data: engs }] = await Promise.all([
    db.from("tenant").select("tenant_id, name, legal_name, sector, headcount, geographies, privacy_regime, residency_region, timezone, cover_colour, services").order("name"),
    db.from("engagement").select("engagement_id, tenant_id, cycle_no, state").order("cycle_no"),
  ]);
  const orgs: Org[] = (tenants ?? []).map((t) => ({ ...t, engagements: (engs ?? []).filter((e) => e.tenant_id === t.tenant_id) }));

  const { nav, roleLabel } = await staffNav(db, "organisations");
  return (
    <StaffShell title="Organisations" subtitle="Client organisations and their engagements." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      <div><OrgClient orgs={orgs} /></div>
    </StaffShell>
  );
}
