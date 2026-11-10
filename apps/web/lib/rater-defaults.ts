// Rater defaults from the org graph (spec 1.4.6, D-09). Pure TypeScript with no imports.
//   superior       the line manager (1): whoever leads the team the leader sits in
//   direct reports all direct team members
//   peers          3 to 8 are nominated, so these are suggestions only: the leaders of the other teams under the same parent unit, at most 8
interface GraphLike {
  units: { unit_key: string; parent_key: string | null }[];
  people: { employee_ref: string; unit_key: string | null; employment_status: string }[];
  leaders: { assignment_id: string; employee_ref: string; team_key: string; effect_from: string; effect_to: string | null }[];
}

/** `chain` is the leader's reporting chain from reportingChains (leader first, then the manager). `personOf` maps employee refs to person ids. */
export function raterDefaults(g: GraphLike, windowStart: string, assignmentId: string, chain: string[] | undefined, personOf: Map<string, string>) {
  const l = g.leaders.find((x) => x.assignment_id === assignmentId);
  if (!l) return null;
  const parent = g.units.find((u) => u.unit_key === l.team_key)?.parent_key ?? null;
  const sameParent = new Set(g.units.filter((u) => parent && u.parent_key === parent && u.unit_key !== l.team_key).map((u) => u.unit_key));
  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  return {
    superior: (chain?.[1] ? personOf.get(chain[1]) : undefined) ?? null,
    direct_reports: uniq(g.people.filter((p) => p.employment_status === "ACTIVE" && p.unit_key === l.team_key && p.employee_ref !== l.employee_ref).map((p) => personOf.get(p.employee_ref))),
    peers: uniq(g.leaders.filter((x) => sameParent.has(x.team_key) && x.effect_from <= windowStart && (x.effect_to === null || x.effect_to >= windowStart) && x.employee_ref !== l.employee_ref).map((x) => personOf.get(x.employee_ref))).slice(0, 8),
  };
}
