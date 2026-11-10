import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { templatesApproved } from "@/lib/launch-checks";
import { staffGate } from "@/lib/session";
import { STAFF_TEMPLATE_VERSION, staffMessage } from "@/lib/staff-message";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import TemplatesClient from "./templates-client";
import "../console.css";

export const metadata: Metadata = { title: "Staff message templates | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Super Admin only. The owner reads the two DRAFT staff message templates here and approves them. Until then a launch that uses a template
// word for word is blocked (pre-flight I5). A consultant cannot approve.
export default async function Page() {
  const db = await serverDb();
  const { user } = await staffGate(db, "/templates");
  const scope = (await db.rpc("rpc_actor_scope")).data as { role: string | null } | null;
  if (scope?.role !== "SUPER_ADMIN") redirect("/dashboard");
  const approved = await templatesApproved(admin());
  const ctx = { org: "[Organisation name]", purpose: null };
  const { nav, roleLabel } = await staffNav(db, null);
  return (
    <StaffShell title="Staff message templates" subtitle="DRAFT wording for the message to staff. Approve it before any launch can use it." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      <div><TemplatesClient approved={approved} version={STAFF_TEMPLATE_VERSION} drafts={{ FULL: staffMessage("FULL", ctx), CONFIDENTIAL_AGGREGATE: staffMessage("CONFIDENTIAL_AGGREGATE", ctx) }} /></div>
    </StaffShell>
  );
}
