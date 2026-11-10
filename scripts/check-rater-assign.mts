// Automatic rater selection (apps/web/lib/rater-assign.ts). Run: node --experimental-strip-types scripts/check-rater-assign.mts
import assert from "node:assert/strict";
import { DR_MAX, GROUP_FLOOR, MAX_LOAD, PEER_TARGET, assignRaters, type LeaderIn } from "../apps/web/lib/rater-assign.ts";

// 3 departments of 4 leaders, each leader with a team of 6
const mk = (n: number): LeaderIn[] => Array.from({ length: n }, (_, i) => ({ assignment_id: `lea_${String(i).padStart(2, "0")}`, person_id: `per_L${i}`, team_unit: `t${i}`, department: `d${Math.floor(i / 4)}`,
  direct_reports: Array.from({ length: 6 }, (_, k) => `per_T${i}_${k}`) }));
const L = mk(12);
const a = assignRaters(L, "asm_demo");

assert.deepEqual(a, assignRaters(L, "asm_demo"), "the same seed gives the same result");
assert.notDeepEqual(a, assignRaters(L, "asm_other"), "a different seed gives a different draw");
for (const p of a) {
  assert.equal(p.peers.length, PEER_TARGET, `peers ${p.peers.length}`);
  assert.equal(new Set(p.peers).size, p.peers.length, "no peer twice");
  assert.ok(!p.peers.includes(`per_L${Number(p.assignment_id.slice(4))}`), "a leader is never their own peer");
  assert.ok(p.direct_reports.length === 6 && p.direct_reports.every((d) => d.startsWith(`per_T${Number(p.assignment_id.slice(4))}_`)), "direct reports come from the leader's own team only");
  assert.deepEqual(p.short, []);
}
// nobody rates more than MAX_LOAD leaders, and the load is spread evenly
const load = new Map<string, number>(); for (const p of a) for (const x of p.peers) load.set(x, (load.get(x) ?? 0) + 1);
assert.ok([...load.values()].every((n) => n <= MAX_LOAD), "no one is a peer for more than 3 leaders");
const counts = L.map((l) => load.get(l.person_id) ?? 0);
assert.ok(counts.every((n) => n === MAX_LOAD), `with 12 leaders at 3 peers each, every leader rates exactly 3: ${counts}`);
// same department first
const sameDept = a.map((p) => p.peers.filter((x) => L.find((l) => l.person_id === x)!.department === L.find((l) => l.assignment_id === p.assignment_id)!.department).length);
assert.ok(sameDept.every((n) => n >= 2), `peers come from the own department first where load allows: ${sameDept}`);
// a big team is capped
const big = assignRaters([{ ...L[0], direct_reports: Array.from({ length: 30 }, (_, k) => `x${k}`) }, ...L.slice(1)], "s");
assert.equal(big[0].direct_reports.length, DR_MAX);
// too few leaders: the shortfall is reported, not hidden
const two = assignRaters(mk(2), "s"); assert.ok(two.every((p) => p.peers.length === 1 && p.short.some((s) => s.group === "PEER" && s.have === 1)));
// a tiny team is reported as short
const tiny = assignRaters([{ ...L[0], direct_reports: ["a", "b"] }, ...L.slice(1)], "s"); assert.ok(tiny[0].short.some((s) => s.group === "DIRECT_REPORT" && s.have === 2));
assert.equal(PEER_TARGET <= 8 && PEER_TARGET >= 3, true);
console.log("rater assignment ok");
