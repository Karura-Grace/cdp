// Projected cohort sizes for Section I1 (spec 1.4.4, 1.5.4: "ACTIVE persons matching the predicate; pre-flight warnings only, never reporting").
// Pure TypeScript with no imports. The same axes the survey link snapshot carries: department, grade, tenure band and the executive flag,
// plus demographic attributes. Values are compared ignoring case and edge spaces.

// Up to five conditions, as axis1 and value1 to axis5 and value5 (see MAX_CONDITIONS in section-i.mjs).
export type CohortIn = { name: string; rollup_to_parent?: boolean } & { [k in `axis${1 | 2 | 3 | 4 | 5}`]?: string } & { [k in `value${1 | 2 | 3 | 4 | 5}`]?: string };
export interface CohortPerson { person_id: string; unit_id: string | null; grade_id: string | null; start_date: string | null }
export interface CohortRefs {
  units: { unit_id: string; name: string; type: string; parent_unit_id: string | null }[];
  grades: { grade_id: string; name: string; is_executive: boolean }[];
  bands: { name: string; min_months: number; max_months: number | null }[];
  /** person_id -> attribute name (lower case) -> value */
  demographics: Map<string, Record<string, string>>;
  /** the survey window start, which tenure is measured at */
  at: string;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/** Whole months from `start` to `at` (the same count the invitation snapshot makes with age()). */
export function monthsBetween(start: string, at: string): number {
  const [y1, m1, d1] = start.slice(0, 10).split("-").map(Number), [y2, m2, d2] = at.slice(0, 10).split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

export function projectCohort(c: CohortIn, people: CohortPerson[], r: CohortRefs): number {
  const unit = new Map(r.units.map((u) => [u.unit_id, u])), grade = new Map(r.grades.map((g) => [g.grade_id, g]));
  const department = (unitId: string | null) => {
    let u = unitId ? unit.get(unitId) : undefined; const own = u;
    for (let d = 0; u && d < 10; d++, u = u.parent_unit_id ? unit.get(u.parent_unit_id) : undefined) if (u.type === "DEPARTMENT") return u.name;
    return own?.name ?? "UNKNOWN";
  };
  const band = (p: CohortPerson) => {
    if (!p.start_date) return "UNKNOWN";
    const m = monthsBetween(p.start_date, r.at);
    return r.bands.find((b) => m >= b.min_months && (b.max_months === null || m < b.max_months))?.name ?? "UNKNOWN";
  };
  const holds = (axis: string | undefined, value: string | undefined, p: CohortPerson) => {
    const v = norm(value);
    switch (axis) {
      case "DEPARTMENT": return norm(department(p.unit_id)) === v;
      case "GRADE": return norm(p.grade_id ? grade.get(p.grade_id)?.name : "UNKNOWN") === v;
      case "TENURE_BAND": return norm(band(p)) === v;
      case "EXECUTIVE": return ((p.grade_id ? grade.get(p.grade_id)?.is_executive : false) ? "yes" : "no") === v;
      case "DEMOGRAPHIC": { const i = String(value ?? "").indexOf("="); return i > 0 && norm(r.demographics.get(p.person_id)?.[norm(String(value).slice(0, i))]) === norm(String(value).slice(i + 1)); }
      default: return false;
    }
  };
  const conds = ([1, 2, 3, 4, 5] as const).flatMap((k) => (c[`axis${k}`] ? [[c[`axis${k}`], c[`value${k}`]] as const] : []));
  return people.filter((p) => conds.length > 0 && conds.every(([a, v]) => holds(a, v, p))).length;
}
