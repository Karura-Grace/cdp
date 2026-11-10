// CSV in and out for the org graph (spec S1-03). Pure TypeScript with no imports: the browser parses uploads and the
// server reuses the same row shapes. XLSX is not supported; save the sheet as CSV (UTF-8).

export interface GradeIn { name: string; rank_order: number; is_executive: boolean }
export interface LocationIn { name: string }
export interface UnitIn { unit_key: string; name: string; type: "DIVISION" | "DEPARTMENT" | "TEAM"; parent_key: string | null; rollup_to_parent: boolean }
export interface PersonIn { employee_ref: string; email: string; unit_key: string | null; grade: string | null; location: string | null; employment_status: "ACTIVE" | "ON_LEAVE" | "EXITED" }
export interface LeaderIn { employee_ref: string; team_key: string; effect_from: string; effect_to: string | null }
export interface GraphIn { grades: GradeIn[]; locations: LocationIn[]; units: UnitIn[]; people: PersonIn[]; leaders: LeaderIn[] }
export type Kind = keyof GraphIn;

export const COLUMNS: Record<Kind, { all: string[]; required: string[] }> = {
  grades: { all: ["name", "rank_order", "is_executive"], required: ["name", "rank_order"] },
  locations: { all: ["name"], required: ["name"] },
  units: { all: ["unit_key", "name", "type", "parent_key", "rollup_to_parent"], required: ["unit_key", "name", "type"] },
  people: { all: ["employee_ref", "email", "unit_key", "grade", "location", "employment_status"], required: ["employee_ref", "email", "employment_status"] },
  leaders: { all: ["employee_ref", "team_key", "effect_from", "effect_to"], required: ["employee_ref", "team_key", "effect_from"] },
};
export const KIND_LABEL: Record<Kind, string> = { grades: "Grades", locations: "Locations", units: "Organisation units", people: "People", leaders: "Leader assignments" };

export const TEMPLATES: Record<Kind, string> = {
  grades: "name,rank_order,is_executive\nBoard,1,true\nExecutive,2,true\nManager,3,false\nStaff,4,false\n",
  locations: "name\nNairobi\nKampala\n",
  units: "unit_key,name,type,parent_key,rollup_to_parent\nORG,Head office,DIVISION,,\nFIN,Finance,DEPARTMENT,ORG,\nFIN-AP,Accounts payable,TEAM,FIN,false\n",
  people: "employee_ref,email,unit_key,grade,location,employment_status\nE001,a.person@example.com,FIN-AP,Manager,Nairobi,ACTIVE\n",
  leaders: "employee_ref,team_key,effect_from,effect_to\nE001,FIN-AP,2026-01-01,\n",
};

// ---------------------------------------------------------------- RFC 4180 parser

/** Rows of fields. Handles a BOM, CRLF or LF, quoted fields with commas, newlines and doubled quotes. Throws on an unclosed quote. */
export const parseCsv = (text: string): string[][] => parseCsvRows(text).rows;

/** The same rows with `nums`: each row's number in the file, counting blank lines as rows (the row number a spreadsheet shows). */
export function parseCsvRows(text: string): { rows: string[][]; nums: number[] } {
  const s = text.replace(/^﻿/, "");
  const all: string[][] = [], nos: number[] = [];
  let row: string[] = [], field = "", i = 0, quoted = false, any = false, no = 1;
  while (i < s.length) {
    const c = s[i];
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } quoted = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"' && field === "") { quoted = true; any = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; any = true; i++; continue; }
    if (c === "\r" || c === "\n") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      i++;
      if (any || field !== "") { row.push(field); all.push(row); nos.push(no); }
      no++; row = []; field = ""; any = false; continue;
    }
    field += c; any = true; i++;
  }
  if (quoted) throw new Error("A quoted field is not closed");
  if (any || field !== "") { row.push(field); all.push(row); nos.push(no); }
  const keep = all.map((r) => r.some((f) => f.trim() !== ""));
  return { rows: all.filter((_, k) => keep[k]), nums: nos.filter((_, k) => keep[k]) };
}

/** One CSV cell for output. Cells that a spreadsheet would run as a formula get a leading apostrophe. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

// ---------------------------------------------------------------- rows -> typed records

const BOOL_T = new Set(["true", "yes", "y", "1"]), BOOL_F = new Set(["false", "no", "n", "0", ""]);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (s: string) => DAY.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

/** `rowOf`: the key of each parsed row (unit_key, employee_ref, grade or location name) and the file row it came from. */
export interface Parsed<T> { rows: T[]; errors: string[]; rowOf: Record<string, number> }

/** Parse one uploaded file. Errors name the file row (the header is row 1). Nothing is guessed: unknown or missing columns are errors. */
export function parseKind(kind: Kind, text: string): Parsed<GraphIn[Kind][number]> {
  const errors: string[] = [];
  let table: string[][], nums: number[];
  try { ({ rows: table, nums } = parseCsvRows(text)); } catch (e) { return { rows: [], errors: [(e as Error).message], rowOf: {} }; }
  if (!table.length) return { rows: [], errors: ["The file is empty."], rowOf: {} };
  const head = table[0].map((h) => h.trim().toLowerCase());
  const spec = COLUMNS[kind];
  for (const h of head) if (!spec.all.includes(h)) errors.push(`Unknown column "${h}". Expected: ${spec.all.join(", ")}.`);
  for (const r of spec.required) if (!head.includes(r)) errors.push(`Missing column "${r}".`);
  if (new Set(head).size !== head.length) errors.push("A column name appears twice.");
  if (errors.length) return { rows: [], errors, rowOf: {} };
  const col = (r: string[], name: string) => { const i = head.indexOf(name); return i < 0 ? "" : (r[i] ?? "").trim(); };
  const out: GraphIn[Kind][number][] = [];
  table.slice(1).forEach((r, k) => {
    const n = nums[k + 1], bad = (m: string) => errors.push(`Row ${n}: ${m}`);
    if (r.length > head.length) return bad("has more fields than the header.");
    for (const q of spec.required) if (!col(r, q)) bad(`"${q}" is empty.`);
    switch (kind) {
      case "grades": {
        const ro = col(r, "rank_order"), ex = col(r, "is_executive").toLowerCase();
        if (ro && !/^\d{1,4}$/.test(ro)) bad("rank_order must be a whole number.");
        if (!BOOL_T.has(ex) && !BOOL_F.has(ex)) bad("is_executive must be true or false.");
        out.push({ name: col(r, "name"), rank_order: Number(ro), is_executive: BOOL_T.has(ex) });
        break;
      }
      case "locations": out.push({ name: col(r, "name") }); break;
      case "units": {
        const t = col(r, "type").toUpperCase(), rb = col(r, "rollup_to_parent").toLowerCase();
        if (t && !["DIVISION", "DEPARTMENT", "TEAM"].includes(t)) bad("type must be DIVISION, DEPARTMENT or TEAM.");
        if (!BOOL_T.has(rb) && !BOOL_F.has(rb)) bad("rollup_to_parent must be true or false.");
        out.push({ unit_key: col(r, "unit_key"), name: col(r, "name"), type: t as UnitIn["type"], parent_key: col(r, "parent_key") || null, rollup_to_parent: BOOL_T.has(rb) });
        break;
      }
      case "people": {
        const st = col(r, "employment_status").toUpperCase();
        if (st && !["ACTIVE", "ON_LEAVE", "EXITED"].includes(st)) bad("employment_status must be ACTIVE, ON_LEAVE or EXITED.");
        out.push({ employee_ref: col(r, "employee_ref"), email: col(r, "email"), unit_key: col(r, "unit_key") || null, grade: col(r, "grade") || null, location: col(r, "location") || null, employment_status: st as PersonIn["employment_status"] });
        break;
      }
      case "leaders": {
        const f = col(r, "effect_from"), t = col(r, "effect_to");
        if (f && !isDay(f)) bad("effect_from must be a date, YYYY-MM-DD.");
        if (t && !isDay(t)) bad("effect_to must be a date, YYYY-MM-DD, or empty.");
        out.push({ employee_ref: col(r, "employee_ref"), team_key: col(r, "team_key"), effect_from: f, effect_to: t || null });
        break;
      }
    }
  });
  if (!out.length && !errors.length) errors.push("The file has a header but no rows.");
  const keyField = { grades: "name", locations: "name", units: "unit_key", people: "employee_ref", leaders: "employee_ref" }[kind];
  const rowOf: Record<string, number> = {};
  out.forEach((o, k) => { const key = (o as unknown as Record<string, string>)[keyField]; if (key && !(key in rowOf)) rowOf[key] = nums[k + 1]; });
  return { rows: errors.length ? [] : out, errors, rowOf };
}

// ---------------------------------------------------------------- where a defect sits in the uploaded files

/** Which uploaded file a rule's references point into. Engine references are unit keys and employee refs (see engineInput). */
const DEFECT_FILES: Record<string, Kind[]> = { STRUCTURE: ["units"], V1: ["units"], V2: ["leaders", "people"], V3: ["units"], V4: ["people"], V6: ["units"], V7: ["people"] };

/** "people file row 14" for each reference of a defect that came from a file uploaded in this session. `maps` is Parsed.rowOf per kind. */
export function defectLocations(rule: string, refs: string[], maps: Partial<Record<Kind, Record<string, number>>>): string[] {
  const out: string[] = [];
  for (const ref of refs) for (const k of DEFECT_FILES[rule] ?? []) { const r = maps[k]?.[ref]; if (r) out.push(`${k} file row ${r}`); }
  return out;
}
