import { audit } from "@/lib/audit";
import { AGREED_ONLY, PERSPECTIVES, PERSPECTIVE_SECTIONS } from "@/lib/setup-compare";
import { finalise, validateSection, type Json } from "@/lib/setup-sections";
import { sectionKpis } from "@/lib/setup-data";
import { agreedSections, sequenceBlock } from "@/lib/setup-workshop";
import { graphEditor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";
const DRAFT_SECTIONS = ["A", "B", "C", "D"] as const;

// Spec 1.1 and S1-07: Sections E, F and G are captured separately by the executive team and by senior HR, then agreed. This saves one
// perspective (EXECUTIVE or HR) as a draft. The consultant and the tenant's Client Admin may write it; a Client Admin never writes the
// AGREED record, and the database policy enforces that too (the write goes through the caller's own client, so RLS decides).
// Decision 18 Oct 2026: the Client Admin's drafts of Sections A to D live here too, as EXECUTIVE rows with status DRAFT (RLS refuses the
// AGREED perspective to a Client Admin, and nothing else reads an EXECUTIVE row of A to D). The consultant agrees from them.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; section: string; perspective: string }> }) {
  const { id, section, perspective } = await params;
  const draft = (DRAFT_SECTIONS as readonly string[]).includes(section);
  if (!draft && !(PERSPECTIVE_SECTIONS as readonly string[]).includes(section)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Only Sections A to D (client drafts) and E, F and G (Executive and HR entries) are captured this way." });
  if (!(PERSPECTIVES as readonly string[]).includes(perspective) || (draft && perspective !== "EXECUTIVE")) return problem({ code: "VALIDATION_FAILED", status: 422, title: draft ? "A draft of Sections A to D is saved as the EXECUTIVE perspective." : "The perspective must be EXECUTIVE or HR." });
  const g = await graphEditor(req, id);
  if (g instanceof Response) return g;
  if (g.eng.state !== "SETUP") return problem({ code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." });
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const raw = b.payload;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "payload must be a JSON object." });

  const seq = sequenceBlock(section, await agreedSections(id), "capture");
  if (seq) return problem({ code: "SETUP_SEQUENCE_VIOLATION", status: 409, title: seq });

  // the tie break and the wording choices belong to the agreed record, so they are dropped here
  const payload = finalise(section, raw as Json);
  for (const k of AGREED_ONLY) delete payload[k];
  const kpis = section === "D" ? await sectionKpis(id, true) : undefined;
  const ctx = { today: new Date().toISOString().slice(0, 10), kpis };
  const errors = validateSection(section, payload, { complete: false, ctx });
  if (errors.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: errors[0], errors });

  const up = await g.a.db.from("setup_record").upsert({
    tenant_id: g.eng.tenant_id, engagement_id: id, section, perspective, payload_json: payload as never, status: "DRAFT", participants: [],
  }, { onConflict: "engagement_id,section,perspective" }).select("setup_id, status").single();
  if (up.error) return up.error.code === "42501" || /row-level security/i.test(up.error.message) ? problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." }) : fromDbError(up.error.message);
  await audit(g.eng.tenant_id, g.a.userId, `setup.perspective_saved:${section}:${perspective}`, "setup_record", up.data.setup_id);
  return json({ section, perspective, status: up.data.status, missing: validateSection(section, payload, { complete: true, ctx }), payload });
}
