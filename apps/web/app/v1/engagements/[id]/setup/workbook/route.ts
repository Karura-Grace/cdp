import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { buildWorkbook, diffSections, parseWorkbook, SECTION_KEYS } from "@/lib/setup-workbook";
import { sectionKpis } from "@/lib/setup-data";
import { MAX_XLSX_BYTES } from "@/lib/xlsx-csv";
import { consultantOnEngagement } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";
import type { Json } from "@/lib/setup-sections";

export const runtime = "nodejs";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const sections = (v: { sections_json: unknown }) => Object.fromEntries(Object.entries(v.sections_json as Record<string, { payload: Json }>).map(([k, x]) => [k, x.payload])) as Record<string, Json>;

// GET   the workbook as an Excel file: blank by default, or pre filled with the answers of one stored version (?version=<id>). The consultant on the engagement only.
// POST  the bytes of the filled workbook (.xlsx). It is read, every section is checked by the same rules as the Setup forms, and it is stored as a NEW version. Nothing is
//       overwritten and nothing reaches Setup until the consultant marks a clean version final (POST .../workbook/final). The answer lists the problems and what changed
//       since the previous version.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  const db = admin();
  const vid = new URL(req.url).searchParams.get("version");
  const { data: ten } = await db.from("tenant").select("name, legal_name").eq("tenant_id", g.eng.tenant_id).single();
  let values: Record<string, Json> | undefined, label = "blank";
  if (vid) {
    const { data: v } = await db.from("setup_workbook_version").select("version_no, sections_json").eq("engagement_id", id).eq("version_id", vid).maybeSingle();
    if (!v) return problem({ code: "NOT_FOUND", status: 404, title: "No such workbook version." });
    values = sections(v); label = `version ${v.version_no}`;
  }
  const kpis = ((values?.C?.kpis as Json[] | undefined) ?? await sectionKpis(id, true)).map((k) => ({ id: String(k.id), name: typeof k.name === "string" ? k.name : undefined }));
  const buf = await buildWorkbook({ client: ten?.legal_name ?? ten?.name ?? "", engagement: id, version: label, kpis, values });
  return new Response(new Uint8Array(buf), { headers: { "content-type": XLSX, "content-disposition": `attachment; filename="CDP-Workshop-1-workbook-${label.replace(/\s+/g, "-")}.xlsx"`, "cache-control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  if (g.eng.state !== "SETUP") return problem({ code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." });
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_XLSX_BYTES) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Upload an Excel file (.xlsx) of up to 3 MB." });
  const kpis = (await sectionKpis(id, true)).map((k) => ({ id: String(k.id), name: typeof k.name === "string" ? k.name : undefined }));
  const parsed = await parseWorkbook(buf, kpis);
  if (!parsed.format) return problem({ code: "VALIDATION_FAILED", status: 422, title: "This is not a CDP Workshop 1 workbook. Download the workbook from the Setup page and fill that file in." });
  const db = admin();
  const { data: last } = await db.from("setup_workbook_version").select("version_no, file_hash, sections_json").eq("engagement_id", id).order("version_no", { ascending: false }).limit(1).maybeSingle();
  if (last?.file_hash === parsed.hash) return json({ version_no: last.version_no, changed: false, clean: true, message: "This file is the same as the latest version." });
  const no = (last?.version_no ?? 0) + 1;
  const ins = await db.from("setup_workbook_version").insert({
    tenant_id: g.eng.tenant_id, engagement_id: id, version_no: no, file_name: String(new URL(req.url).searchParams.get("name") ?? `workbook-${no}.xlsx`).slice(0, 200),
    file_hash: parsed.hash, sections_json: parsed.sections as never, clean: parsed.ok, uploaded_by: g.a.userId,
  }).select("version_id").single();
  if (ins.error) return fromDbError(ins.error.message);
  await audit(g.eng.tenant_id, g.a.userId, "setup.workbook_uploaded", "setup_workbook_version", ins.data.version_id);
  const changes = diffSections(last ? sections(last) : null, Object.fromEntries(SECTION_KEYS.map((s) => [s, parsed.sections[s]?.payload ?? {}])));
  return json({
    version_id: ins.data.version_id, version_no: no, changed: true, clean: parsed.ok,
    problems: Object.fromEntries(Object.entries(parsed.sections).filter(([, x]) => x.errors.length).map(([k, x]) => [k, x.errors])), changes,
  }, 201);
}
