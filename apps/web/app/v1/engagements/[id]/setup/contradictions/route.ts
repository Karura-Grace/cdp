import { audit } from "@/lib/audit";
import { admin } from "@/lib/supabase/admin";
import { contradictions } from "@/lib/setup-output";
import { setupReader } from "@/lib/setup-access";
import { consultantOnEngagement, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Spec Table 16: H1, H3 and H4 each carry a contradiction flag the consultant may set from the REPORTING state onward (decision 18 Oct 2026, earlier: after the debrief); the flag is evidence for C3.
// Setup is locked by then, so the flags sit on the engagement. Before the debrief the Section H form still holds them.
const FROM_REPORTING = ["REPORTING", "DEBRIEF", "PLANNING", "IMPLEMENTATION", "PULSE", "RE_ASSESSMENT", "CLOSED"];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await setupReader(req, id);
  if (g instanceof Response) return g;
  return json(await contradictions(id));
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  if (!FROM_REPORTING.includes(g.eng.state)) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The contradiction flags are set once the engagement reaches reporting." });
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const keys = ["h1", "h3", "h4"].filter((k) => k in b);
  if (!keys.length || keys.some((k) => typeof b[k] !== "boolean") || Object.keys(b).some((k) => !["h1", "h3", "h4"].includes(k)))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "Send h1, h3 or h4 as true or false." });
  const db = admin();
  const { data: eng } = await db.from("engagement").select("contradiction_flags").eq("engagement_id", id).single();
  const next = { ...((eng?.contradiction_flags ?? {}) as Record<string, unknown>), ...Object.fromEntries(keys.map((k) => [k, b[k]])), set_by: g.a.userId, set_at: new Date().toISOString() };
  const up = await db.from("engagement").update({ contradiction_flags: next as never, updated_by: g.a.userId }).eq("engagement_id", id);
  if (up.error) return fromDbError(up.error.message);
  await audit(g.eng.tenant_id, g.a.userId, `setup.contradiction_flags:${keys.join(",")}`, "engagement", id);
  return json(await contradictions(id));
}
