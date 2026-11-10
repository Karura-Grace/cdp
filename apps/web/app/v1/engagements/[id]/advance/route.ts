import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnEngagement, readJson } from "@/lib/staff";
import { DEBRIEF_ACTION, FORWARD, check, loadFacts } from "@/lib/lifecycle";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// POST { to }       move the engagement one step forward. The engine's checkEngagementTransition decides (role, the guard for that step,
//                   and that it is the next step at all); 409 ILLEGAL_TRANSITION with the reason otherwise. The state change is audited.
// POST { debrief }  record that the debrief with the executive team was held (one audit row, once). Needed to start planning.
// PAC Consultant assigned to the engagement only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await consultantOnEngagement(req, id);
  if (c instanceof Response) return c;
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const f = (await loadFacts([id])).get(id);
  if (!f) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });

  if (b.debrief === true) {
    if (f.state !== "DEBRIEF") return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The debrief is recorded while the engagement is in the debrief stage." });
    if (!f.debriefLogged) await audit(c.eng.tenant_id, c.a.userId, DEBRIEF_ACTION, "engagement", id);
    return json({ engagement_id: id, debrief_logged: true, changed: !f.debriefLogged });
  }

  const to = String(b.to ?? "") as E.EngagementState;
  if (!to) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Send to (the next stage) or debrief." });
  if (f.state === to) return json({ engagement_id: id, state: to, changed: false });          // idempotent
  if (FORWARD[f.state] !== to) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: `${f.state} to ${to} is not the next step.` });
  const bad = check(f, to);
  if (bad) return problem(bad);
  const up = await admin().from("engagement").update({ state: to }).eq("engagement_id", id).eq("state", f.state).select("engagement_id");   // from the state the caller saw
  if (up.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  if (!up.data?.length) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The engagement moved while you were looking. Reload and try again." });
  return json({ engagement_id: id, state: to, changed: true });
}
