import type { StaffNav } from "@/components/staff-shell";
import { human } from "./format";

type Db = { rpc: (fn: "rpc_actor_scope") => PromiseLike<{ data: unknown }> };

// The main rail for every staff page: what the signed-in user may open, and a label for their role.
export async function staffNav(db: Db, active: "portfolio" | "organisations" | "section-a" | "users" | null) {
  const scope = (await db.rpc("rpc_actor_scope")).data as { role: string | null } | null;
  const role = scope?.role ?? null;
  const nav: StaffNav[] = [
    { href: "/dashboard", label: "Portfolio", icon: "portfolio", active: active === "portfolio" },
    ...(role === "SUPER_ADMIN" ? [{ href: "/organisations", label: "Organisations", icon: "building" as const, active: active === "organisations" }] : []),
    ...(role === "SUPER_ADMIN" ? [{ href: "/organisations/section-a", label: "Section A", icon: "building" as const, active: active === "section-a" }] : []),
    ...(role === "SUPER_ADMIN" ? [{ href: "/templates", label: "Staff messages", icon: "overview" as const, active: false }] : []),
    { href: "/glossary", label: "Glossary", icon: "overview" as const, active: false },
    ...(role === "SUPER_ADMIN" || role === "CLIENT_ADMIN" ? [{ href: "/users", label: "Users", icon: "users" as const, active: active === "users" }] : []),
  ];
  return { nav, role, roleLabel: role === "PAC_CONSULTANT" ? "PAC Consultant" : role ? human(role) : "Member" };
}
