import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { STAFF_TEMPLATE_VERSION } from "@/lib/staff-message";
import { actor, readJson } from "@/lib/staff";
import { superAdmin } from "@/lib/users";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const state = async () => {
  const { data } = await admin().from("platform_setting").select("value, updated_at").eq("key", "staff_templates_approved").maybeSingle();
  const v = (data?.value ?? {}) as { approved_version?: string | null };
  return { version: STAFF_TEMPLATE_VERSION, approved: v.approved_version === STAFF_TEMPLATE_VERSION, approved_version: v.approved_version ?? null, updated_at: data?.updated_at ?? null };
};

// Whether the owner has approved the staff message templates in this build. Any signed in staff user can read it.
export async function GET(req: Request) {
  if (!(await actor(req))) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  return json(await state());
}

// PUT { approved: boolean }: only a Super Admin gives or withdraws the approval. A consultant cannot (403).
export async function PUT(req: Request) {
  const g = await superAdmin(req);
  if (g instanceof Response) return g;
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  if (typeof b.approved !== "boolean") return problem({ code: "VALIDATION_FAILED", status: 422, title: "approved must be true or false." });
  const up = await admin().from("platform_setting").upsert({
    key: "staff_templates_approved", value: { approved_version: b.approved ? STAFF_TEMPLATE_VERSION : null, approved_by: g.a.userId }, updated_by: g.a.userId, updated_at: new Date().toISOString(),
  });
  if (up.error) return fromDbError(up.error.message);
  await audit(null, g.a.userId, b.approved ? `staff_templates.approved:${STAFF_TEMPLATE_VERSION}` : "staff_templates.withdrawn", "platform_setting", "staff_templates_approved");
  return json(await state());
}
