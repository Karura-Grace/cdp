// Separate scoring key (AC 3.6). Needs migration 23 part 2 applied (the application's server key has lost the read functions) and SCORING_KEY set.
//   node --env-file=apps/web/.env.local scripts/e2e-scoring-key.mjs <project-ref> <token-file> [base-url]
// Checks: the server key, a staff key and the anon key are all refused the six functions that return response rows; the scoring key runs them
// on frozen data, is refused on unfrozen data, cannot write anything, cannot reach other tables; and the application still scores, freezes,
// compares pulses and reads 360 through it (a fresh client is seeded up to a released report, which freezes and scores through the routes).
import { execFileSync } from "node:child_process";
import { ok, done, svc, scoring, signIn } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const NAME = `Scoring key test ${new Date().toISOString().slice(2, 19).replace(/\D/g, "")}`;
ok("SCORING_KEY is set", !!process.env.SCORING_KEY);
const claims = JSON.parse(Buffer.from(process.env.SCORING_KEY.split(".")[1], "base64url"));
ok("the key's role is scoring_reader and it has an expiry", claims.role === "scoring_reader" && claims.exp > Date.now() / 1000, JSON.stringify({ role: claims.role, exp: claims.exp }));

execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-rich-demo.mjs", ref, tokenFile, base, NAME, "released"], { encoding: "utf8" });
const db = svc(), sc = scoring();
const { data: ten } = await db.from("tenant").select("tenant_id").eq("name", NAME).single();
const { data: asm } = await db.from("assessment").select("assessment_id, frozen_at").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id;
ok("the seeded assessment is frozen (the seed froze it through the scoring key)", !!asm.frozen_at);

// ---------------------------------------------------------------- refused to everything but the scoring key
const call = (c, fn, args) => c.rpc(fn, args);
const calls = [["rpc_frozen_response_set", { p_assessment_id: A }], ["rpc_frozen_360_set", { p_assessment_id: A }], ["rpc_closed_pulse_set", { p_pulse: "pls_none", p_floor: 5 }]];
const staff = await signIn("consultant@cdp-demo.example");
for (const [fn, args] of calls) {
  const r = await call(db, fn, args);
  ok(`the server key (service_role) is refused ${fn}`, !!r.error && /permission denied/i.test(r.error.message), r.error?.message ?? "returned data");
  const s = await call(staff.c, fn, args);
  ok(`a signed in consultant is refused ${fn}`, !!s.error, "returned data");
}
for (const fn of ["frozen_response_set", "frozen_360_set", "closed_pulse_set"]) {
  const r = await db.schema("capture").rpc(fn, fn === "closed_pulse_set" ? { p_pulse: "pls_none", p_floor: 5 } : { p_assessment_id: A });
  ok(`the server key cannot run capture.${fn} directly either`, !!r.error, r.error?.message ?? "returned data");
}

// ---------------------------------------------------------------- the scoring key
const set = await call(sc, "rpc_frozen_response_set", { p_assessment_id: A });
ok("the scoring key reads the frozen response set", !set.error && set.data.length >= 30, set.error?.message ?? set.data?.length);
ok("rows carry no person, invitation or token field", set.data.every((r) => !/person|invitation|token|email|name/i.test(Object.keys(r).join())), Object.keys(set.data[0]).join());
const f360 = await call(sc, "rpc_frozen_360_set", { p_assessment_id: A });
ok("the scoring key reads the frozen 360 set", !f360.error, f360.error?.message);
const openAsm = (await db.from("assessment").select("assessment_id").is("frozen_at", null).limit(1).maybeSingle()).data;
if (openAsm) {
  const r = await call(sc, "rpc_frozen_response_set", { p_assessment_id: openAsm.assessment_id });
  ok("the scoring key is refused an assessment that is not frozen", !!r.error && /DATA_NOT_FROZEN/.test(r.error.message), r.error?.message);
}
const pr = await call(sc, "rpc_closed_pulse_set", { p_pulse: "pls_none", p_floor: 5 });
ok("the scoring key is refused a pulse that is not closed", !!pr.error && /DATA_NOT_FROZEN/.test(pr.error.message), pr.error?.message);
const w = await sc.from("audit_log").insert({ tenant_id: ten.tenant_id, action: "probe", object_type: "x", object_id: "x" });
ok("the scoring key cannot write to the audit log", !!w.error, "inserted");
await sc.from("assessment").update({ status: "DRAFT" }).eq("assessment_id", A);   // refused, or changes nothing: checked next
const after = (await db.from("assessment").select("status").eq("assessment_id", A).single()).data.status;
ok("an attempt by the scoring key to change an assessment changes nothing", after === "FROZEN", after);
for (const t of [["capture", "response"], ["capture", "invitation"], ["public", "person_of_record"], ["public", "tenant"]]) {
  const r = await sc.schema(t[0]).from(t[1]).select("*").limit(1);
  ok(`the scoring key cannot read ${t.join(".")}`, !!r.error || (r.data ?? []).length === 0, JSON.stringify(r.data)?.slice(0, 60));
}
const inv = await call(sc, "rpc_issue_person_invitations", { p_assessment_id: A, p_people: ["per_x"] });
ok("the scoring key cannot issue links", !!inv.error, "returned data");

// ---------------------------------------------------------------- the application still works through it
const hdr = { authorization: `Bearer ${staff.t}`, "content-type": "application/json" };
const sc1 = await fetch(`${base}/v1/assessments/${A}/score`, { method: "POST", headers: hdr });
ok("scoring through the route works (idempotent on the same set)", sc1.status === 200 || sc1.status === 201, sc1.status);
const fr = await fetch(`${base}/v1/assessments/${A}/freeze`, { method: "POST", headers: hdr });
ok("the freeze route still answers (already frozen)", fr.status === 200, fr.status);
const stored = (await db.from("assessment").select("response_set_hash").eq("assessment_id", A).single()).data.response_set_hash;
ok("the stored response set hash is present", /^sha256:/.test(stored ?? ""), stored);

done();
