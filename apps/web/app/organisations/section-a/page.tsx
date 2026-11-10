import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { staffGate } from "@/lib/session";
import { serverDb } from "@/lib/supabase/server";
import SectionAClient, { type Row } from "./section-a-client";
import "../../console.css";

export const metadata: Metadata = { title: "Section A across clients | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Super Admin only (owner ruling 19 Oct 2026): A1 to A4 of every client on one page, editable while the client's latest engagement is in SETUP.
export default async function Page() {
  const db = await serverDb();
  const { user } = await staffGate(db, "/organisations/section-a");
  const scope = (await db.rpc("rpc_actor_scope")).data as { role: string | null } | null;
  if (scope?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const [{ data: tenants }, { data: engs }] = await Promise.all([
    db.from("tenant").select("tenant_id, name, sector, headcount, geographies").order("name"),
    db.from("engagement").select("tenant_id, cycle_no, state").order("cycle_no"),
  ]);
  const rows: Row[] = (tenants ?? []).map((t) => {
    const last = (engs ?? []).filter((e) => e.tenant_id === t.tenant_id).at(-1);
    return { ...t, state: last?.state ?? null, editable: !last || last.state === "SETUP" };
  });

  const { nav, roleLabel } = await staffNav(db, "section-a");
  return (
    <StaffShell title="Section A across clients" subtitle="A1 to A4: name, sector, headcount and countries of every client." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      <div><SectionAClient rows={rows} /></div>
    </StaffShell>
  );
}
