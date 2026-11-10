import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnAssessment, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";
import { surveyTexts } from "@/lib/survey-text";
import { objectingRefs } from "@/lib/privacy";
import { invitationMail, sendMail } from "@/lib/email";

export const runtime = "nodejs";

const MAX = 500;

// Issue single-use survey links while the assessment is LAUNCHED. Only token hashes are stored; the raw tokens are
// returned once.
//   { mode: "roster" }  one link per active person on the roster not yet invited. Each link carries that person's
//                       department, grade and tenure band (so segments work); the person link is removed at submission.
//                       Returns name, email and token per person, so the consultant can send them. With send_email: true the
//                       server also emails each person their link (hello@pac.africa) and reports sent and failed counts.
//   { count: n }        n anonymous seats (no cohort data; segments cannot use them).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const { a, asm } = g;
  if (asm.frozen_at) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The data is frozen; no more links can be issued." });
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const db = admin();

  if (b.mode === "roster") {
    const [{ data: people }, { data: done }] = await Promise.all([
      db.from("person_of_record").select("person_id, employee_ref, display_name, email").eq("tenant_id", asm.tenant_id).eq("employment_status", "ACTIVE").order("display_name"),
      db.from("invitation_roster").select("person_id").eq("assessment_id", id),
    ]);
    const seen = new Set((done ?? []).map((d) => d.person_id));
    // an open or done objection blocks further links to that person (the database function skips them as well)
    const objecting = await objectingRefs(asm.tenant_id);
    const notYet = (people ?? []).filter((p) => !seen.has(p.person_id));
    const todo = notYet.filter((p) => !objecting.has(p.employee_ref));
    const skipped_objection = notYet.length - todo.length;
    if (!todo.length) return json({ count: 0, invited_before: seen.size, skipped_objection, links: [] });
    const { data, error } = await db.rpc("rpc_issue_person_invitations", { p_assessment_id: id, p_people: todo.map((p) => p.person_id) });
    if (error) return fromDbError(error.message);
    const who = new Map(todo.map((p) => [p.person_id, p]));
    await audit(asm.tenant_id, a.userId, `invitations.issued_roster:${data.length}`, "assessment", id);
    let mail: { sent: number; failed: number } | undefined;
    if (b.send_email === true) {
      const { data: t } = await db.from("tenant").select("name").eq("tenant_id", asm.tenant_id).single();
      const origin = new URL(req.url).origin;
      const texts = await surveyTexts(id);
      const sent = await Promise.all(data.map((r) => { const p = who.get(r.person_id); return p?.email ? sendMail(invitationMail({ to: p.email, name: p.display_name, org: t?.name ?? "Your organisation", url: `${origin}/respond#${r.token}`, close: asm.window_close, message: texts.message, estimate: texts.estimate })) : false; }));
      mail = { sent: sent.filter(Boolean).length, failed: sent.filter((x) => !x).length };
      await audit(asm.tenant_id, a.userId, `invitations.emailed:${mail.sent}/${data.length}`, "assessment", id);
    }
    return json({ count: data.length, invited_before: seen.size, skipped_objection, mail,
      links: data.map((r) => ({ name: who.get(r.person_id)?.display_name ?? null, email: who.get(r.person_id)?.email ?? null, token: r.token })) }, 201);
  }

  const count = Number(b.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX) return problem({ code: "VALIDATION_FAILED", status: 422, title: `count must be a whole number from 1 to ${MAX}, or mode "roster".` });
  const { data, error } = await db.rpc("rpc_issue_invitations", { p_assessment_id: id, p_count: count });
  if (error) return fromDbError(error.message);
  await audit(asm.tenant_id, a.userId, `invitations.issued:${count}`, "assessment", id);
  return json({ count, tokens: data }, 201);
}
