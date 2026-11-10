// Watch-list pulses end to end (Measure stage, step B). Seeds its own client up to a released report (seed-rich-demo.mjs), builds the plan,
// then: who may create, open, close and read; the ten-item cap and the watch-list rule (422 PULSE_INVALID); single-use links and the
// neutral 410; answer validation; no read path to the capture tables; the reporting floor (4 answers are suppressed, 6 are shown);
// INDICATIVE results stored once; PULSE_MOVEMENT triggers; append-only rows; audit rows.
//   node --env-file=apps/web/.env.local scripts/e2e-pulse.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { ok, done, svc, scoring, signIn } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const NAME = `Pulse test ${new Date().toISOString().slice(2, 19).replace(/\D/g, "")}`;
execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-rich-demo.mjs", ref, tokenFile, base, NAME, "released"], { encoding: "utf8" });
const SLUG = NAME.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
const db = svc();
const { data: ten } = await db.from("tenant").select("tenant_id").eq("name", NAME).single();
const { data: asm } = await db.from("assessment").select("assessment_id, engagement_id").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id, E = asm.engagement_id;
const who = {
  con: await signIn("consultant@cdp-demo.example"),
  admin: await signIn(`admin.${SLUG}@cdp-demo.example`),
  exec: await signIn(`exec.${SLUG}@cdp-demo.example`),
  other: await signIn("admin.fixture@cdp-demo.example"),
};
const call = async (w, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${who[w].t}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const survey = async (method, token, body) => {
  const r = await fetch(base + "/v1/pulse-survey", { method, headers: { "x-survey-token": token, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};

// ---------------------------------------------------------------- the plan this pulse sits on
let [s, j] = await call("con", "POST", `/v1/assessments/${A}/plan`, {});
ok("consultant builds the plan", s === 201 || s === 200, `${s} ${j?.code}`);
const { data: plan } = await db.from("plan").select("payload_json").eq("assessment_id", A).order("score_version", { ascending: false }).limit(1).single();
const pri = plan.payload_json.priorities.find((p) => new Set(p.actions.flatMap((a) => a.watchlist)).size >= 3);
const WL = [...new Set(pri.actions.flatMap((a) => a.watchlist))];
const kinds = (r) => (/^D[1-6] S[1-3]$/.test(r) ? "scenario" : /^D[7-9]$/.test(r) ? "dim" : "eos");
const items = ["scenario", "dim", "eos"].map((k) => WL.find((r) => kinds(r) === k)).filter(Boolean);
ok("the priority offers a watch-list to build from", items.length >= 2, WL.join(","));
const P = pri.priority_id;

// ---------------------------------------------------------------- create
[s] = await call("admin", "POST", `/v1/engagements/${E}/pulses`, { priority_id: P, review_point: "+90d", items });
ok("a client admin cannot create a pulse", s === 403, s);
[s] = await call("exec", "POST", `/v1/engagements/${E}/pulses`, { priority_id: P, review_point: "+90d", items });
ok("an executive cannot create a pulse", s === 403, s);
[s, j] = await call("con", "POST", `/v1/engagements/${E}/pulses`, { priority_id: P, review_point: "+90d", items: [...items, "D1 S9"] });
ok("an item off the watch-list is refused (PULSE_INVALID)", s === 422 && j?.code === "PULSE_INVALID", `${s} ${j?.code}`);
[s, j] = await call("con", "POST", `/v1/engagements/${E}/pulses`, { priority_id: P, review_point: "+90d", items: Array.from({ length: 11 }, (_, i) => `eOS Q${i + 1}`) });
ok("more than ten items is refused (PULSE_INVALID)", s === 422 && j?.code === "PULSE_INVALID", `${s} ${j?.code}`);
[s] = await call("con", "POST", `/v1/engagements/${E}/pulses`, { priority_id: P, review_point: "+30d", items });
ok("an unknown review point is refused", s === 422, s);
[s, j] = await call("con", "POST", `/v1/engagements/${E}/pulses`, { priority_id: "pri_99", review_point: "+90d", items });
ok("a priority that is not in the plan is refused", s === 422, `${s} ${j?.code}`);
[s, j] = await call("con", "POST", `/v1/engagements/${E}/pulses`, { priority_id: P, review_point: "+90d", items });
ok("the consultant creates the 90 day pulse", s === 201, `${s} ${j?.code} ${j?.title}`);
const PA = j.pulse_id;
[s, j] = await call("con", "POST", `/v1/engagements/${E}/pulses`, { priority_id: P, review_point: "+90d", items });
ok("the same priority and review point cannot be created twice (409)", s === 409, `${s} ${j?.code}`);
const { data: pa } = await db.from("pulse").select("*").eq("pulse_id", PA).single();
ok("the baseline reading is stored on exactly the pulse's items, with no responses in it", pa.status === "DRAFT" && pa.baseline_json?.reading && Object.keys(pa.baseline_json).sort().join() === "n,reading", JSON.stringify(Object.keys(pa.baseline_json ?? {})));

const reads = async (w, t) => (await who[w].c.from(t).select("*").eq("engagement_id", E)).data ?? [];
ok("PAC, client admin and executive read the pulse", (await reads("con", "pulse")).length === 1 && (await reads("admin", "pulse")).length === 1 && (await reads("exec", "pulse")).length === 1);
ok("another tenant sees no pulse", (await reads("other", "pulse")).length === 0);

// ---------------------------------------------------------------- open
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
[s] = await call("admin", "POST", `/v1/pulses/${PA}/open`, { closes: day(7) });
ok("a client admin cannot open a pulse", s === 403, s);
[s] = await call("con", "POST", `/v1/pulses/${PA}/open`, { closes: "soon" });
ok("a bad close date is refused", s === 422, s);
[s] = await call("con", "POST", `/v1/pulses/${PA}/open`, { closes: day(-1) });
ok("a close date in the past is refused", s === 422, s);
[s, j] = await call("con", "POST", `/v1/pulses/${PA}/open`, { closes: day(7) });
const linksA = j?.links ?? [];
const { count: active } = await db.from("person_of_record").select("*", { count: "exact", head: true }).eq("tenant_id", ten.tenant_id).eq("employment_status", "ACTIVE");
ok("the consultant opens it and gets one link per active person", s === 201 && linksA.length === active && active >= 10, `${s} ${linksA.length}/${active}`);
[s] = await call("con", "POST", `/v1/pulses/${PA}/open`, { closes: day(7) });
ok("opening twice is refused (409)", s === 409, s);

// ---------------------------------------------------------------- respond
const first = linksA[0].token;
[s, j] = await survey("GET", "0".repeat(32));
ok("an unknown link is a neutral 410", s === 410, s);
[s, j] = await survey("GET", first);
ok("a live link shows only what the pulse asks", s === 200 && j.state === "OPEN" && j.items.join() === items.join() && Array.isArray(j.scenarios) && !/person_id|email/.test(JSON.stringify(j)), `${s} ${JSON.stringify(j)?.slice(0, 160)}`);

// answers for one respondent: `high` pushes every item the same way, so a group of them moves against the baseline
const answers = (mode) => Object.fromEntries(items.map((r) => {
  const k = kinds(r);
  if (k === "eos") return [r, mode === "high" ? 10 : 5];
  if (k === "dim") return [r, Object.fromEntries({ D7: ["D7-01", "D7-03", "D7-04", "D7-08"], D8: ["D8-02", "D8-03", "D8-05", "D8-11"], D9: ["D9-01", "D9-05", "D9-09", "D9-10"] }[r].map((i) => [i, mode === "high" ? 5 : 3]))];
  const other = pri.orientation === "ENGAGE" ? "INNOVATE" : "ENGAGE";
  return [r, mode === "high" ? { ENGAGE: 0, INNOVATE: 0, PERFORM: 0, GOVERN: 0, [other]: 100 } : { ENGAGE: 25, INNOVATE: 25, PERFORM: 25, GOVERN: 25 }];
}));
[s] = await survey("PUT", first, { answers: { ...answers("mid"), "eOS Q1": 11 } });
ok("an answer outside its scale is refused", s === 422, s);
[s] = await survey("PUT", first, { answers: { ...answers("mid"), "D1 S9": { ENGAGE: 100, INNOVATE: 0, PERFORM: 0, GOVERN: 0 } } });
ok("an answer for an item that is not on the pulse is refused", s === 422, s);
const scen = items.find((r) => kinds(r) === "scenario");
[s] = await survey("PUT", first, { answers: { ...answers("mid"), [scen]: { ENGAGE: 50, INNOVATE: 50, PERFORM: 50, GOVERN: 0 } } });
ok("a scenario that does not add up to 100 is refused", s === 422, s);
[s] = await survey("PUT", first, { answers: answers("mid") });
ok("a valid answer is accepted", s === 201, s);
[s] = await survey("PUT", first, { answers: answers("mid") });
ok("the same link cannot be used twice (410)", s === 410, s);
[s] = await survey("GET", first);
ok("a used link is the same neutral 410", s === 410, s);
for (const l of linksA.slice(1, 4)) await survey("PUT", l.token, { answers: answers("mid") });

// ---------------------------------------------------------------- the capture tables stay closed
for (const t of ["pulse_response", "pulse_invitation"]) {
  const r = await db.schema("capture").from(t).select("*").limit(1);
  ok(`the service role cannot read capture.${t}`, !!r.error, JSON.stringify(r.data)?.slice(0, 80));
}
const early = await scoring().rpc("rpc_closed_pulse_set", { p_pulse: PA, p_floor: 5 });
ok("the answers cannot be read while the pulse is open", !!early.error && /DATA_NOT_FROZEN/.test(early.error.message), early.error?.message);

// ---------------------------------------------------------------- close, suppression
[s] = await call("admin", "POST", `/v1/pulses/${PA}/close`);
ok("a client admin cannot close a pulse", s === 403, s);
[s] = await call("con", "POST", `/v1/pulses/${PA}/results`);
ok("results cannot be read before the pulse is closed (409)", s === 409, s);
[s] = await call("con", "POST", `/v1/pulses/${PA}/close`);
ok("the consultant closes it", s === 200, s);
[s] = await survey("PUT", linksA[5].token, { answers: answers("mid") });
ok("a closed pulse takes no more answers (410)", s === 410, s);
const tooFew = await scoring().rpc("rpc_closed_pulse_set", { p_pulse: PA, p_floor: 5 });
ok("below the floor the database refuses to return answers", !!tooFew.error && /BELOW_REPORTING_THRESHOLD/.test(tooFew.error.message), tooFew.error?.message);
[s, j] = await call("con", "POST", `/v1/pulses/${PA}/results`);
ok("4 answers: stored as suppressed, nothing shown", s === 201 && j.suppressed === true && j.responded === 4, `${s} ${JSON.stringify(j)}`);
const { data: ra } = await db.from("pulse_result").select("*").eq("pulse_id", PA).single();
ok("the suppressed result holds counts only", ra.suppressed && ra.reading_json === null && ra.n_responded === 4 && ra.n_invited === active, JSON.stringify(ra));

// ---------------------------------------------------------------- the 180 day pulse: enough answers, movement
[s, j] = await call("con", "POST", `/v1/engagements/${E}/pulses`, { priority_id: P, review_point: "+180d", items });
const PB = j?.pulse_id;
[s, j] = await call("con", "POST", `/v1/pulses/${PB}/open`, { closes: day(7) });
const linksB = j?.links ?? [];
for (const l of linksB.slice(0, 6)) await survey("PUT", l.token, { answers: answers("high") });
[s] = await call("con", "POST", `/v1/pulses/${PB}/close`);
[s, j] = await call("exec", "POST", `/v1/pulses/${PB}/results`);
ok("an executive cannot store results", s === 403, s);
[s, j] = await call("con", "POST", `/v1/pulses/${PB}/results`);
ok("6 answers: the result is shown and stored", s === 201 && j.suppressed === false && j.responded === 6, `${s} ${JSON.stringify(j)}`);
ok("movement raised at least one trigger", j?.triggers >= 1, JSON.stringify(j));
const { data: rb } = await db.from("pulse_result").select("*").eq("pulse_id", PB).single();
ok("the result is labelled INDICATIVE and carries the baseline beside it", rb.reading_json?.label === "INDICATIVE" && rb.reading_json.baseline && rb.reading_json.current, JSON.stringify(rb.reading_json)?.slice(0, 200));
ok("no response, person or token is in the stored result", !/"id"|person|token/i.test(JSON.stringify(rb)), "");
[s, j] = await call("con", "POST", `/v1/pulses/${PB}/results`);
ok("results are stored once", s === 200 && j.stored === false, `${s} ${JSON.stringify(j)}`);
const { data: trg } = await db.from("reassessment_trigger").select("type, source_ref, decision").eq("engagement_id", E).eq("type", "PULSE_MOVEMENT");
ok("a PULSE_MOVEMENT trigger waits for the consultant's decision", trg.length >= 1 && trg.every((t) => t.decision === null && /\(\+180d\)$/.test(t.source_ref)), JSON.stringify(trg));

// ---------------------------------------------------------------- reads and append-only
ok("the client admin and executive read the stored results", (await reads("admin", "pulse_result")).length === 2 && (await reads("exec", "pulse_result")).length === 2);
ok("another tenant reads no result", (await reads("other", "pulse_result")).length === 0);
let r = await db.from("pulse").update({ items: ["eOS Q1"] }).eq("pulse_id", PB);
ok("what a pulse asks cannot be changed", !!r.error && /APPEND_ONLY|permission denied/.test(r.error.message), r.error?.message);
r = await db.from("pulse").update({ status: "DRAFT" }).eq("pulse_id", PB);
ok("a pulse cannot move backwards", !!r.error && /ILLEGAL_TRANSITION|permission denied/.test(r.error.message), r.error?.message);
r = await db.from("pulse_result").delete().eq("pulse_id", PB);
ok("a result cannot be deleted", !!r.error && /APPEND_ONLY|permission denied/.test(r.error.message), r.error?.message);
const { data: aud } = await db.from("audit_log").select("action").eq("tenant_id", ten.tenant_id).eq("object_type", "pulse");
const acts = (aud ?? []).map((x) => x.action);
ok("created, opened, closed and result are audited", ["pulse.created", "pulse.closed", "pulse.result_stored"].every((a) => acts.includes(a)) && acts.some((a) => a.startsWith("pulse.opened:")), acts.join());

done();
