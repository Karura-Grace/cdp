import { f1BehaviourWarning } from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { OBSERVABLE_VERBS, finalise, validateSection, type Json } from "@/lib/setup-sections";
import { sectionKpis } from "@/lib/setup-data";
import { PERSON_ID, assignedConsultants, attendance } from "@/lib/setup-workshop";
import { consultantOnEngagement, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

// Save a setup section (the agreed-perspective record) as a DRAFT with its workshop record. The payload is cleaned to the
// section's fields and checked for shape (types, enums, lengths); a half-empty draft is fine. Saving always returns the
// section to DRAFT: a changed section has to be agreed again. `missing` lists what agreeing will still need.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  if (!/^[A-I]$/.test(section)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The section must be A to I." });
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  if (g.eng.state !== "SETUP") return problem({ code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." });
  const b = await readJson(req);
  if (b instanceof Response) return b;

  const raw = b.payload;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "payload must be a JSON object." });
  const date = b.workshop_date == null || b.workshop_date === "" ? null : String(b.workshop_date);
  if (date !== null && !DAY.test(date)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "workshop_date must be YYYY-MM-DD." });
  const people = b.participants ?? [];
  if (!Array.isArray(people) || people.length > 50 || people.some((p) => typeof p !== "string" || !PERSON_ID.test(p.trim())))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "participants must be a list of up to 50 person ids from the organisation record. Typed names do not count." });
  const participants = [...new Set((people as string[]).map((p) => p.trim()))];
  // The facilitator is a PAC user assigned to this engagement (pick list: GET /v1/engagements/{id}/setup/facilitators), stored as a user id.
  if ("facilitator" in b) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Send facilitator_user_id (a consultant assigned to this engagement), not typed text." });
  const facId = b.facilitator_user_id == null || b.facilitator_user_id === "" ? null : b.facilitator_user_id;
  if (facId !== null && (typeof facId !== "string" || !UUID.test(facId)))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "facilitator_user_id must be a user id." });
  const staff = await assignedConsultants(id);
  if (facId !== null && !staff.some((u) => u.user_id === facId))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "The facilitator must be a PAC consultant assigned to this engagement." });
  // Person ids must belong to this organisation. Only an id whose grade is an executive grade counts as an executive.
  const att = await attendance(g.eng.tenant_id, participants);
  if (att.unknown.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: "A participant is not a person of record of this organisation.", unknown: att.unknown });

  const db = admin();
  const kpis = section === "D" ? await sectionKpis(id) : undefined;
  const payload = finalise(section, raw as Json);
  const ctx = { today: today(), kpis };
  const errors = validateSection(section, payload, { complete: false, ctx });
  if (errors.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: errors[0], errors });

  // The facilitating consultant defaults to the person saving, and an earlier record keeps its facilitator.
  const prev = await db.from("setup_record").select("facilitator, facilitator_user_id").eq("engagement_id", id).eq("section", section).eq("perspective", "AGREED").maybeSingle();
  const pick = facId ?? prev.data?.facilitator_user_id ?? g.a.userId;
  const who = staff.find((u) => u.user_id === pick);
  const facilitator = who ? who.name : facId === null && prev.data?.facilitator_user_id == null && prev.data?.facilitator ? prev.data.facilitator : "PAC Consultant";
  const facilitatorUserId = who ? pick : null;
  const up = await db.from("setup_record").upsert({
    tenant_id: g.eng.tenant_id, engagement_id: id, section, perspective: "AGREED", payload_json: payload as never,
    status: "DRAFT", workshop_date: date, participants, facilitator, facilitator_user_id: facilitatorUserId, updated_by: g.a.userId, created_by: g.a.userId,
  }, { onConflict: "engagement_id,section,perspective" }).select("setup_id, status").single();
  if (up.error) return fromDbError(up.error.message);

  // Targets in D point at the KPIs in C, so changing C means D has to be agreed again.
  let reopened: string[] = [];
  if (section === "C") {
    const r = await db.from("setup_record").update({ status: "DRAFT", updated_by: g.a.userId }).eq("engagement_id", id).eq("section", "D").eq("perspective", "AGREED").eq("status", "AGREED").select("section");
    if (r.error) return fromDbError(r.error.message);
    reopened = (r.data ?? []).map((x) => x.section);
  }
  // a changed section has to be confirmed again by the Executives
  const cl = await db.from("setup_confirmation").delete().eq("engagement_id", id).in("section", section === "C" ? ["C", "D"] : [section]);
  if (cl.error) return fromDbError(cl.error.message);
  await audit(g.eng.tenant_id, g.a.userId, `setup.saved:${section}`, "setup_record", up.data.setup_id);

  // F1 wording warnings never block. The consultant may accept one as written; that choice is stored (f1_overrides) and audited.
  const accepted = new Set(((payload.f1_overrides as string[] | undefined) ?? []).map(Number));
  const f1 = section === "F" && Array.isArray(payload.behaviours)
    ? (payload.behaviours as { text: string }[]).flatMap((x, i) => { const w = f1BehaviourWarning(x.text ?? "", OBSERVABLE_VERBS); return w ? [{ i: i + 1, text: `F1 behaviour ${i + 1}: ${w}` }] : []; })
    : [];
  const warnings = f1.filter((w) => !accepted.has(w.i)).map((w) => w.text);
  const overridden = f1.filter((w) => accepted.has(w.i)).map((w) => w.text);
  if (accepted.size) await audit(g.eng.tenant_id, g.a.userId, `setup.f1_override:${[...accepted].join(",")}`, "setup_record", up.data.setup_id);
  const missing = validateSection(section, payload, { complete: true, ctx });
  return json({ section, status: up.data.status, warnings, overridden, missing, reopened, payload, facilitator, facilitator_user_id: facilitatorUserId, participants: { verified: att.verified.length, not_executive: att.others.length } });
}

