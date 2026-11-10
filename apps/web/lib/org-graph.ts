import * as E from "@pac/cdp-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import { admin } from "./supabase/admin";
import { isDay, type GraphIn, type LeaderIn } from "./org-csv";

// Org graph: check what arrives, load what is stored, and hand both to the engine's V1 to V7. No rule lives here beyond
// what is needed to store rows safely (unique keys, known references, dates in order, one leader per team at a time).

export const LIMITS = { grades: 200, locations: 500, units: 5000, people: 20000, leaders: 6000 } as const;
export type Overrides = Record<string, string>;
export type StoredLeader = LeaderIn & { assignment_id: string };
export type StoredGraph = Omit<GraphIn, "leaders"> & { leaders: StoredLeader[] };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Shape and integrity checks for an incoming graph. `errors` are reasons nothing can be stored (the whole request is
 * refused). `notes` are references that do not resolve: those rows are stored with the reference empty and rule V4 reports them.
 */
export function checkGraphInput(b: Record<string, unknown>): { graph?: GraphIn; errors: string[]; notes: string[] } {
  const errors: string[] = [], notes: string[] = [];
  const list = (k: keyof typeof LIMITS) => {
    const v = b[k];
    if (!Array.isArray(v)) { errors.push(`${k} must be a list.`); return [] as Record<string, unknown>[]; }
    if (v.length > LIMITS[k]) { errors.push(`${k} has more than ${LIMITS[k]} rows.`); return []; }
    return v.filter((x): x is Record<string, unknown> => { const ok = !!x && typeof x === "object" && !Array.isArray(x); if (!ok) errors.push(`${k} has a row that is not an object.`); return ok; });
  };
  const dup = (what: string, keys: string[]) => {
    const seen = new Set<string>(), d = new Set<string>();
    for (const k of keys) { if (seen.has(k)) d.add(k); seen.add(k); }
    if (d.size) errors.push(`Duplicate ${what}: ${[...d].slice(0, 5).join(", ")}${d.size > 5 ? ` and ${d.size - 5} more` : ""}.`);
  };
  const len = (what: string, v: string, max: number) => { if (!v) errors.push(`${what} is empty.`); else if (v.length > max) errors.push(`${what} "${v.slice(0, 20)}…" is longer than ${max} characters.`); };

  const grades = list("grades").map((r) => ({ name: str(r.name), rank_order: r.rank_order as number, is_executive: r.is_executive === true }));
  grades.forEach((g) => { len("A grade name", g.name, 120); if (!Number.isInteger(g.rank_order) || g.rank_order < 1 || g.rank_order > 1000) errors.push(`Grade "${g.name}": rank_order must be a whole number from 1 to 1000.`); });
  dup("grade names", grades.map((g) => g.name)); dup("grade rank orders", grades.map((g) => String(g.rank_order)));

  const locations = list("locations").map((r) => ({ name: str(r.name) }));
  locations.forEach((l) => len("A location name", l.name, 120)); dup("location names", locations.map((l) => l.name));

  const units = list("units").map((r) => ({
    unit_key: str(r.unit_key), name: str(r.name), type: r.type as GraphIn["units"][number]["type"],
    parent_key: str(r.parent_key) || null, rollup_to_parent: r.rollup_to_parent === true,
  }));
  units.forEach((u) => {
    len("A unit key", u.unit_key, 60); len(`Unit ${u.unit_key} name`, u.name, 200);
    if (!["DIVISION", "DEPARTMENT", "TEAM"].includes(u.type)) errors.push(`Unit ${u.unit_key}: type must be DIVISION, DEPARTMENT or TEAM.`);
  });
  dup("unit keys", units.map((u) => u.unit_key));
  const unitKeys = new Set(units.map((u) => u.unit_key)), unitType = new Map(units.map((u) => [u.unit_key, u.type]));
  units.forEach((u) => { if (u.parent_key && !unitKeys.has(u.parent_key)) errors.push(`Unit ${u.unit_key}: parent "${u.parent_key}" does not exist.`); if (u.parent_key === u.unit_key) errors.push(`Unit ${u.unit_key} is its own parent.`); });

  const gradeNames = new Set(grades.map((g) => g.name)), locNames = new Set(locations.map((l) => l.name));
  const people = list("people").map((r) => ({
    employee_ref: str(r.employee_ref), email: str(r.email), unit_key: str(r.unit_key) || null, grade: str(r.grade) || null, location: str(r.location) || null,
    employment_status: r.employment_status as GraphIn["people"][number]["employment_status"],
  }));
  people.forEach((p) => {
    len("An employee_ref", p.employee_ref, 60);
    if (p.email.length > 254) errors.push(`Person ${p.employee_ref}: email is longer than 254 characters.`);
    if (!["ACTIVE", "ON_LEAVE", "EXITED"].includes(p.employment_status)) errors.push(`Person ${p.employee_ref}: employment_status must be ACTIVE, ON_LEAVE or EXITED.`);
    if (p.unit_key && !unitKeys.has(p.unit_key)) { notes.push(`${p.employee_ref}: unit "${p.unit_key}" does not exist, so this person has no team.`); p.unit_key = null; }
    if (p.grade && !gradeNames.has(p.grade)) { notes.push(`${p.employee_ref}: grade "${p.grade}" does not exist, so this person has no grade.`); p.grade = null; }
    if (p.location && !locNames.has(p.location)) { notes.push(`${p.employee_ref}: location "${p.location}" does not exist, so this person has no location.`); p.location = null; }
  });
  dup("employee_ref values", people.map((p) => p.employee_ref));
  const refs = new Set(people.map((p) => p.employee_ref));

  const leaders = list("leaders").map((r) => ({ employee_ref: str(r.employee_ref), team_key: str(r.team_key), effect_from: str(r.effect_from), effect_to: str(r.effect_to) || null }));
  leaders.forEach((l, i) => {
    const w = `Leader row ${i + 1} (${l.employee_ref} / ${l.team_key})`;
    if (!refs.has(l.employee_ref)) errors.push(`${w}: person does not exist.`);
    if (!unitKeys.has(l.team_key)) errors.push(`${w}: team does not exist.`);
    else if (unitType.get(l.team_key) !== "TEAM") errors.push(`${w}: ${l.team_key} is not a team.`);
    if (!isDay(l.effect_from)) errors.push(`${w}: effect_from must be a date, YYYY-MM-DD.`);
    if (l.effect_to !== null && !isDay(l.effect_to)) errors.push(`${w}: effect_to must be a date, YYYY-MM-DD, or empty.`);
    else if (l.effect_to !== null && l.effect_to < l.effect_from) errors.push(`${w}: effect_to is before effect_from.`);
  });
  dup("leader rows (same person, team and start date)", leaders.map((l) => `${l.employee_ref}|${l.team_key}|${l.effect_from}`));
  // one accountable leader per team on any date: ranges are inclusive and must not overlap (the database enforces it too)
  const byTeam = new Map<string, LeaderIn[]>();
  for (const l of leaders) if (isDay(l.effect_from)) byTeam.set(l.team_key, [...(byTeam.get(l.team_key) ?? []), l]);
  for (const [team, ls] of byTeam) {
    const s = [...ls].sort((x, y) => x.effect_from.localeCompare(y.effect_from));
    for (let i = 1; i < s.length; i++) {
      const prev = s[i - 1];
      if (prev.effect_to === null || prev.effect_to >= s[i].effect_from)
        errors.push(`Team ${team}: ${prev.employee_ref} (from ${prev.effect_from}${prev.effect_to ? ` to ${prev.effect_to}` : ", open ended"}) overlaps ${s[i].employee_ref} (from ${s[i].effect_from}). A team has one accountable leader on any date.`);
    }
  }

  const graph: GraphIn = { grades, locations, units, people, leaders };
  if (!errors.length) {
    // the tree itself must be sound before anything is stored: one root, no cycles, every team directly under a department
    const structure = validate(graph, "9999-12-31", {}).filter((d) => d.rule === "STRUCTURE");
    for (const d of structure) errors.push(`${d.message}: ${d.refs.slice(0, 8).join(", ")}${d.refs.length > 8 ? ` and ${d.refs.length - 8} more` : ""}.`);
  }
  return { graph: errors.length ? undefined : graph, errors, notes };
}

// ---------------------------------------------------------------- engine

/** Keys stand in for ids, so a defect's refs read as unit keys and employee refs. */
export function engineInput(g: GraphIn | StoredGraph, windowStart: string, overrides: Overrides = {}, invited: Set<string> | null = null) {
  return {
    units: g.units.map((u) => ({ unit_id: u.unit_key, parent_unit_id: u.parent_key, type: u.type, rollup_to_parent: u.rollup_to_parent })),
    people: g.people.map((p) => ({ person_id: p.employee_ref, employee_ref: p.employee_ref, email: p.email, unit_id: p.unit_key, grade_id: p.grade, location_id: p.location, employment_status: p.employment_status, ...(invited ? { invited: invited.has(p.employee_ref) } : {}) })),
    leaders: g.leaders.map((l) => ({ person_id: l.employee_ref, team_id: l.team_key, effect_from: l.effect_from, effect_to: l.effect_to })),
    grades: g.grades.map((x) => ({ grade_id: x.name, is_executive: x.is_executive })),
    windowStart, multiSite: g.locations.length > 1, overrides,
  };
}

/** V1 to V7 (plus STRUCTURE) from the engine. `overrides` is rule -> reason; an overridden defect comes back non-blocking. */
export function validate(g: GraphIn | StoredGraph, windowStart: string, overrides: Overrides = {}, invited: Set<string> | null = null): E.Defect[] {
  // references sorted, so the same graph reads the same whatever order its rows arrived in (an upload, or the database)
  return E.validateOrgGraph(engineInput(g, windowStart, overrides, invited)).map((d) => ({ ...d, refs: [...d.refs].sort() }));
}

const onDate = (l: LeaderIn, d: string) => l.effect_from <= d && (l.effect_to === null || l.effect_to >= d);

/**
 * headcount_led (Table 23): ACTIVE persons whose team is the leader's team, on the window start date. Direct team only.
 * A leader who sits in their own team is counted in it; the spec defines the count as the people in the team.
 */
export function leaderScope(g: StoredGraph, windowStart: string) {
  return g.leaders.filter((l) => onDate(l, windowStart)).map((l) => ({
    assignment_id: l.assignment_id, team_key: l.team_key,
    headcount_led: g.people.filter((p) => p.employment_status === "ACTIVE" && p.unit_key === l.team_key).length,
  }));
}

/** Reporting chain per leader, the same walk the engine uses for V3: a leader's manager leads the team they sit in. */
export function reportingChains(g: GraphIn | StoredGraph, windowStart: string) {
  const people = new Map(g.people.map((p) => [p.employee_ref, p]));
  const leaderOf = new Map(g.leaders.filter((l) => onDate(l, windowStart)).map((l) => [l.team_key, l.employee_ref]));
  const managerOf = (ref: string) => { const u = people.get(ref)?.unit_key; const m = u ? leaderOf.get(u) : undefined; return m && m !== ref ? m : null; };
  return g.leaders.filter((l) => onDate(l, windowStart)).map((l) => {
    const chain: string[] = [l.employee_ref], seen = new Set(chain);
    let cycle = false;
    for (let m = managerOf(l.employee_ref); m; m = managerOf(m)) { if (seen.has(m)) { cycle = true; chain.push(m); break; } seen.add(m); chain.push(m); }
    return { team_key: l.team_key, leader: l.employee_ref, chain, cycle };
  });
}

// ---------------------------------------------------------------- reading what is stored

type Db = SupabaseClient<Database>;

/** All rows of a query, a page at a time (the API returns at most 1000 per request). */
export async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** The tenant's stored graph, keyed by stable keys. Pass the signed-in user's client so RLS decides what is visible. */
export async function loadGraph(db: Db, tenantId: string): Promise<{ graph: StoredGraph; version: number }> {
  const [grades, locs, units, people, leaders, ten] = await Promise.all([
    all((a, b) => db.from("grade_band").select("grade_id, name, rank_order, is_executive").eq("tenant_id", tenantId).order("rank_order").range(a, b)),
    all((a, b) => db.from("location").select("location_id, name").eq("tenant_id", tenantId).order("name").range(a, b)),
    all((a, b) => db.from("org_unit").select("unit_id, unit_key, name, type, parent_unit_id, rollup_to_parent").eq("tenant_id", tenantId).order("unit_key").range(a, b)),
    all((a, b) => db.from("person_of_record").select("person_id, employee_ref, email, unit_id, grade_id, location_id, employment_status").eq("tenant_id", tenantId).order("employee_ref").range(a, b)),
    all((a, b) => db.from("leader_assignment").select("assignment_id, person_id, team_id, effect_from, effect_to").eq("tenant_id", tenantId).order("assignment_id").range(a, b)),
    db.from("tenant").select("org_graph_version").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  const refOf = new Map(people.map((p) => [p.person_id, p.employee_ref]));
  const unitKey = new Map(units.map((u) => [u.unit_id, u.unit_key])), gradeName = new Map(grades.map((g) => [g.grade_id, g.name])), locName = new Map(locs.map((l) => [l.location_id, l.name]));
  const graph: StoredGraph = {
    grades: grades.map((g) => ({ name: g.name, rank_order: g.rank_order, is_executive: g.is_executive })),
    locations: locs.map((l) => ({ name: l.name })),
    units: units.map((u) => ({ unit_key: u.unit_key, name: u.name, type: u.type as StoredGraph["units"][number]["type"], parent_key: u.parent_unit_id ? (unitKey.get(u.parent_unit_id) ?? null) : null, rollup_to_parent: u.rollup_to_parent })),
    people: people.map((p) => ({
      employee_ref: p.employee_ref, email: p.email, unit_key: p.unit_id ? (unitKey.get(p.unit_id) ?? null) : null, grade: p.grade_id ? (gradeName.get(p.grade_id) ?? null) : null,
      location: p.location_id ? (locName.get(p.location_id) ?? null) : null, employment_status: p.employment_status as StoredGraph["people"][number]["employment_status"],
    })),
    leaders: leaders.map((l) => ({ assignment_id: l.assignment_id, employee_ref: refOf.get(l.person_id) ?? "?", team_key: unitKey.get(l.team_id) ?? "?", effect_from: l.effect_from, effect_to: l.effect_to })),
  };
  return { graph, version: ten.data?.org_graph_version ?? 0 };
}

export async function loadOverrides(db: Db, engagementId: string): Promise<Overrides> {
  const { data } = await db.from("org_override").select("rule, reason").eq("engagement_id", engagementId);
  return Object.fromEntries((data ?? []).map((o) => [o.rule, o.reason]));
}

/**
 * V2, the invited respondent half: employee refs of the people who already have a link for this assessment, or null while no link has been
 * issued (links are issued after launch for everyone on the roster, so before that every active person is about to be invited and V2 checks
 * only that the leader is an active person of record). Once links exist, a leader who has none fails V2.
 */
export async function loadInvited(db: Db, assessmentId: string | null | undefined): Promise<Set<string> | null> {
  if (!assessmentId) return null;
  const ids = await all((a, b) => db.from("invitation_roster").select("person_id").eq("assessment_id", assessmentId).order("person_id").range(a, b));
  if (!ids.length) return null;
  const refs = new Set<string>();
  const list = ids.map((x) => x.person_id);
  for (let i = 0; i < list.length; i += 200) {
    const { data } = await db.from("person_of_record").select("employee_ref").in("person_id", list.slice(i, i + 200));
    for (const p of data ?? []) refs.add(p.employee_ref);
  }
  return refs;
}

/** loadInvited for an engagement's current assessment (the one that has not been superseded). Service role: every role sees the same V2 result. */
export async function invitedForEngagement(engagementId: string): Promise<Set<string> | null> {
  const { data: asm } = await admin().from("assessment").select("assessment_id").eq("engagement_id", engagementId).neq("status", "SUPERSEDED").maybeSingle();
  return loadInvited(admin(), asm?.assessment_id);
}
