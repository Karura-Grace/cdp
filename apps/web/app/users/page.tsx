import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import UsersClient, { type UserRow } from "./users-client";
import "../console.css";

export const metadata: Metadata = { title: "Users | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Super Admin and Client Admin only. The list itself comes from a database function that re-derives what the caller may
// see (all users, or their own tenant's), so a tampered request cannot widen it.
export default async function Page() {
  const db = await serverDb();
  const { user } = await staffGate(db, "/users");
  const scope = (await db.rpc("rpc_actor_scope")).data as { role: string | null; tenant_id: string | null } | null;
  if (scope?.role !== "SUPER_ADMIN" && scope?.role !== "CLIENT_ADMIN") redirect("/dashboard");

  const { data: users } = await admin().rpc("rpc_users_list", { p_actor: user.id });
  const sa = scope.role === "SUPER_ADMIN";
  const tenants = sa ? ((await db.from("tenant").select("tenant_id, name").order("name")).data ?? []) : [];
  const engagements = sa ? ((await db.from("engagement").select("engagement_id, tenant_id, cycle_no")).data ?? []) : [];
  const tname = new Map(tenants.map((t) => [t.tenant_id, t.name]));
  // the roster, for linking a People Leader login to a person (names only; the list is already limited to what the caller manages)
  const tenantIds = [...new Set(((users ?? []) as unknown as { tenant_id: string | null; role: string }[]).filter((u) => u.role === "PEOPLE_LEADER" && u.tenant_id).map((u) => u.tenant_id!))];
  const { data: roster } = tenantIds.length ? await admin().from("person_of_record").select("person_id, tenant_id, display_name, email").in("tenant_id", tenantIds).eq("employment_status", "ACTIVE").order("display_name") : { data: [] };
  const people = (roster ?? []).map((r) => ({ person_id: r.person_id, tenant_id: r.tenant_id, label: r.display_name ?? r.email }));

  const { nav, roleLabel } = await staffNav(db, "users");
  return (
    <StaffShell title="Users" subtitle={sa ? "Everyone who can sign in, across all organisations." : "Who can sign in for your organisation."} nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      <div>
        <UsersClient people={people} users={(users ?? []) as unknown as UserRow[]} selfId={user.id} isSuper={sa} tenants={tenants}
          engagements={engagements.map((e) => ({ id: e.engagement_id, label: `${tname.get(e.tenant_id) ?? e.tenant_id} · cycle ${e.cycle_no}` }))} />
      </div>
    </StaffShell>
  );
}
