import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { computeScore } from "./scoring";

// The cohort attributes a segment can be cut by. They are the keys written into the invitation snapshot at issue time
// (capture.issue_person_invitations): department, team, division, location, grade, tenure band and the executive flag.
export const AXES = ["division", "department", "team", "location", "country", "grade", "executive", "tenure_band"] as const;
export type Axis = (typeof AXES)[number];
export const AXIS_LABEL: Record<Axis, string> = { division: "Division", department: "Department", team: "Team", location: "Location", country: "Country", grade: "Grade", executive: "Executive or staff", tenure_band: "Tenure" };

export type SegmentView =
  | { ok: true; axis: Axis; parent: E.Predicates; score_version: number; payload_hash: string; floor: number; cells: E.HeatmapCell[] }
  | { ok: false; status: number; code: string; title: string; rule?: string; minimum?: number; rollup?: unknown };

// One axis as a heatmap over the frozen response set, optionally inside one parent segment. The engine decides what is
// suppressed (floor, combination floor, differencing). A parent group under the floor is refused with the roll-up.
// Every query is logged to the insert-only segment_query_log with its outcome. The caller has already checked the role.
type Frozen = { ok: true; s: Awaited<ReturnType<typeof computeScore>>; sc: { version: number; payload_hash: string } } | Extract<SegmentView, { ok: false }>;

// The frozen set behind every segment view: the latest frozen score, reproduced and hash checked, with the executive flag shown as
// Executive or Staff (after the hash check, so the score is untouched).
export async function frozenScored(assessmentId: string, engagementId: string, frozen: boolean): Promise<Frozen> {
  if (!frozen) return { ok: false, status: 409, code: "DATA_NOT_FROZEN", title: "The data set is not frozen." };
  const { data: sc } = await admin().from("score_object").select("version, payload_hash").eq("assessment_id", assessmentId)
    .not("frozen_at", "is", null).order("version", { ascending: false }).limit(1).maybeSingle();
  if (!sc) return { ok: false, status: 422, code: "VALIDATION_FAILED", title: "Freeze a score version first." };
  // Segments are cut from the same frozen set as the score, and only if it reproduces the stored hash.
  const s = await computeScore(assessmentId, engagementId, [sc.payload_hash]);
  if (s.hash !== sc.payload_hash) return { ok: false, status: 500, code: "INTERNAL", title: "The frozen score could not be reproduced." };
  for (const r of s.scored) r.snapshot = { ...r.snapshot, executive: r.snapshot.is_executive ? "Executive" : "Staff" };
  return { ok: true, s, sc };
}

export async function segmentView(assessmentId: string, engagementId: string, frozen: boolean, actorId: string,
  axis: Axis, parentAxis: Axis | null, parentValue: string | null): Promise<SegmentView> {
  const f = await frozenScored(assessmentId, engagementId, frozen);
  if (!f.ok) return f;
  const { s, sc } = f;
  const db = admin();
  const parent: E.Predicates = parentAxis && parentValue ? { [parentAxis]: parentValue } : {};
  // exact count of people the query matched, for the audit log only (the column is hidden from staff; screens never show it under the floor)
  const resolved = s.scored.filter((r) => E.matches(r, parent)).length;
  const log = (outcome: "ALLOWED" | "SUPPRESSED") =>
    db.rpc("rpc_log_segment_query", { p_actor: actorId, p_assessment_id: assessmentId, p_axis: axis, p_predicates: parent as never, p_outcome: outcome, p_resolved: resolved });
  if (parentAxis) {
    try { E.segmentMetrics(s.scored, parent, s.obj); }
    catch (e) {
      if (!(e instanceof E.Suppressed)) throw e;
      await log("SUPPRESSED");
      return { ok: false, status: 409, code: "BELOW_REPORTING_THRESHOLD", title: "Too few responses to report this group.", rule: e.rule, minimum: e.minimum, rollup: e.rollup };
    }
  }
  const cells = E.heatmap(s.scored, axis, s.obj, parent, parentAxis && parentValue ? `${AXIS_LABEL[parentAxis]}: ${parentValue}` : "organisation");
  await log(cells.some((c) => c.suppressed) ? "SUPPRESSED" : "ALLOWED");
  return { ok: true, axis, parent, score_version: sc.version, payload_hash: sc.payload_hash, floor: E.config.get("segments.floor"), cells };
}

/** Store the profile of every reportable group on the standard cuts, tied to the score version and hash (insert once; the
 *  table is immutable). Groups under the floor or folded by differencing protection are not stored. Called just before the
 *  score is frozen, so the profiles come from the same frozen set and reproduce the same hash. */
export async function storeSegmentProfiles(assessmentId: string, engagementId: string, tenantId: string, version: number, hash: string, actor: string) {
  const s = await computeScore(assessmentId, engagementId, [hash]);
  if (s.hash !== hash) throw new Error("The score could not be reproduced for the group profiles.");
  for (const r of s.scored) r.snapshot = { ...r.snapshot, executive: r.snapshot.is_executive ? "Executive" : "Staff" };
  const rows = AXES.flatMap((axis) => E.heatmap(s.scored, axis, s.obj).filter((c) => !c.suppressed && c.metrics).map((c) => ({
    assessment_id: assessmentId, tenant_id: tenantId, score_version: version, segment_key: `${axis}:${c.value}`, axis, value: c.value,
    n: Number(c.n), profile_json: E.toJsonable(c.metrics) as never, payload_hash: hash, created_by: actor,
  })));
  if (!rows.length) return;
  const r = await admin().from("segment_profile").upsert(rows, { onConflict: "assessment_id,score_version,segment_key", ignoreDuplicates: true });
  if (r.error) throw new Error(r.error.message);
}

export const MAX_FILTER = 3, MAX_COMPARE = 4;
export type Filter = Partial<Record<Axis, string>>;

/** Parse "axis:value" strings (as the filter and compare controls send them) into one filter. A repeated axis, an unknown axis or an
 *  empty or over long value is refused (null), so a query can only be a clean AND of up to three different cuts. */
export function parseFilter(parts: string[]): Filter | null {
  const f: Filter = {};
  for (const p of parts) {
    const i = p.indexOf(":"), a = p.slice(0, i) as Axis, v = p.slice(i + 1);
    if (i < 1 || !AXES.includes(a) || a in f || v.length < 1 || v.length > 120) return null;
    f[a] = v;
  }
  const n = Object.keys(f).length;
  return n >= 1 && n <= MAX_FILTER ? f : null;
}

export type FilterView =
  | { ok: true; count: number; below: false; metrics: unknown; verdict: E.SubcultureResult | null; score_version: number; payload_hash: string }
  | { ok: true; below: true; floor: number; score_version: number; payload_hash: string }
  | Extract<SegmentView, { ok: false }>;

// The filter builder: AND of up to three cuts. Under the floor the screen only ever hears "fewer than 5" (the exact count goes to the
// insert only log, hidden from staff); asking for the group's results on its own is 409 with the roll-up. Every query is logged.
export async function segmentFilter(assessmentId: string, engagementId: string, frozen: boolean, actorId: string, filter: Filter, countOnly: boolean): Promise<FilterView> {
  const f = await frozenScored(assessmentId, engagementId, frozen);
  if (!f.ok) return f;
  const { s, sc } = f, predicates = filter as E.Predicates, floor = E.config.get("segments.floor");
  const resolved = s.scored.filter((r) => E.matches(r, predicates)).length;
  const log = (outcome: "ALLOWED" | "SUPPRESSED") => admin().rpc("rpc_log_segment_query", { p_actor: actorId, p_assessment_id: assessmentId,
    p_axis: Object.keys(filter).join("+").slice(0, 40), p_predicates: predicates as never, p_outcome: outcome, p_resolved: resolved });
  try {
    const m = E.segmentMetrics(s.scored, predicates, s.obj);
    await log("ALLOWED");
    if (countOnly) return { ok: true, count: m.n, below: false, metrics: null, verdict: null, score_version: sc.version, payload_hash: sc.payload_hash };
    return { ok: true, count: m.n, below: false, metrics: E.toJsonable(m), verdict: m.subculture, score_version: sc.version, payload_hash: sc.payload_hash };
  } catch (e) {
    if (!(e instanceof E.Suppressed)) throw e;
    await log("SUPPRESSED");
    if (countOnly) return { ok: true, below: true, floor, score_version: sc.version, payload_hash: sc.payload_hash };
    return { ok: false, status: 409, code: "BELOW_REPORTING_THRESHOLD", title: "Too few responses to report this group.", rule: e.rule, minimum: e.minimum, rollup: e.rollup };
  }
}

/** The label shown on a group: "Sub-culture (confirmed)", "Indicative", or none. The tests that passed travel with it. */
export function verdictLabel(v: E.SubcultureResult | null | undefined) {
  if (!v || !v.is_subculture) return { label: null as string | null, tests: [] as string[] };
  const tests = [...(v.profile_divergence ? ["profile divergence"] : []), ...(v.dominance_divergence ? ["dominance divergence"] : []),
    ...(v.divergent.length ? [`${v.divergent.length} orientation${v.divergent.length > 1 ? "s" : ""} diverge`] : []), ...(v.significance === "CONFIRMED" ? ["Welch test"] : [])];
  return { label: v.significance === "CONFIRMED" ? "Sub-culture (confirmed)" : "Indicative", tests };
}
