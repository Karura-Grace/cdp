// The technical appendix rows, including the org graph checks and overrides (spec §1.6.1). No database.
import { appendixRows } from "../apps/web/lib/export/appendix.ts";
let fail = 0;
const ok = (n, c, x = "") => { if (!c) fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : x); };
const base = { rep: { score_version: 2, payload_hash: "sha256:r" }, score: { instrument_version: "1.1", rules_version: "2.0" }, frozenAt: "2026-10-01T10:00:00Z", scoreHash: "sha256:s", evaluationHash: "sha256:e" };
const rows = (org) => appendixRows({ ...base, org });
const get = (r, k) => r.filter(([x]) => x === k).map(([, v]) => v);

let r = rows({ recorded: true, overrides: {}, warnings: [] });
ok("versions and hashes come first", r[0][0] === "Instrument version" && get(r, "Score hash")[0] === "sha256:s" && get(r, "Score version")[0].includes("frozen 2026-10-01"));
ok("clean launch says all blocking rules passed", /passed at launch\. No overrides/.test(get(r, "Organisation graph checks")[0]));
ok("no override rows when there are none", !r.some(([k]) => k.startsWith("Override")));
r = rows({ recorded: true, overrides: { V6: "Team merges next month", V1: "Leader starts Monday" }, warnings: ["Executive cohort projected at 3; perception gap will not compute below 5"] });
ok("each override is listed with its rule and reason", get(r, "Override V6")[0] === "Team merges next month" && get(r, "Override V1")[0] === "Leader starts Monday");
ok("the summary counts the overrides", /2 blocking rule\(s\) overridden/.test(get(r, "Organisation graph checks")[0]));
ok("warnings are listed", get(r, "Graph warning at launch")[0].includes("perception gap"));
r = rows({ recorded: false, overrides: {}, warnings: [] });
ok("an engagement launched before the graph existed says so, and does not claim a pass", /Not recorded/.test(get(r, "Organisation graph checks")[0]) && !/passed/.test(get(r, "Organisation graph checks")[0]));
console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
