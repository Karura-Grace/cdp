// People Leader own-team view. Seeds its own client up to a released report (seed-rich-demo.mjs ... released), then checks:
// linking a login to a person (who may, validation, uniqueness), the team page (results when 5 or more answered, suppression
// below that), the leader's own 360 result and agreed development plan, and that nothing else opens.
//   node --env-file=apps/web/.env.local scripts/e2e-team.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { ok, done, svc, signIn, pwOf, URL_, ANON } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const NAME = `Team test ${new Date().toISOString().slice(2, 19).replace(/\D/g, "")}`;
const SLUG = NAME.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
const out = execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-rich-demo.mjs", ref, tokenFile, base, NAME, "released"], { encoding: "utf8" });
const bigKey = /lead\.\S+ leads (.+?) \((\d+) answers\)/.exec(out)?.[1];
const smallKey = /small team (.+?) \((\d+) answers\)/.exec(out)?.[1];
const smallLead = /; leader (M\d+)$/m.exec(out)?.[1];
const db = svc();
const { data: ten } = await db.from("tenant").select("tenant_id").eq("name", NAME).single();
const unitName = async (key) => key ? (await db.from("org_unit").select("name").eq("tenant_id", ten.tenant_id).eq("unit_key", key).single()).data.name : undefined;
const bigTeam = await unitName(bigKey), smallTeam = await unitName(smallKey);
const { data: asm } = await db.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id;
const w = { lead: await signIn(`lead.${SLUG}@cdp-demo.example`), admin: await signIn(`admin.${SLUG}@cdp-demo.example`), exec: await signIn(`exec.${SLUG}@cdp-demo.example`),
  con: await signIn("consultant@cdp-demo.example"), other: await signIn("admin.fixture@cdp-demo.example") };
const call = async (who, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${w[who].t}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
// browser-style page reads with a cookie session
async function page(email, path) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((x) => jar.set(x.name, x.value)) } });
  await c.auth.signInWithPassword({ email, password: pwOf(email) });
  const r = await fetch(base + path, { redirect: "manual", headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } });
  return [r.status, await r.text()];
}
const users = (await db.auth.admin.listUsers({ perPage: 1000 })).data.users;
const leadId = users.find((u) => u.email === `lead.${SLUG}@cdp-demo.example`).id;
const roster = (await db.from("person_of_record").select("person_id, employee_ref, tenant_id").eq("tenant_id", ten.tenant_id)).data;
const personOf = (ref) => roster.find((r) => r.employee_ref === ref).person_id;
const { data: foreign } = await db.from("person_of_record").select("person_id").neq("tenant_id", ten.tenant_id).limit(1).single();
const mine = async () => (await db.rpc("rpc_users_list", { p_actor: users.find((u) => u.email === "issa@pac.africa").id })).data.find((u) => u.user_id === leadId);

// ---------------------------------------------------------------- linking
let [s, j] = await call("other", "PATCH", `/v1/users/${leadId}`, { person_id: personOf(smallLead) });
ok("another organisation's admin cannot link a login", s === 403 || s === 404, `${s}`);
[s] = await call("admin", "PATCH", `/v1/users/${leadId}`, { person_id: "per_not-valid!" });
ok("a malformed person id is refused", s === 422, `${s}`);
[s] = await call("admin", "PATCH", `/v1/users/${leadId}`, { person_id: foreign.person_id });
ok("a person from another organisation is refused", s === 422, `${s}`);
const execId = users.find((u) => u.email === `exec.${SLUG}@cdp-demo.example`).id;
[s] = await call("admin", "PATCH", `/v1/users/${execId}`, { person_id: personOf(smallLead) });
ok("only a People Leader login can be linked", s === 422, `${s}`);
const before = (await mine()).person_id;
ok("the seed linked the leader to a team leader", !!before, `${before}`);
[s] = await call("admin", "PATCH", `/v1/users/${leadId}`, { person_id: null });
ok("the client admin unlinks the login", s === 200 && !(await mine()).person_id, `${s}`);
let [st, html] = await page(`lead.${SLUG}@cdp-demo.example`, `/assessments/${A}/team`);
ok("an unlinked leader is told their login is not linked", st === 200 && html.includes("not linked to a person"), `${st}`);
[s] = await call("admin", "PATCH", `/v1/users/${leadId}`, { person_id: before });
ok("the client admin links it again", s === 200, `${s}`);
const { data: aud } = await db.from("audit_log").select("action").eq("tenant_id", ten.tenant_id).like("action", "user.%linked_person");
ok("linking and unlinking are audited", aud.length >= 2, `${aud.length}`);

// ---------------------------------------------------------------- the team page
[st, html] = await page(`lead.${SLUG}@cdp-demo.example`, `/assessments/${A}/team`);
ok(`the leader sees their team (${bigTeam}) with results`, st === 200 && html.includes(bigTeam) && html.includes("Against the whole organisation") && !html.includes("Too few people answered"), `${st}`);
ok("the page carries no other team's name", !(smallTeam && html.includes(smallTeam)), smallTeam);
[st] = await page(`exec.${SLUG}@cdp-demo.example`, `/assessments/${A}/team`);
ok("an executive cannot open the team view (404)", st === 404, `${st}`);
[st] = await page(`admin.${SLUG}@cdp-demo.example`, `/assessments/${A}/team`);
ok("a client admin cannot open the team view (404)", st === 404, `${st}`);
if (smallTeam && smallLead) {
  [s] = await call("admin", "PATCH", `/v1/users/${leadId}`, { person_id: personOf(smallLead) });
  [st, html] = await page(`lead.${SLUG}@cdp-demo.example`, `/assessments/${A}/team`);
  ok(`a team under the floor (${smallTeam}) is not reported`, st === 200 && html.includes("Too few people answered") && !html.includes("Against the whole organisation"), `${st}`);
  [s] = await call("admin", "PATCH", `/v1/users/${leadId}`, { person_id: before });
}
const actorLog = await db.from("segment_query_log").select("axis, outcome").eq("tenant_id", ten.tenant_id).eq("actor_id", leadId);
ok("every view is logged against the leader", (actorLog.data ?? []).length >= 2 && actorLog.data.every((r) => r.axis === "team"), JSON.stringify(actorLog.data));

// ---------------------------------------------------------------- own 360 result and development plan
const { data: la } = await db.from("leader_assignment").select("assignment_id").eq("person_id", before);
const myRes = await w.lead.c.from("leader_result").select("assignment_id").eq("assessment_id", A);
ok("the leader reads only their own 360 result", (myRes.data ?? []).length === 1 && myRes.data[0].assignment_id === la[0].assignment_id, JSON.stringify(myRes.data));
const allRes = (await db.from("leader_result").select("assignment_id").eq("assessment_id", A)).data;
ok("other leaders' results exist but are not visible to them", allRes.length > 1);
ok("an executive reads the same 360 results as before (all)", (await w.exec.c.from("leader_result").select("assignment_id").eq("assessment_id", A)).data.length === allRes.length);
[s] = await call("con", "POST", `/v1/assessments/${A}/development`, {});
let items = (await db.from("development_item").select("item_id").eq("assessment_id", A).eq("assignment_id", la[0].assignment_id)).data ?? [];
ok("a draft development plan is invisible to the leader", items.length > 0 && ((await w.lead.c.from("development_item").select("item_id").eq("assessment_id", A)).data ?? []).length === 0, `${items.length}`);
for (const it of items) await call("con", "PATCH", `/v1/development/${it.item_id}`, { start_stop_keep: "START", behaviour: "Asks every report for one idea each week", visible_change_30d: "Reports say their ideas are asked for" });
[s] = await call("con", "POST", `/v1/assessments/${A}/development`, { agree: la[0].assignment_id });
const seen = (await w.lead.c.from("development_item").select("assignment_id").eq("assessment_id", A)).data ?? [];
ok("once agreed, the leader sees their own development plan only", s === 200 && seen.length === items.length && seen.every((r) => r.assignment_id === la[0].assignment_id), `${s} ${seen.length}/${items.length}`);
[st, html] = await page(`lead.${SLUG}@cdp-demo.example`, `/assessments/${A}/team`);
ok("the page shows their feedback and plan", html.includes("Your leadership feedback") && html.includes("Development plan"), `${st}`);

// ---------------------------------------------------------------- nothing else opens
const cap = await w.lead.c.schema("capture").from("response").select("*").limit(1);
ok("the leader cannot read individual responses", !!cap.error || (cap.data ?? []).length === 0);
const frozen = await w.lead.c.rpc("rpc_frozen_response_set", { p_assessment_id: A });
ok("the leader cannot call the frozen response set", !!frozen.error);
[s] = await call("lead", "GET", `/v1/assessments/${A}/segments?axis=team`);
ok("the segments API stays closed to them", s === 403, `${s}`);
[st] = await page(`lead.${SLUG}@cdp-demo.example`, `/assessments/${A}/segments`);
ok("and so does the segments page (404)", st === 404, `${st}`);
const nom = await w.lead.c.from("rater_nomination").select("*").limit(1);
ok("the leader sees no rater nominations", (nom.data ?? []).length === 0);
done();
