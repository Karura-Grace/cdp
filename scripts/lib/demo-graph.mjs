// A valid org graph for demos and tests (no real people). One department per 8 teams; the first person of each team leads
// it and sits in it; they are in the Executive grade, everyone else is Staff. Every team is as large as asked.
//   buildGraph([10, 10, 140], { asOf: "2026-01-01", domain: "demo.example" })
export function buildGraph(teamSizes, { asOf = "2026-01-01", domain = "demo.example", prefix = "" } = {}) {
  const pad = (n, w = 3) => String(n).padStart(w, "0");
  const grades = [{ name: "Board", rank_order: 1, is_executive: true }, { name: "Executive", rank_order: 2, is_executive: true }, { name: "Manager", rank_order: 3, is_executive: false }, { name: "Staff", rank_order: 4, is_executive: false }];
  const locations = [{ name: "Nairobi" }];
  const units = [{ unit_key: "ORG", name: "Head office", type: "DIVISION", parent_key: null, rollup_to_parent: false }];
  const people = [], leaders = [];
  const depts = Math.ceil(teamSizes.length / 8);
  for (let d = 1; d <= depts; d++) units.push({ unit_key: `D${pad(d, 2)}`, name: `Department ${d}`, type: "DEPARTMENT", parent_key: "ORG", rollup_to_parent: false });
  let n = 0;
  teamSizes.forEach((size, i) => {
    const key = `T${pad(i + 1)}`;
    units.push({ unit_key: key, name: `Team ${i + 1}`, type: "TEAM", parent_key: `D${pad(Math.floor(i / 8) + 1, 2)}`, rollup_to_parent: false });
    for (let k = 0; k < size; k++) {
      n++;
      people.push({ employee_ref: `${prefix}E${pad(n, 5)}`, email: `e${pad(n, 5)}@${domain}`, unit_key: key, grade: k === 0 ? "Executive" : "Staff", location: "Nairobi", employment_status: "ACTIVE" });
    }
    leaders.push({ employee_ref: people[n - size].employee_ref, team_key: key, effect_from: asOf, effect_to: null });
  });
  return { grades, locations, units, people, leaders };
}
