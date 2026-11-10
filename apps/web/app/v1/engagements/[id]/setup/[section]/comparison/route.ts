import { audit } from "@/lib/audit";
import { admin } from "@/lib/supabase/admin";
import { PERSPECTIVE_SECTIONS, comparable, loadComparison } from "@/lib/setup-compare";
import { setupReader } from "@/lib/setup-access";
import { consultantOnEngagement, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const bad = (section: string) => (PERSPECTIVE_SECTIONS as readonly string[]).includes(section) ? null : problem({ code: "VALIDATION_FAILED", status: 422, title: "Only Sections E, F and G are compared." });

// S1-07: the Executive, HR and Agreed entries side by side, with a divergence flag per field and the SETUP_DIVERGENCE findings (spec 1.5.4).
export async function GET(req: Request, { params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  const g = await setupReader(req, id);
  if (g instanceof Response) return g;
  return bad(section) ?? json(await loadComparison(id, section));
}

// The consultant's judgement for text fields: body { flags: { e1: true, e2: false } }. F1 tags are compared by the engine, so "behaviours" is refused.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  const refused = bad(section);
  if (refused) return refused;
  if (g.eng.state !== "SETUP") return problem({ code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." });
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const flags = b.flags;
  const keys = comparable(section).filter((f) => !(section === "F" && f.key === "behaviours")).map((f) => f.key);
  if (!flags || typeof flags !== "object" || Array.isArray(flags) || !Object.entries(flags).length || Object.entries(flags).some(([k, v]) => !keys.includes(k) || typeof v !== "boolean"))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: `flags must set true or false for these fields: ${keys.join(", ")}. F1 tags are compared automatically.` });

  const db = admin();
  const { data: row } = await db.from("setup_record").select("setup_id, divergence_flags").eq("engagement_id", id).eq("section", section).eq("perspective", "AGREED").maybeSingle();
  const merged = { ...((row?.divergence_flags ?? {}) as Record<string, boolean>), ...(flags as Record<string, boolean>) };
  const w = row
    ? await db.from("setup_record").update({ divergence_flags: merged, updated_by: g.a.userId }).eq("setup_id", row.setup_id).select("setup_id").single()
    : await db.from("setup_record").insert({ tenant_id: g.eng.tenant_id, engagement_id: id, section, perspective: "AGREED", payload_json: {}, status: "DRAFT", divergence_flags: merged, created_by: g.a.userId, updated_by: g.a.userId }).select("setup_id").single();
  if (w.error) return fromDbError(w.error.message);
  await audit(g.eng.tenant_id, g.a.userId, `setup.divergence_flagged:${section}`, "setup_record", w.data.setup_id);
  return json(await loadComparison(id, section));
}
