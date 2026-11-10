// AC 4.1 on the API path: the fixture engagement (scored, evaluated and planned through the app's own routes, not the engine called directly)
// reproduces C1 MISS 50.0%, C2 MISS (rank 3, 14.0, SUBSTANTIVE), C3 SYSTEMIC MISS with identity risk, C4 PARTIAL HIT 86.7%, and the stored
// evaluation and plan equal the engine's expected objects in oracle/cases/fixture.json, byte for byte (canonical JSON).
//   node --env-file=apps/web/.env.local scripts/e2e-ac41.mjs
// Needs the fixture seeded (seed-demo.mjs fixture), the evaluation stored (e2e-release or the demo seed) and, for the plan check, the plan built.
import { readFileSync } from "node:fs";
import { ok, done, svc } from "./lib/e2e.mjs";

const fx = JSON.parse(readFileSync(new URL("../packages/cdp-engine/oracle/cases/fixture.json", import.meta.url)));
const db = svc();
const { data: ten } = await db.from("tenant").select("tenant_id").eq("name", "Demo Retail Bank (fixture)").single();
const { data: asm } = await db.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).single();
const { data: ev } = await db.from("evaluation").select("payload_json, payload_hash, score_version").eq("assessment_id", asm.assessment_id).order("score_version", { ascending: false }).limit(1).single();
const f = ev.payload_json.findings;
const one = (type) => f.find((x) => x.type === type);

const c1 = one("C1_PERFORMANCE_ALIGNMENT");
ok("C1 is a MISS at 50.0% alignment", c1?.verdict === "MISS" && c1.metrics.alignment_pct === "50.0", JSON.stringify(c1?.metrics));
const c2 = one("C2_BEHAVIOUR_GAP");
ok("C2 is a MISS at rank 3, 14.00 points, SUBSTANTIVE", c2?.verdict === "MISS" && c2.metrics.rank === 3 && c2.metrics.intensity === "SUBSTANTIVE" && c2.metrics.behaviour_gap_points === "14.00", JSON.stringify(c2?.metrics));
const c3 = one("C3_STOP_START");
ok("C3 is a SYSTEMIC MISS with identity risk", c3?.verdict === "SYSTEMIC_MISS" && c3.metrics.identity_risk === true, JSON.stringify(c3?.metrics));
const c4 = one("C4_MODEL_READINESS");
ok("C4 is a PARTIAL HIT at 86.7%", c4?.verdict === "PARTIAL_HIT" && c4.metrics.alignment_pct === "86.7", JSON.stringify(c4?.metrics));
ok("the checks summary agrees", JSON.stringify(ev.payload_json.checks) === JSON.stringify({ C1: "MISS", C2: "MISS", C3: "SYSTEMIC_MISS", C4: "PARTIAL_HIT" }), JSON.stringify(ev.payload_json.checks));

// canonical JSON: sorted keys, so the stored object and the engine's expected object compare as text
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
ok("the stored evaluation equals the engine's expected evaluation", canon(ev.payload_json) === canon(fx.expected.evaluation), ev.payload_hash);

const { data: pl } = await db.from("plan").select("payload_json").eq("assessment_id", asm.assessment_id).order("score_version", { ascending: false }).limit(1).maybeSingle();
if (pl) ok("the stored plan equals the engine's expected plan", canon(pl.payload_json) === canon(fx.expected.plan), "differs");
else console.log("note: no plan built for the fixture; the plan comparison was skipped");

done();
