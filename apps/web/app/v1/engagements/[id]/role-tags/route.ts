import { admin } from "@/lib/supabase/admin";
import { graphEditor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const TAGS = ["STAFF", "LEADER", "EXECUTIVE"];

// PUT { tags: [{ employee_ref, role_tag }] }: the Client Admin (or the assigned consultant) tags people staff, leader or executive for the Leadership 360
// (owner ruling 22 Oct 2026, Erick Ngala comment 39; rounds Q-SV3 and Q-SV4). A null role_tag clears the tag. The tag wins for the executive cohort when set,
// otherwise the grade flag decides. A LEADER tag makes nobody a leader on its own: leaders still need a team in the leaders file.
// The tag is written on the survey link when it is issued, so a person who has already been issued a link in any assessment cannot be re tagged (409).
// GET returns every person's tag and whether it is locked. Every change is audited.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphEditor(req, id);
  if (g instanceof Response) return g;
  const sa = admin();
  const [{ data: people }, { data: locked }] = await Promise.all([
    sa.from("person_of_record").select("person_id, employee_ref, display_name, role_tag, grade_id").eq("tenant_id", g.eng.tenant_id).order("employee_ref").limit(5000),
    sa.from("invitation_roster").select("person_id").eq("tenant_id", g.eng.tenant_id),
  ]);
  const lock = new Set((locked ?? []).map((r) => r.person_id));
  return json({ people: (people ?? []).map((p) => ({ employee_ref: p.employee_ref, name: p.display_name, role_tag: p.role_tag, locked: lock.has(p.person_id) })) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphEditor(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 256 * 1024);
  if (b instanceof Response) return b;
  const tags = b.tags as { employee_ref?: unknown; role_tag?: unknown }[] | undefined;
  if (!Array.isArray(tags) || !tags.length || tags.length > 5000 || tags.some((t) => typeof t?.employee_ref !== "string" || !(t.role_tag === null || TAGS.includes(String(t.role_tag)))))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: `tags must be a list of { employee_ref, role_tag } with role_tag ${TAGS.join(", ")} or null.` });
  const sa = admin();
  const refs = [...new Set(tags.map((t) => String(t.employee_ref)))];
  const { data: people } = await sa.from("person_of_record").select("person_id, employee_ref, role_tag").eq("tenant_id", g.eng.tenant_id).in("employee_ref", refs);
  const byRef = new Map((people ?? []).map((p) => [p.employee_ref, p]));
  const unknown = refs.filter((r) => !byRef.has(r));
  if (unknown.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: `Unknown people: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? " and more" : ""}.` });
  const { data: roster } = await sa.from("invitation_roster").select("person_id").eq("tenant_id", g.eng.tenant_id).in("person_id", (people ?? []).map((p) => p.person_id));
  const issued = new Set((roster ?? []).map((r) => r.person_id));
  const changing = tags.filter((t) => byRef.get(String(t.employee_ref))!.role_tag !== (t.role_tag as string | null));
  const blocked = changing.filter((t) => issued.has(byRef.get(String(t.employee_ref))!.person_id)).map((t) => String(t.employee_ref));
  if (blocked.length) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: `A survey link has already been issued to ${blocked.length} of these people, so their tag cannot change.`, locked: blocked.slice(0, 20) });
  // written by the database function, which checks the caller, refuses people who already have a link, and audits the change
  const { data, error } = await sa.rpc("rpc_role_tags_set", { p_actor: g.a.userId, p_engagement: id, p_tags: tags.map((t) => ({ employee_ref: String(t.employee_ref), role_tag: t.role_tag as string | null })) as never });
  if (error) return fromDbError(error.message);
  return json(data);
}
