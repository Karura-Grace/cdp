import { requireServiceForAssessment } from "@/lib/services";
import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnAssessment } from "@/lib/staff";
import { raterWindowAction, type RaterWindow } from "@/lib/rater-window";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// POST: issue 360 links for every leader in scope (one self form each) and every nominated rater not yet invited.
// The tokens are returned once, with the name and email of the person each link is for, so the consultant can send them;
// only token hashes are stored. Leaders in scope come from the launch snapshot.
// Rater window (owner decision, 18 October 2026): a leader's raters get links only from the day their window opens, never after it closed,
// and each link expires at the close of the window (the expiry is what refuses a late answer). The leader's own self form is not windowed.
// Raters held back are listed under `skipped` and are issued by a later call inside their window.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForAssessment(id, "LEADERSHIP_360"); if (svcOff) return svcOff;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const { a, asm } = g;
  if (asm.status !== "LAUNCHED" || asm.frozen_at) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "360 links can be issued only while the assessment is open." });
  const db = admin();
  const { data: snap } = await db.from("org_graph_snapshot").select("scope_json").eq("engagement_id", asm.engagement_id).maybeSingle();
  const scope = ((snap?.scope_json ?? []) as { assignment_id: string }[]).map((l) => l.assignment_id);
  if (!scope.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: "No leaders are in scope for this assessment." });

  const { data: leaders } = await db.from("leader_assignment").select("assignment_id, person_id").in("assignment_id", scope);
  const { data: counts } = await db.rpc("rpc_counts_360", { p_assessment_id: id });
  const hasSelf = new Set(((counts ?? []) as { assignment_id: string; kind: string }[]).filter((c) => c.kind === "SELF").map((c) => c.assignment_id));
  const { data: noms } = await db.from("rater_nomination").select("assignment_id, rater_person_id, rater_group").eq("assessment_id", id).eq("status", "NOMINATED");
  const items = [
    ...(leaders ?? []).filter((l) => !hasSelf.has(l.assignment_id)).map((l) => ({ assignment_id: l.assignment_id, person_id: l.person_id, kind: "SELF" })),
    ...(noms ?? []).filter((n) => scope.includes(n.assignment_id)).map((n) => ({ assignment_id: n.assignment_id, person_id: n.rater_person_id, kind: "RATER", rater_group: n.rater_group })),
  ];
  const { data: wins } = await db.from("rater_window").select("assignment_id, opens_on, closes_on").eq("assessment_id", id);
  const win = new Map<string, RaterWindow>((wins ?? []).map((w) => [w.assignment_id, { opens_on: w.opens_on, closes_on: w.closes_on }]));
  const today = new Date().toISOString().slice(0, 10);
  const skipped: { assignment_id: string; person_id: string; why: string }[] = [];
  const batches = new Map<string, typeof items>();   // by expiry ("" is the assessment's own close)
  for (const it of items) {
    const act = it.kind === "RATER" ? raterWindowAction(win.get(it.assignment_id), today) : { issue: true, expires_at: null as string | null };
    if (!act.issue) { skipped.push({ assignment_id: it.assignment_id, person_id: it.person_id, why: act.why ?? "" }); continue; }
    const k = act.expires_at ?? ""; batches.set(k, [...(batches.get(k) ?? []), it]);
  }
  if (!batches.size) return json({ issued: 0, links: [], skipped: skipped.length });
  const issued: { person_id: string; assignment_id: string; kind: string; token: string }[] = [];
  for (const [exp, part] of batches) {
    const { data, error } = await db.rpc("rpc_issue_360_invitations", { p_assessment_id: id, p_items: part as never, ...(exp ? { p_expires_at: exp } : {}) });
    if (error) return fromDbError(error.message);
    issued.push(...((data ?? []) as typeof issued));
  }
  const ids = [...new Set([...issued.map((i) => i.person_id), ...(leaders ?? []).map((l) => l.person_id)])];
  const { data: people } = await db.from("person_of_record").select("person_id, display_name, email").in("person_id", ids);
  const who = new Map((people ?? []).map((p) => [p.person_id, p]));
  const leaderOf = new Map((leaders ?? []).map((l) => [l.assignment_id, who.get(l.person_id)?.display_name ?? "Leader"]));
  await audit(asm.tenant_id, a.userId, `l360.invitations.issued:${issued.length}`, "assessment", id);
  return json({ issued: issued.length, skipped: skipped.length, links: issued.map((i) => ({
    kind: i.kind, leader: leaderOf.get(i.assignment_id), name: who.get(i.person_id)?.display_name ?? null, email: who.get(i.person_id)?.email ?? null, token: i.token,
  })) }, 201);
}
