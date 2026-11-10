import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { serverDb } from "@/lib/supabase/server";
import PasswordForm from "./form";
import "../../console.css";

export const metadata: Metadata = { title: "Change password | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const db = await serverDb();
  const { data: u } = await db.auth.getUser();
  if (!u.user) redirect("/login?next=/account/password");
  const prof = (await db.rpc("rpc_my_profile")).data as { must_change_password: boolean } | null;
  const { nav, roleLabel } = await staffNav(db, null);
  return (
    <StaffShell title="Change password" subtitle="Use at least 12 characters, with an upper case letter, a lower case letter and a number." nav={nav} email={u.user.email ?? ""} roleLabel={roleLabel}>
      <div style={{ maxWidth: 520 }}>
        <div className="card">
          <h2>{prof?.must_change_password ? "Choose your own password" : "Change password"}</h2>
          <p className="muted">{prof?.must_change_password ? "You signed in with a temporary password. Replace it to continue." : "Pick a new password for your account."}</p>
          <PasswordForm forced={!!prof?.must_change_password} />
        </div>
      </div>
    </StaffShell>
  );
}
