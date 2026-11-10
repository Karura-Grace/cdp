import { admin } from "@/lib/supabase/admin";
import { graphEditor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// PUT { locations: [{ name, country }] }: each location belongs to a country (owner ruling 22 Oct 2026, Erick Ngala comment 34), so results can be cut by
// country. The country is a two letter code and must be one of the organisation's countries (a Super Admin can add countries to the organisation at any
// time). null clears it. Links already issued keep the country they were issued with. GET lists the locations with their country. Audited.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphEditor(req, id);
  if (g instanceof Response) return g;
  const sa = admin();
  const [{ data: locs }, { data: ten }] = await Promise.all([
    sa.from("location").select("name, country").eq("tenant_id", g.eng.tenant_id).order("name"),
    sa.from("tenant").select("geographies").eq("tenant_id", g.eng.tenant_id).single(),
  ]);
  return json({ locations: locs ?? [], countries: ten?.geographies ?? [] });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphEditor(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 64 * 1024);
  if (b instanceof Response) return b;
  const list = b.locations as { name?: unknown; country?: unknown }[] | undefined;
  if (!Array.isArray(list) || !list.length || list.length > 500 || list.some((l) => typeof l?.name !== "string" || !(l.country === null || (typeof l.country === "string" && /^[A-Z]{2}$/.test(l.country)))))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "locations must be a list of { name, country } with country a two letter capital code, or null." });
  const sa = admin();
  const { data: ten } = await sa.from("tenant").select("geographies").eq("tenant_id", g.eng.tenant_id).single();
  const allowed = new Set(ten?.geographies ?? []);
  const outside = list.filter((l) => l.country !== null && !allowed.has(l.country as string)).map((l) => `${l.name} (${l.country})`);
  if (outside.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: `Not one of the organisation's countries (${[...allowed].join(", ") || "none"}): ${outside.slice(0, 5).join(", ")}. A Super Admin can add a country on the Organisations screen.` });
  const { data: have } = await sa.from("location").select("name").eq("tenant_id", g.eng.tenant_id).in("name", list.map((l) => String(l.name)));
  const names = new Set((have ?? []).map((l) => l.name));
  const unknown = list.filter((l) => !names.has(String(l.name))).map((l) => String(l.name));
  if (unknown.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: `Unknown locations: ${unknown.slice(0, 5).join(", ")}. Load them with the organisation first.` });
  const { data, error } = await sa.rpc("rpc_location_countries_set", { p_actor: g.a.userId, p_engagement: id, p_locations: list.map((l) => ({ name: String(l.name), country: l.country as string | null })) as never });
  if (error) return fromDbError(error.message);
  return json(data);
}
