// Automatic rater selection for the Leadership 360 (owner ruling 22 Oct 2026, Erick Ngala comment 18; rounds Q-RT1 to Q-RT4 in the decisions log).
// Pure TypeScript with no imports, so a node check can run it.
//   supervisor      picked by the Client Admin from a list, never by this module
//   direct reports  everyone else in the leader's own team, drawn at random, at most DR_MAX
//   peers           other leaders in the same department first, then in other departments, drawn at random, PEER_TARGET each
//   balance         nobody rates more than MAX_LOAD leaders: a person who has reached it is skipped and the load goes to others, and among the
//                   rest the people with the fewest selections so far come first, so the load is spread evenly. Ties are broken at random.
//   random          seeded (the assessment id), so running it again gives the same result and the choice can be explained and repeated.
// Peers are drawn from the leaders, and nobody may rate more than MAX_LOAD of them, so on average a leader can have at most MAX_LOAD peers: 3 each, the floor,
// is the largest number that is fair to everyone. A larger target would starve the leaders served last.
export const PEER_TARGET = 3, DR_MAX = 8, MAX_LOAD = 3, GROUP_FLOOR = 3;

export interface LeaderIn { assignment_id: string; person_id: string; team_unit: string; department: string; direct_reports: string[] }
export interface Picks { assignment_id: string; peers: string[]; direct_reports: string[]; short: { group: "PEER" | "DIRECT_REPORT"; have: number }[] }

/** mulberry32: a small seeded generator, enough for fair shuffling. */
export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h ^= h >>> 16) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffled = <T,>(xs: T[], r: () => number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function assignRaters(leaders: LeaderIn[], seed: string, opts: { peerTarget?: number } = {}): Picks[] {
  const r = rng(seed), target = opts.peerTarget ?? PEER_TARGET;
  const load = new Map<string, number>();                       // times a person has been picked as a peer so far
  const order = shuffled([...leaders].sort((a, b) => (a.assignment_id < b.assignment_id ? -1 : 1)), r);   // a random leader order, so nobody is always served first
  const out = new Map<string, Picks>();
  for (const l of order) {
    const dr = shuffled(l.direct_reports.filter((p) => p !== l.person_id), r).slice(0, DR_MAX);
    const others = leaders.filter((x) => x.assignment_id !== l.assignment_id && x.person_id !== l.person_id);
    const pick = (pool: LeaderIn[], need: number, taken: Set<string>) => {
      const cand = [...new Set(pool.map((x) => x.person_id))].filter((p) => !taken.has(p) && (load.get(p) ?? 0) < MAX_LOAD);
      const byLoad = shuffled(cand, r).sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));   // stable sort keeps the random order inside a load level
      return byLoad.slice(0, Math.max(0, need));
    };
    const taken = new Set<string>(dr);
    const same = pick(others.filter((x) => x.department === l.department), target, taken);
    same.forEach((p) => taken.add(p));
    const more = same.length < target ? pick(others.filter((x) => x.department !== l.department), target - same.length, taken) : [];
    const peers = [...same, ...more];
    for (const p of peers) load.set(p, (load.get(p) ?? 0) + 1);
    out.set(l.assignment_id, { assignment_id: l.assignment_id, peers, direct_reports: dr,
      short: [...(peers.length < GROUP_FLOOR ? [{ group: "PEER" as const, have: peers.length }] : []), ...(dr.length < GROUP_FLOOR ? [{ group: "DIRECT_REPORT" as const, have: dr.length }] : [])] });
  }
  return leaders.map((l) => out.get(l.assignment_id)!);
}
