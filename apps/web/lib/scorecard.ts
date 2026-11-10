import { admin } from "./supabase/admin";
import { parseCsv, toCsv } from "./org-csv";
import { actor } from "./staff";
import { fromDbError, problem } from "./problem";
import { audit } from "./audit";
import { ISO_4217 } from "./iso4217";

// Strategic scorecard (spec 1.4.3): objectives linked to Section B priorities, KPIs under them. Validation, CSV in and out,
// and the engine feed (kpi_for) live here so the API, the page and pre-flight share one set of rules.
// The database stores direction as UP or DOWN; the API speaks the spec words HIGHER_IS_BETTER and LOWER_IS_BETTER.

const DB_DIR = { HIGHER_IS_BETTER: "UP", LOWER_IS_BETTER: "DOWN" } as const;
const API_DIR = { UP: "HIGHER_IS_BETTER", DOWN: "LOWER_IS_BETTER" } as const;

import { UNITS, DIRECTIONS, ORIENTS, type KpiIn, type ObjIn, type ObjOut } from "./scorecard-types";
export type { KpiIn, ObjIn, ObjOut } from "./scorecard-types";

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e12;
const text = (x: unknown, max: number) => typeof x === "string" && x.trim().length >= 1 && x.trim().length <= max;

/** Every refusal for a whole scorecard, each naming where it is (file row for an import, otherwise objective and KPI number). */
export function validateScorecard(objs: unknown, ctx: { today: string; priorityRefs: string[] }): string[] {
  const out: string[] = [];
  if (!Array.isArray(objs)) return ["objectives must be a list."];
  if (objs.length > 50) return ["At most 50 objectives."];
  const titles = new Set<string>(), names = new Set<string>(), orients = new Set<string>(), orefs = new Set<string>(), krefs = new Set<string>();
  objs.forEach((o: ObjIn, i) => {
    const at = o?._row ? `Row ${o._row}` : `Objective ${i + 1}`;
    if (!o || typeof o !== "object") return void out.push(`${at}: is not an object.`);
    if (!text(o.title, 200)) out.push(`${at}: title is required, up to 200 characters.`);
    else if (titles.has(o.title.trim().toLowerCase())) out.push(`${at}: the objective title "${o.title.trim()}" is used twice.`);
    else titles.add(o.title.trim().toLowerCase());
    refCheck(o.external_ref, orefs, "objective", at, out);
    const pk = o.priority_keys;
    if (!Array.isArray(pk) || !pk.length) out.push(`${at}: link at least one Section B priority.`);
    else {
      if (new Set(pk).size !== pk.length) out.push(`${at}: a priority is linked twice.`);
      for (const k of pk) if (!ctx.priorityRefs.includes(k)) out.push(`${at}: "${k}" is not a Section B priority${ctx.priorityRefs.length ? ` (use ${ctx.priorityRefs.join(", ")})` : ". Save Section B first"}.`);
    }
    if (!Array.isArray(o.kpis)) return void out.push(`${at}: kpis must be a list.`);
    o.kpis.forEach((k, j) => {
      const w = k?._row ? `Row ${k._row}` : `${at}, KPI ${j + 1}`, bad = (m: string) => out.push(`${w}: ${m}`);
      if (!k || typeof k !== "object") return bad("is not an object.");
      if (!text(k.name, 120)) bad("name is required, up to 120 characters.");
      else if (names.has(k.name.trim().toLowerCase())) bad(`the KPI name "${k.name.trim()}" is used twice.`);
      else names.add(k.name.trim().toLowerCase());
      refCheck(k.external_ref, krefs, "KPI", w, out);
      extrasCheck(k, w, ctx.today, out);
      if (!UNITS.includes(k.unit as never)) bad(`unit must be one of ${UNITS.join(", ")}.`);
      if (k.unit === "CURRENCY") { if (typeof k.currency_code !== "string" || !/^[A-Z]{3}$/.test(k.currency_code)) bad("currency_code must be a three letter ISO 4217 code, such as KES.");
        else if (!ISO_4217.has(k.currency_code)) bad(`currency_code "${k.currency_code}" is not an ISO 4217 currency code.`);
        else if (k.currency_code !== "USD") bad("Money KPIs are in US dollars (USD). The platform does not convert currencies."); }
      else if (k.currency_code) bad("currency_code is only for the CURRENCY unit.");
      const dir = DIRECTIONS.includes(k.direction as never) ? (k.direction as (typeof DIRECTIONS)[number]) : null;
      if (!dir) bad(`direction must be ${DIRECTIONS.join(" or ")}.`);
      if (!isNum(k.baseline_value)) bad("baseline_value must be a number.");
      if (!isDay(k.baseline_date)) bad("baseline_date must be a date, YYYY-MM-DD.");
      else if (k.baseline_date > ctx.today) bad("baseline_date must not be in the future.");
      if (!text(k.baseline_source, 200)) bad("baseline_source is required, up to 200 characters.");
      if (!isNum(k.target_12m)) bad("target_12m is required and must be a number.");
      if (k.target_3y !== undefined && k.target_3y !== null && !isNum(k.target_3y)) bad("target_3y must be a number or empty.");
      if (dir && isNum(k.baseline_value)) {
        const up = dir === "HIGHER_IS_BETTER";
        for (const key of ["target_12m", "target_3y"] as const) {
          const x = k[key];
          if (isNum(x) && !(up ? x > k.baseline_value : x < k.baseline_value)) bad(`${key} must be ${up ? "above" : "below"} the baseline (${k.baseline_value}).`);
        }
      }
      if (k.orientation) {
        if (!ORIENTS.includes(k.orientation as never)) bad(`orientation must be ${ORIENTS.join(", ")} or empty.`);
        else if (orients.has(k.orientation)) bad(`only one KPI may track ${k.orientation}.`);
        else orients.add(k.orientation);
      }
    });
  });
  if (!out.length && !objs.some((o: ObjIn) => o.kpis.length)) out.push("Add at least one KPI.");
  return out;
}

const refCheck = (ref: unknown, seen: Set<string>, what: string, at: string, out: string[]) => {
  if (ref === undefined || ref === null) return;
  if (!text(ref, 100)) return void out.push(`${at}: external_ref must be text of up to 100 characters, or empty.`);
  const r = (ref as string).trim();
  if (seen.has(r)) out.push(`${at}: the ${what} external_ref "${r}" is used twice.`); else seen.add(r);
};

/** Readings and linked action ids on one KPI (shape only; whether an action exists is checked against the database). */
export function extrasCheck(k: KpiIn, w: string, today: string, out: string[]) {
  if (k.readings !== undefined) {
    if (!Array.isArray(k.readings)) out.push(`${w}: readings must be a list.`);
    else {
      const days = new Set<string>();
      k.readings.forEach((r, n) => {
        const at = `${w}, reading ${n + 1}`;
        if (!r || typeof r !== "object") return void out.push(`${at}: is not an object.`);
        if (!isDay(r.read_on)) out.push(`${at}: read_on must be a date, YYYY-MM-DD.`);
        else if (r.read_on > today) out.push(`${at}: read_on must not be in the future.`);
        else if (days.has(r.read_on)) out.push(`${at}: two readings on ${r.read_on}.`); else days.add(r.read_on);
        if (!isNum(r.value)) out.push(`${at}: value must be a number.`);
        if (r.note !== undefined && r.note !== null && (typeof r.note !== "string" || r.note.length > 500)) out.push(`${at}: note is up to 500 characters.`);
      });
    }
  }
  if (k.linked_actions !== undefined) {
    if (!Array.isArray(k.linked_actions) || k.linked_actions.some((a) => typeof a !== "string" || !/^act_[A-Za-z0-9_]{1,60}$/.test(a))) out.push(`${w}: linked_actions must be a list of action ids (act_...).`);
    else if (new Set(k.linked_actions).size !== k.linked_actions.length) out.push(`${w}: an action is linked twice.`);
  }
}

// ---------------------------------------------------------------- CSV (one flat file: an objective repeats on each of its KPI rows)

// The last four columns are optional on import. readings is "2026-03-31=24.5;2026-06-30=27", linked_actions is "act_1;act_2".
export const CSV_COLUMNS = ["objective", "priority_keys", "kpi", "unit", "currency_code", "direction", "baseline_value", "baseline_date", "baseline_source", "target_12m", "target_3y", "orientation",
  "objective_ref", "kpi_ref", "readings", "linked_actions"];
const CSV_REQUIRED = ["objective", "priority_keys", "kpi", "unit", "direction", "baseline_value", "baseline_date", "baseline_source", "target_12m"];
const NUM = /^-?\d+(\.\d+)?$/;
const DETAIL_COLUMNS = CSV_COLUMNS.slice(3);

/** Parse an uploaded scorecard. Errors name the file row (the header is row 1). Nothing is guessed: unknown or missing columns are errors. */
export function parseScorecardCsv(raw: string): { objectives: ObjIn[]; errors: string[] } {
  const errors: string[] = [];
  let table: string[][];
  try { table = parseCsv(raw); } catch (e) { return { objectives: [], errors: [(e as Error).message] }; }
  if (!table.length) return { objectives: [], errors: ["The file is empty."] };
  const head = table[0].map((h) => h.trim().toLowerCase());
  for (const h of head) if (!CSV_COLUMNS.includes(h)) errors.push(`Unknown column "${h}". Expected: ${CSV_COLUMNS.join(", ")}.`);
  for (const r of CSV_REQUIRED) if (!head.includes(r)) errors.push(`Missing column "${r}".`);
  if (new Set(head).size !== head.length) errors.push("A column name appears twice.");
  if (errors.length) return { objectives: [], errors };
  const objectives: ObjIn[] = [], by = new Map<string, ObjIn>();
  table.slice(1).forEach((r, n) => {
    const row = n + 2, bad = (m: string) => errors.push(`Row ${row}: ${m}`);
    const c = (name: string) => { const i = head.indexOf(name); return i < 0 ? "" : (r[i] ?? "").trim(); };
    if (r.length > head.length) return bad("has more fields than the header.");
    const title = c("objective");
    if (!title) return bad("objective is empty.");
    const keys = c("priority_keys").split(";").map((s) => s.trim()).filter(Boolean);
    let o = by.get(title.toLowerCase());
    if (!o) { o = { title, priority_keys: keys, kpis: [], _row: row, ...(c("objective_ref") ? { external_ref: c("objective_ref") } : {}) }; by.set(title.toLowerCase(), o); objectives.push(o); }
    else {
      if (keys.length && keys.join(";") !== o.priority_keys.join(";")) bad(`priority_keys differ from the first row of "${o.title}".`);
      if (c("objective_ref") && c("objective_ref") !== (o.external_ref ?? "")) bad(`objective_ref differs from the first row of "${o.title}".`);
    }
    if (!c("kpi")) {
      if (DETAIL_COLUMNS.some((k) => c(k))) bad("has KPI details but no kpi name.");
      return;
    }
    const num = (k: string, req: boolean) => {
      const v = c(k);
      if (!v) return req ? NaN : null;
      if (!NUM.test(v)) { bad(`${k} must be a number.`); return NaN; }
      return Number(v);
    };
    const bv = num("baseline_value", true), t12 = num("target_12m", true), t3 = num("target_3y", false);
    const kpi: KpiIn = { name: c("kpi"), unit: c("unit").toUpperCase(), currency_code: c("currency_code").toUpperCase() || null, direction: c("direction").toUpperCase(),
      baseline_value: bv as number, baseline_date: c("baseline_date"), baseline_source: c("baseline_source"), target_12m: t12 as number, target_3y: t3, orientation: c("orientation").toUpperCase() || null, _row: row };
    if (c("kpi_ref")) kpi.external_ref = c("kpi_ref");
    if (c("readings")) {
      kpi.readings = c("readings").split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
        const [d, v, ...rest] = x.split("=");
        if (rest.length || v === undefined || !NUM.test(v.trim())) { bad(`readings must look like 2026-03-31=24.5;2026-06-30=27 (found "${x}").`); return { read_on: d, value: NaN }; }
        return { read_on: d.trim(), value: Number(v.trim()) };
      });
    }
    if (c("linked_actions")) kpi.linked_actions = c("linked_actions").split(";").map((x) => x.trim()).filter(Boolean);
    o.kpis.push(kpi);
  });
  return { objectives, errors };
}

export function scorecardCsv(objs: ObjOut[]): string {
  const rows: unknown[][] = [CSV_COLUMNS];
  for (const o of objs) {
    if (!o.kpis.length) rows.push([o.title, o.priority_keys.join(";"), "", "", "", "", "", "", "", "", "", "", o.external_ref ?? "", "", "", ""]);
    for (const k of o.kpis) rows.push([o.title, o.priority_keys.join(";"), k.name, k.unit, k.currency_code ?? "", k.direction, k.baseline_value, k.baseline_date, k.baseline_source, k.target_12m, k.target_3y ?? "", k.orientation ?? "",
      o.external_ref ?? "", k.external_ref ?? "", k.readings.map((r) => `${r.read_on}=${r.value}`).join(";"), k.linked_actions.join(";")]);
  }
  return toCsv(rows);
}

/** A file that gives one external_ref to two objectives, or to two KPIs, is refused before it is merged (the merge would otherwise fold them into one row). */
export function duplicateRefs(objs: ObjIn[]): string[] {
  const out: string[] = [], o = new Set<string>(), k = new Set<string>();
  objs.forEach((x, i) => {
    if (!x || typeof x !== "object") return;
    refCheck(x.external_ref, o, "objective", x._row ? `Row ${x._row}` : `Objective ${i + 1}`, out);
    (Array.isArray(x.kpis) ? x.kpis : []).forEach((y, j) => y && refCheck(y.external_ref, k, "KPI", y._row ? `Row ${y._row}` : `Objective ${i + 1}, KPI ${j + 1}`, out));
  });
  return out;
}

const low = (s: unknown) => String(s).trim().toLowerCase();
const hasRef = (x?: string | null): x is string => typeof x === "string" && x.trim() !== "";

/** Import merges into what is stored. An objective is matched by its external_ref when the file gives one, otherwise by title; a KPI the same way by external_ref, otherwise by name
 *  (any case). So importing the same file twice changes nothing. Fields the file leaves out keep their stored value. */
export function mergeScorecard(current: ObjOut[], incoming: ObjIn[]): ObjIn[] {
  const strip = (o: ObjOut): ObjIn => ({ title: o.title, priority_keys: o.priority_keys, external_ref: o.external_ref,
    kpis: o.kpis.map(({ kpi_id: _id, actions: _a, readings: _r, linked_actions: _l, ...k }) => k) });
  const out = current.map(strip);
  for (const inc of incoming) {
    const ref = hasRef(inc.external_ref) ? inc.external_ref.trim() : null;
    const hit = (ref ? out.find((o) => o.external_ref === ref) : undefined) ?? out.find((o) => low(o.title) === low(inc.title));
    if (!hit) { out.push(inc); continue; }
    hit.title = inc.title;
    if (inc.priority_keys?.length) hit.priority_keys = inc.priority_keys;
    if (hasRef(inc.external_ref)) hit.external_ref = inc.external_ref;
    for (const k of inc.kpis ?? []) {
      const byRef = hasRef(k.external_ref) ? hit.kpis.findIndex((x) => x.external_ref === k.external_ref!.trim()) : -1;
      const i = byRef >= 0 ? byRef : hit.kpis.findIndex((x) => low(x.name) === low(k.name));
      if (i < 0) hit.kpis.push(k); else hit.kpis[i] = { external_ref: hit.kpis[i].external_ref, ...k };
    }
  }
  return out;
}

// ---------------------------------------------------------------- database

type Db = Pick<ReturnType<typeof admin>, "from">;

/** Section B priority refs (B3.1, B3.2 ...) from the saved AGREED perspective row, with their text and goal type. */
export async function priorityRefs(engagementId: string): Promise<{ ref: string; text: string; goal_type?: string }[]> {
  const { data } = await admin().from("setup_record").select("payload_json").eq("engagement_id", engagementId).eq("section", "B").eq("perspective", "AGREED").maybeSingle();
  const ps = ((data?.payload_json as { priorities?: { ref?: string; text?: string; goal_type?: string }[] } | null)?.priorities ?? []);
  return ps.filter((p) => p.ref).map((p) => ({ ref: p.ref as string, text: p.text ?? "", goal_type: p.goal_type }));
}

export async function loadScorecard(db: Db, engagementId: string): Promise<ObjOut[]> {
  const [{ data: os }, { data: ks }, { data: rs }] = await Promise.all([
    db.from("objective").select("objective_id, title, priority_keys, external_ref").eq("engagement_id", engagementId).order("sort_order").order("created_at"),
    db.from("scorecard_kpi").select("*").eq("engagement_id", engagementId).order("created_at"),
    db.from("scorecard_kpi_reading").select("kpi_id, read_on, value, note").eq("engagement_id", engagementId).order("read_on"),
  ]);
  const ids = (ks ?? []).map((k) => k.kpi_id);
  // the caller's own client: a client role sees an action only once its report is released (RLS)
  const { data: acts } = ids.length ? await db.from("action").select("action_id, scorecard_kpi_id, objective, status, level").in("scorecard_kpi_id", ids).order("action_id") : { data: [] };
  return (os ?? []).map((o) => ({ ...o, kpis: (ks ?? []).filter((k) => k.objective_id === o.objective_id).map((k) => {
    const actions = (acts ?? []).filter((a) => a.scorecard_kpi_id === k.kpi_id).map((a) => ({ action_id: a.action_id, objective: a.objective, status: a.status, level: a.level }));
    return { kpi_id: k.kpi_id, external_ref: k.external_ref, name: k.name, unit: k.unit, currency_code: k.currency_code, direction: API_DIR[k.direction as "UP" | "DOWN"], baseline_value: Number(k.baseline_value), baseline_date: k.baseline_date,
      baseline_source: k.baseline_source, target_12m: Number(k.target_12m), target_3y: k.target_3y === null ? null : Number(k.target_3y), orientation: k.orientation,
      readings: (rs ?? []).filter((r) => r.kpi_id === k.kpi_id).map((r) => ({ read_on: r.read_on, value: Number(r.value), note: r.note })), linked_actions: actions.map((a) => a.action_id), actions };
  }) }));
}

/** Make the stored scorecard equal the validated one. Rows are matched, not recreated: an objective or KPI keeps its id (so its readings and the actions linked to it stay)
 *  when it matches a stored one by external_ref or, failing that, by title or name. Unmatched stored rows are removed last (a KPI takes its readings with it and unlinks its actions).
 *  ponytail: not one transaction. A database error part way leaves the rows written so far; validation has already refused anything the rules forbid.
 *  Returns an error text, or the stored KPI id of every incoming KPI in order. */
export async function saveScorecard(tenantId: string, engagementId: string, userId: string, objs: ObjIn[]): Promise<{ error: string } | { kpiIds: string[][] }> {
  const db = admin();
  const [{ data: oldO }, { data: oldK }] = await Promise.all([
    db.from("objective").select("objective_id, title, external_ref").eq("engagement_id", engagementId),
    db.from("scorecard_kpi").select("kpi_id, name, external_ref").eq("engagement_id", engagementId),
  ]);
  const freeO = new Map((oldO ?? []).map((o) => [o.objective_id, o])), freeK = new Map((oldK ?? []).map((k) => [k.kpi_id, k]));
  const take = <T extends { external_ref: string | null }>(pool: Map<string, T>, ref: string | null | undefined, same: (x: T) => boolean): string | null => {
    const hit = [...pool.entries()].find(([, x]) => (hasRef(ref) ? x.external_ref === ref.trim() : false)) ?? [...pool.entries()].find(([, x]) => same(x));
    if (!hit) return null;
    pool.delete(hit[0]);
    return hit[0];
  };
  const kpiIds: string[][] = [];
  for (const [i, o] of objs.entries()) {
    const row = { title: o.title.trim(), priority_keys: o.priority_keys, sort_order: i, external_ref: hasRef(o.external_ref) ? o.external_ref.trim() : null, updated_by: userId };
    const have = take(freeO, o.external_ref, (x) => low(x.title) === low(o.title));
    let oid = have;
    if (have) { const u = await db.from("objective").update(row).eq("objective_id", have); if (u.error) return { error: u.error.message }; }
    else {
      const ins = await db.from("objective").insert({ ...row, tenant_id: tenantId, engagement_id: engagementId, created_by: userId }).select("objective_id").single();
      if (ins.error) return { error: ins.error.message };
      oid = ins.data.objective_id;
    }
    const ids: string[] = [];
    for (const x of o.kpis) {
      const kr = { objective_id: oid!, name: x.name.trim(), unit: x.unit, currency_code: x.unit === "CURRENCY" ? x.currency_code! : null, external_ref: hasRef(x.external_ref) ? x.external_ref.trim() : null,
        direction: DB_DIR[x.direction as keyof typeof DB_DIR], baseline_value: x.baseline_value, baseline_date: x.baseline_date, baseline_source: x.baseline_source.trim(),
        target_12m: x.target_12m, target_3y: x.target_3y ?? null, orientation: x.orientation || null, updated_by: userId };
      const kh = take(freeK, x.external_ref, (k) => low(k.name) === low(x.name));
      if (kh) { const u = await db.from("scorecard_kpi").update(kr).eq("kpi_id", kh); if (u.error) return { error: u.error.message }; ids.push(kh); }
      else {
        const ins = await db.from("scorecard_kpi").insert({ ...kr, tenant_id: tenantId, engagement_id: engagementId, created_by: userId }).select("kpi_id").single();
        if (ins.error) return { error: ins.error.message };
        ids.push(ins.data.kpi_id);
      }
    }
    kpiIds.push(ids);
  }
  if (freeK.size) { const d = await db.from("scorecard_kpi").delete().in("kpi_id", [...freeK.keys()]); if (d.error) return { error: d.error.message }; }
  if (freeO.size) { const d = await db.from("objective").delete().in("objective_id", [...freeO.keys()]); if (d.error) return { error: d.error.message }; }
  return { kpiIds };
}

/** Which of these action ids are not actions of this engagement's assessments. */
export async function unknownActions(engagementId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const db = admin();
  const { data: asm } = await db.from("assessment").select("assessment_id").eq("engagement_id", engagementId);
  const { data } = await db.from("action").select("action_id").in("action_id", ids).in("assessment_id", (asm ?? []).map((a) => a.assessment_id));
  const found = new Set((data ?? []).map((a) => a.action_id));
  return ids.filter((i) => !found.has(i));
}

/** Readings and action links for KPIs already stored. `ids` is the stored KPI id for each incoming KPI, in the same order as `objs`. */
export async function saveExtras(tenantId: string, engagementId: string, userId: string, objs: ObjIn[], ids: string[][]): Promise<string | null> {
  const db = admin();
  for (const [i, o] of objs.entries()) for (const [j, k] of (o.kpis ?? []).entries()) {
    const kid = ids[i]?.[j];
    if (!kid) continue;
    if (k.readings?.length) {
      const up = await db.from("scorecard_kpi_reading").upsert(k.readings.map((r) => ({ tenant_id: tenantId, engagement_id: engagementId, kpi_id: kid, read_on: r.read_on, value: r.value, note: r.note ?? null, created_by: userId })), { onConflict: "kpi_id,read_on" });
      if (up.error) return up.error.message;
    }
    if (k.linked_actions?.length) {
      const up = await db.rpc("rpc_action_link_kpi", { p_actor: userId, p_kpi: kid, p_actions: k.linked_actions });
      if (up.error) return up.error.message;
    }
  }
  return null;
}

/** Locked scorecard (engagement past SETUP): the structure cannot change, but readings and action links can. Every incoming KPI must match a stored one by external_ref.
 *  Returns the stored KPI ids in incoming order, or the problems. */
export function matchStored(current: ObjOut[], incoming: ObjIn[]): { errors: string[] } | { ids: string[][] } {
  const errors: string[] = [], ids: string[][] = [];
  incoming.forEach((o, i) => {
    const at = o._row ? `Row ${o._row}` : `Objective ${i + 1}`;
    const ho = current.find((x) => hasRef(o.external_ref) && x.external_ref === o.external_ref.trim());
    if (!ho) errors.push(`${at}: the objective needs an external_ref that matches a stored objective once the scorecard is locked.`);
    ids.push((o.kpis ?? []).map((k, j) => {
      const w = k._row ? `Row ${k._row}` : `${at}, KPI ${j + 1}`;
      const hk = ho?.kpis.find((x) => hasRef(k.external_ref) && x.external_ref === k.external_ref.trim());
      if (!hk && ho) errors.push(`${w}: the KPI needs an external_ref that matches a stored KPI once the scorecard is locked.`);
      return hk?.kpi_id ?? "";
    }));
  });
  return errors.length ? { errors } : { ids };
}

type KpiFor = Record<string, { name: string; baseline: number | string; target: number | string }>;
/** What the scorecard gives the engine and pre-flight. Empty when nothing is stored: callers then fall back to Sections C and D (older engagements and the e2e fixtures).
 *  A decimal goes to the engine as a string, a whole number stays a number, as in kpiForInput. */
export async function scorecardSource(engagementId: string): Promise<{ objectives: number; kpis: number; kpiFor: KpiFor | undefined }> {
  const sc = await loadScorecard(admin(), engagementId);
  const fix = (v: number) => (Number.isInteger(v) ? v : String(v));
  const kpiFor: KpiFor = {};
  for (const k of sc.flatMap((o) => o.kpis)) if (k.orientation) kpiFor[k.orientation] = { name: k.name, baseline: fix(k.baseline_value), target: fix(k.target_12m) };
  return { objectives: sc.length, kpis: sc.reduce((n, o) => n + o.kpis.length, 0), kpiFor: Object.keys(kpiFor).length ? kpiFor : undefined };
}

/** Table 7 has no scorecard row; it follows Setup Sections A to I: the PAC Consultant and the Client Admin write, the Executive reads, everyone else is refused.
 *  Reads go through the caller's own client, so RLS decides what comes back. */
export async function scorecardAccess(req: Request, engagementId: string, write: boolean | "extras") {
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data: eng } = await a.db.from("engagement").select("*").eq("engagement_id", engagementId).maybeSingle();
  const { data: role } = eng ? await a.db.rpc("rpc_actor_role", { p_engagement: engagementId }) : { data: null };
  const allowed = write ? ["PAC_CONSULTANT", "CLIENT_ADMIN"] : ["PAC_CONSULTANT", "CLIENT_ADMIN", "EXECUTIVE"];
  if (!eng || !allowed.includes(role as string)) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  if (write === true && eng.state !== "SETUP") return problem({ code: "SETUP_LOCKED", status: 409, title: "The scorecard is locked because the assessment has launched." });
  return { a, eng, role: role as string };
}

type Grant = { a: { userId: string }; eng: { tenant_id: string; engagement_id: string } };
const actionIds = (objs: ObjIn[]) => [...new Set(objs.flatMap((o) => (o.kpis ?? []).flatMap((k) => (Array.isArray(k.linked_actions) ? k.linked_actions : []))))];
const noAction = (ids: string[]) => ids.map((i) => `linked action "${i}" is not an action of this engagement.`);

/** Validate, save and audit a whole scorecard, with the readings and action links it carries. A Response on refusal, otherwise the stored scorecard. */
export async function applyScorecard(g: Grant, objs: ObjIn[], action: string) {
  const refs = (await priorityRefs(g.eng.engagement_id)).map((p) => p.ref);
  const errors = validateScorecard(objs, { today: new Date().toISOString().slice(0, 10), priorityRefs: refs });
  if (!errors.length) errors.push(...noAction(await unknownActions(g.eng.engagement_id, actionIds(objs))));
  if (errors.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: `The scorecard is not valid: ${errors[0]}`, errors });
  const saved = await saveScorecard(g.eng.tenant_id, g.eng.engagement_id, g.a.userId, objs);
  if ("error" in saved) return fromDbError(saved.error);
  const err = await saveExtras(g.eng.tenant_id, g.eng.engagement_id, g.a.userId, objs, saved.kpiIds);
  if (err) return fromDbError(err);
  await audit(g.eng.tenant_id, g.a.userId, action, "scorecard", g.eng.engagement_id);
  return loadScorecard(admin(), g.eng.engagement_id);
}

/** After SETUP: only readings and action links are taken from the file; the structure is left as stored. */
export async function applyExtrasOnly(g: Grant, incoming: ObjIn[], action: string) {
  const current = await loadScorecard(admin(), g.eng.engagement_id);
  const m = matchStored(current, incoming);
  if ("errors" in m) return problem({ code: "SETUP_LOCKED", status: 409, title: "The scorecard is locked because the assessment has launched. Only readings and action links can be added, and each objective and KPI must carry an external_ref that matches a stored one.", errors: m.errors });
  const errors: string[] = [];
  incoming.forEach((o, i) => (o.kpis ?? []).forEach((k, j) => extrasCheck(k, `Objective ${i + 1}, KPI ${j + 1}`, new Date().toISOString().slice(0, 10), errors)));
  if (!errors.length) errors.push(...noAction(await unknownActions(g.eng.engagement_id, actionIds(incoming))));
  if (errors.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: `The file is not valid: ${errors[0]}`, errors });
  const err = await saveExtras(g.eng.tenant_id, g.eng.engagement_id, g.a.userId, incoming, m.ids);
  if (err) return fromDbError(err);
  await audit(g.eng.tenant_id, g.a.userId, action, "scorecard", g.eng.engagement_id);
  return loadScorecard(admin(), g.eng.engagement_id);
}
