import { admin } from "@/lib/supabase/admin";
import { checkGraphInput, invitedForEngagement, leaderScope, loadGraph, loadOverrides, reportingChains, validate } from "@/lib/org-graph";
import { COLUMNS, toCsv, type Kind } from "@/lib/org-csv";
import { graphEditor, graphReader, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const today = () => new Date().toISOString().slice(0, 10);

/** The survey window start the checks run against: the assessment's, or today before there is one (the page says which). */
async function windowStart(engagementId: string) {
  const { data } = await admin().from("assessment").select("window_open").eq("engagement_id", engagementId).neq("status", "SUPERSEDED").maybeSingle();
  return data?.window_open ? { date: data.window_open.slice(0, 10), fromAssessment: true } : { date: today(), fromAssessment: false };
}

// The stored graph with its V1 to V7 report. ?format=csv&kind=people downloads one kind in the import format, so an export
// can be edited and uploaded again (re-upload replaces by stable keys). Reads use the caller's own client, so RLS applies:
// work emails are visible to the PAC Consultant and the tenant's Client Admin only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphReader(req, id);
  if (g instanceof Response) return g;
  const url = new URL(req.url);
  const { graph, version } = await loadGraph(g.a.db, g.eng.tenant_id);
  const kind = url.searchParams.get("kind") as Kind | null;
  if (url.searchParams.get("format") === "csv") {
    if (!kind || !(kind in COLUMNS)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "kind must be grades, locations, units, people or leaders." });
    if (kind === "people" && g.role !== "PAC_CONSULTANT" && g.role !== "CLIENT_ADMIN") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
    const cols = COLUMNS[kind].all;
    const rows = (graph[kind] as unknown as Record<string, unknown>[]).map((r) => cols.map((c) => r[c]));
    return new Response(toCsv([cols, ...rows]), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${kind}.csv"`, "cache-control": "no-store" } });
  }
  const ws = await windowStart(id);
  const overrides = await loadOverrides(g.a.db, id);
  const editor = g.role === "PAC_CONSULTANT" || g.role === "CLIENT_ADMIN";
  return json({
    graph_version: version, window_start: ws.date, window_start_from_assessment: ws.fromAssessment, overrides,
    defects: validate(graph, ws.date, overrides, await invitedForEngagement(id)), scope: leaderScope(graph, ws.date), chains: reportingChains(graph, ws.date),
    counts: { grades: graph.grades.length, locations: graph.locations.length, units: graph.units.length, people: graph.people.length, leaders: graph.leaders.length },
    graph: editor ? graph : { ...graph, people: [] },
  });
}

// Replace the whole graph (spec Appendix B: bulk upsert of structure, people and leader assignments). Rows are matched by
// stable keys and keep their ids; rows not sent are removed. Integrity problems refuse the request and store nothing (422).
// Rule defects V1 to V7 do NOT refuse it: the graph is saved so it can be fixed and re-uploaded, the report comes back with
// the response, and launch stays blocked (pre-flight L1) until each blocking defect is fixed or overridden with a reason.
// This differs from the spec's "422 with defects" on the PUT itself; the block is applied at launch.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphEditor(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 4 * 1024 * 1024);
  if (b instanceof Response) return b;
  const c = checkGraphInput(b);
  if (!c.graph) return problem({ code: "VALIDATION_FAILED", status: 422, title: c.errors[0], errors: c.errors.slice(0, 50) });

  const { data, error } = await admin().rpc("rpc_org_graph_replace", { p_actor: g.a.userId, p_engagement: id, p_graph: c.graph as never });
  if (error) return fromDbError(error.message);
  const ws = await windowStart(id);
  const overrides = await loadOverrides(admin(), id);
  const defects = validate(c.graph, ws.date, overrides, await invitedForEngagement(id));
  return json({ ...(data as object), window_start: ws.date, notes: c.notes, defects, blocking: defects.filter((d) => d.blocking).map((d) => d.rule) });
}
