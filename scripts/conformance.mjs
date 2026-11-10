// Conformance runner for the spec cross check. Runs the engine tests, the e2e suites and the conformance probes, collects every
// PASS and FAIL, maps them to rows of docs/spec-crosscheck/requirements.csv, and writes status_auto and last_run there.
//   node scripts/conformance.mjs [--base http://localhost:3100] [--only probes|engine|e2e] [--keep-clients] [--include-release]
// A row is mapped when a check label carries its id in brackets ("[APPI-segments.floor] ..."), or when its evidence_test names
// a script and a check label ("e2e-ui.mjs: login page renders") or an engine test ("spec.test.ts UT-29").
// The e2e suites create their own test clients; those created during the run are removed at the end (with a backup) unless
// --keep-clients. e2e-release.mjs re-scores the reference bank and is left out unless --include-release.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { mapResults } from "./conformance/map.mjs";

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const base = arg("--base", "http://localhost:3100"), only = arg("--only", null);
const REF = "swnvjucteqguqdbsdmsl", TOKEN = "/mnt/c/Users/PAC/Desktop/MCain-Supabase-Token.txt";
const ENV = ["--env-file=apps/web/.env.local"];
process.env.NODE_OPTIONS = "--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=4000";
const started = new Date().toISOString();

const R = [REF, TOKEN, base];
const SUITES = [
  ["probes", "config", ["scripts/conformance/probes/config.mjs"]],
  ["probes", "item-bank", ["scripts/conformance/probes/item-bank.mjs"]],
  ["probes", "errors-events", ["scripts/conformance/probes/errors-events.mjs"]],
  ["probes", "api-data", ["scripts/conformance/probes/api-data.mjs"]],
  ["probes", "production", ["scripts/conformance/probes/production.mjs"]],
  ...[["e2e-ui", [base]], ["e2e-console", [base]], ["e2e-logo", [base]], ["e2e-users", [base]], ["e2e-orgs", [base]], ["e2e-segments", [base]], ["e2e-measure", [base]],
    ["e2e-setup", R], ["e2e-org", R], ["e2e-launch", R], ["e2e-live", R], ["e2e-plan", R], ["e2e-pulse", R], ["e2e-adjust", R], ["e2e-rollover", R], ["e2e-lifecycle", R],
    ["e2e-scoring-key", R], ["e2e-team", R], ["e2e-ac41", []], ["inspect-ac24", [REF, TOKEN]],
    ...(process.argv.includes("--include-release") ? [["e2e-release", [base]]] : [])]
    .map(([n, a]) => ["e2e", n, [`scripts/${n}.mjs`, ...a]]),
];

const results = [];   // { suite, label, pass }
if (!only || only === "engine") {
  const r = spawnSync("npx", ["vitest", "run", "--reporter=json"], { cwd: "packages/cdp-engine", encoding: "utf8", maxBuffer: 64 << 20 });
  const j = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  for (const f of j.testResults) for (const t of f.assertionResults) results.push({ suite: f.name.split("/").pop(), label: t.fullName, pass: t.status === "passed" });
  console.log(`engine: ${j.numPassedTests} passed, ${j.numFailedTests} failed`);
}
for (const [kind, name, args] of SUITES) {
  if (only && only !== kind) continue;
  const r = spawnSync("node", [...ENV, ...args], { encoding: "utf8", maxBuffer: 64 << 20, timeout: 900000 });
  const lines = (r.stdout ?? "").split("\n").filter((l) => /^(PASS|FAIL) /.test(l));
  for (const l of lines) results.push({ suite: `${name}.mjs`, label: l.replace(/^(PASS|FAIL) /, "").trim(), pass: l.startsWith("PASS") });
  console.log(`${name}: ${lines.filter((l) => l.startsWith("PASS")).length} passed, ${lines.filter((l) => l.startsWith("FAIL")).length} failed${r.status && !lines.length ? ` (exit ${r.status})` : ""}`);
}
writeFileSync("docs/spec-crosscheck/last-run.json", JSON.stringify({ started, finished: new Date().toISOString(), base, results }, null, 1));

// ---------------------------------------------------------------- map to the matrix
if (existsSync("docs/spec-crosscheck/requirements.csv")) { const r = mapResults(results, started); console.log(`matrix: ${r.mapped} of ${r.total} rows proved or disproved by this run`); }

// ---------------------------------------------------------------- remove the test clients this run created (with a backup)
if (!process.argv.includes("--keep-clients") && (!only || only === "e2e")) {
  const out = execFileSync("node", [...ENV, "-e", `import("@supabase/supabase-js").then(async ({createClient}) => { const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }); const { data } = await s.from("tenant").select("tenant_id").gte("created_at", "${started}"); console.log((data ?? []).map((t) => t.tenant_id).join(" ")); })`], { encoding: "utf8" }).trim();
  for (const t of out.split(/\s+/).filter(Boolean)) {
    const c = spawnSync("node", [...ENV, "scripts/cleanup-test-tenants.mjs", REF, TOKEN, "--only", t, "--apply"], { encoding: "utf8", timeout: 600000 });
    const done = /done: \d+ clients/.test(c.stdout ?? "");
    console.log(done ? `removed test client ${t}` : `COULD NOT REMOVE test client ${t}: ${(c.stdout ?? "").split("\n").filter((l) => /Error|failed/i.test(l)).join(" ").slice(0, 120) || `exit ${c.status}`}`);
  }
}
const failed = results.filter((x) => !x.pass).length;
console.log(`\n${results.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
