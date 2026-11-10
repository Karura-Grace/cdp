import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { Database } from "./supabase/database.types";

/**
 * Gate for staff pages: signed in, account active, temporary password replaced. The database is the real control (an
 * inactive user's token is refused by RLS); this is the part the user sees. Not used on /account/password itself.
 */
export async function staffGate(db: SupabaseClient<Database>, next: string) {
  const { data: u } = await db.auth.getUser();
  if (!u.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const prof = (await db.rpc("rpc_my_profile")).data as { active: boolean; must_change_password: boolean; full_name: string } | null;
  if (prof && prof.active === false) redirect("/login?inactive=1");
  if (prof?.must_change_password) redirect("/account/password");
  return { user: u.user, fullName: prof?.full_name ?? "" };
}
