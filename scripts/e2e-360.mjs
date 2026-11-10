// Leadership 360 end to end on an open test client (seed-rich-demo.mjs ... "Pelquor Freight (360 test)" open):
// nominations (who may, validation), link issue, form status and submit through /v1/l360 (validation, single use, unlinking),
// no raw table access, then freeze, score (leader results stored), and the release rule for client roles.
//   node --env-file=apps/web/.env.local scripts/e2e-360.mjs <project-ref> <token-file> [base-url] [tenant-name]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, passwords } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100", NAME = "Pelquor Freight (360 test)"] = process.argv.slice(2);
const pat = readFileSync(tokenFile, "utf8").replace(/[\r\n]/g, "");
const sql = async (q) => (await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST", headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) })).json();
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pw = passwords();
const login = async (e) => {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: e, password: pw[e] });
  if (error) throw new Error(e + ": " + error.message);
  return { c, t: data.session.access_token };
};

const { data: ten } = await svc.from("tenant").select("tenant_id").eq("name", NAME).single();
const { data: asm } = await svc.from("assessment").select("assessment_id, engagement_id").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id;
const con = await login("consultant@cdp-demo.example");
const other = await login("admin.meridian@cdp-demo.example");            // a Client Admin of another tenant
const call = async (who, method, path, body, extra = {}) => {
  const r = await fetch(base + path, { method, headers: { ...(who ? { authorization: `Bearer ${who.t}` } : {}), "content-type": "application/json", ...extra }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};

// ---------------------------------------------------------------- nominations
const { data: snap } = await svc.from("org_graph_snapshot").select("scope_json").eq("engagement_id", asm.engagement_id).single();
const L = snap.scope_json[0].assignment_id;
const { data: la } = await svc.from("leader_assignment").select("person_id").eq("assignment_id", L).single();
const { data: noms } = await svc.from("rater_nomination").select("rater_person_id, rater_group").eq("assessment_id", A).eq("assignment_id", L);
let [s, j] = await call(other, "PUT", `/v1/assessments/${A}/l360/nominations`, { assignment_id: L, raters: [] });
ok("another tenant's admin cannot nominate", s === 403, `${s}`);
[s, j] = await call(con, "PUT", `/v1/assessments/${A}/l360/nominations`, { assignment_id: L, raters: [{ person_id: la.person_id, rater_group: "PEER" }] });
ok("a leader cannot be their own rater", s === 422, `${s} ${j?.code}`);
[s, j] = await call(con, "PUT", `/v1/assessments/${A}/l360/nominations`, { assignment_id: L, raters: [{ person_id: "per_x", rater_group: "BOSS" }] });
ok("unknown relationship refused", s === 422, `${s}`);
[s, j] = await call(con, "PUT", `/v1/assessments/${A}/l360/nominations`, { assignment_id: L, raters: [noms[0], noms[0]].map((n) => ({ person_id: n.rater_person_id, rater_group: n.rater_group })) });
ok("the same rater twice is refused", s === 422, `${s}`);
// the seed may give this leader fewer than the 3 peers the nomination rule needs: top up with other people of the organisation
const taken = new Set([la.person_id, ...noms.map((n) => n.rater_person_id)]);
const { data: pool } = await svc.from("person_of_record").select("person_id").eq("tenant_id", ten.tenant_id).order("employee_ref").limit(200);
const extra = (pool ?? []).map((p) => p.person_id).filter((p) => !taken.has(p)).slice(0, Math.max(0, 3 - noms.filter((n) => n.rater_group === "PEER").length));
noms.push(...extra.map((p) => ({ rater_person_id: p, rater_group: "PEER" })));
[s, j] = await call(con, "PUT", `/v1/assessments/${A}/l360/nominations`, { assignment_id: L, raters: noms.map((n) => ({ person_id: n.rater_person_id, rater_group: n.rater_group })) });
ok("consultant replaces nominations", s === 200 && j.nominated === noms.length, `${s} ${JSON.stringify(j)}`);

// ---------------------------------------------------------------- automatic rater selection (owner ruling 22 Oct 2026, Erick Ngala comment 18)
{
  const asg = (await svc.from("leader_assignment").select("assignment_id, person_id, team_id").eq("tenant_id", ten.tenant_id)).data ?? [];
  const inScope = snap.scope_json.map((x) => x.assignment_id);
  const leadersP = new Set(asg.map((x) => x.person_id));
  [s, j] = await call(other, "POST", `/v1/assessments/${A}/l360/assign`, {});
  ok("raters: another tenant's admin cannot run the automatic choice (403)", s === 403, `${s}`);
  // some leaders may already have a supervisor from the seed. Those without one are named, and the route must refuse until they have one.
  const haveSup = new Set(((await svc.from("rater_nomination").select("assignment_id").eq("assessment_id", A).eq("rater_group", "SUPERIOR")).data ?? []).map((n) => n.assignment_id));
  const lacking = inScope.filter((l) => !haveSup.has(l));
  [s, j] = await call(con, "POST", `/v1/assessments/${A}/l360/assign`, {});
  if (lacking.length) ok("raters: refused until every leader has a supervisor (422, the leaders without one are listed)", s === 422 && Array.isArray(j?.missing_supervisor) && j.missing_supervisor.length === lacking.length && lacking.every((l) => j.missing_supervisor.includes(l)), `${s} ${JSON.stringify(j)?.slice(0, 200)}`);
  // the Client Admin picks a supervisor for each of them through the nominations route (which also asks for three peers)
  const everyone = (await svc.from("person_of_record").select("person_id").eq("tenant_id", ten.tenant_id).order("employee_ref").limit(40)).data.map((x) => x.person_id);
  for (const l of lacking) {
    const me = asg.find((y) => y.assignment_id === l).person_id, pool2 = everyone.filter((x) => x !== me);
    [s, j] = await call(con, "PUT", `/v1/assessments/${A}/l360/nominations`, { assignment_id: l, raters: [{ person_id: pool2[0], rater_group: "SUPERIOR" }, ...pool2.slice(1, 4).map((x) => ({ person_id: x, rater_group: "PEER" }))] });
    if (s !== 200) { ok("raters: a supervisor can be recorded", false, `${s} ${j?.title}`); break; }
  }
  [s, j] = await call(con, "POST", `/v1/assessments/${A}/l360/assign`, {});
  ok("raters: the system chooses peers and direct reports for every leader (201)", s === 201 && j.assigned === inScope.length, `${s} ${JSON.stringify(j)?.slice(0, 200)}`);
  const after = (await svc.from("rater_nomination").select("assignment_id, rater_person_id, rater_group").eq("assessment_id", A)).data ?? [];
  const byL = (g, l) => after.filter((n) => n.assignment_id === l && n.rater_group === g);
  ok("raters: every leader keeps the supervisor the Client Admin picked, exactly one", inScope.every((l) => byL("SUPERIOR", l).length === 1), JSON.stringify(inScope.map((l) => byL("SUPERIOR", l).length)));
  ok("raters: nobody is their own rater", inScope.every((l) => !after.some((n) => n.assignment_id === l && asg.find((y) => y.assignment_id === l)?.person_id === n.rater_person_id)), "self rater");
  const peerLoad = new Map(); for (const n of after.filter((x) => x.rater_group === "PEER")) peerLoad.set(n.rater_person_id, (peerLoad.get(n.rater_person_id) ?? 0) + 1);
  ok("raters: nobody is a peer for more than 3 leaders", [...peerLoad.values()].every((n) => n <= 3), JSON.stringify([...peerLoad.values()]));
  ok("raters: peers are other leaders, 3 each where there are enough", inScope.every((l) => byL("PEER", l).length <= 3 && byL("PEER", l).every((n) => leadersP.has(n.rater_person_id))), JSON.stringify(inScope.map((l) => byL("PEER", l).length)));
  const teamOf = new Map(asg.map((x) => [x.assignment_id, x.team_id]));
  const members = (await svc.from("person_of_record").select("person_id, unit_id").eq("tenant_id", ten.tenant_id)).data ?? [];
  ok("raters: direct reports come from the leader's own team only, at most 8", inScope.every((l) => byL("DIRECT_REPORT", l).length <= 8 && byL("DIRECT_REPORT", l).every((n) => members.find((m) => m.person_id === n.rater_person_id)?.unit_id === teamOf.get(l))), JSON.stringify(inScope.map((l) => byL("DIRECT_REPORT", l).length)));
  const snapshot = JSON.stringify(after.map((n) => [n.assignment_id, n.rater_person_id, n.rater_group]).sort());
  [s, j] = await call(con, "POST", `/v1/assessments/${A}/l360/assign`, {});
  const again = (await svc.from("rater_nomination").select("assignment_id, rater_person_id, rater_group").eq("assessment_id", A)).data ?? [];
  ok("raters: choosing again gives exactly the same raters (seeded)", s === 201 && JSON.stringify(again.map((n) => [n.assignment_id, n.rater_person_id, n.rater_group]).sort()) === snapshot, `${s}`);
}

// ---------------------------------------------------------------- links
[s, j] = await call(other, "POST", `/v1/assessments/${A}/l360/invitations`, {});
ok("another tenant cannot issue links", s === 403, `${s}`);
[s, j] = await call(con, "POST", `/v1/assessments/${A}/l360/invitations`, {});
const links = j?.links ?? [];
const { count: nomCount } = await svc.from("rater_nomination").select("*", { count: "exact", head: true }).eq("assessment_id", A);
ok("consultant issues one self link per leader and one per nominated rater", s === 201 && links.filter((l) => l.kind === "SELF").length === 10 && links.length === 10 + nomCount, `${s} ${links.length} vs ${10 + nomCount}`);
[s, j] = await call(con, "POST", `/v1/assessments/${A}/l360/invitations`, {});
ok("issuing again makes no duplicates", s === 200 && j.issued === 0, `${s} ${j?.issued}`);
const hashes = await sql(`select count(*)::int as n from capture.invitation_360 where assessment_id = '${A}' and person_id is not null`);
ok("every link is tied to its person until submission", hashes[0]?.n === links.length, JSON.stringify(hashes));

// ---------------------------------------------------------------- forms
const self = links.find((l) => l.kind === "SELF");
const rater = links.find((l) => l.kind === "RATER");
const H = (t) => ({ "x-survey-token": t });
[s, j] = await call(null, "GET", "/v1/l360", null, H(self.token));
ok("self link opens as SELF with the leader named", s === 200 && j.kind === "SELF" && typeof j.leader === "string", `${s} ${JSON.stringify(j)}`);
[s, j] = await call(null, "GET", "/v1/l360", null, H("0".repeat(32)));
ok("unknown token -> neutral 410", s === 410 && j.code === "TOKEN_INVALID", `${s}`);
const full = Array(60).fill(4);
[s, j] = await call(null, "PUT", "/v1/l360", { ratings: [...full.slice(0, 59), null] }, H(self.token));
ok("self form with a gap refused (422)", s === 422, `${s} ${j?.code}`);
[s, j] = await call(null, "PUT", "/v1/l360", { ratings: [...full.slice(0, 59), 0] }, H(self.token));
ok("self form with Not observed refused (422)", s === 422, `${s} ${j?.code}`);
[s, j] = await call(null, "PUT", "/v1/l360", { ratings: [...full.slice(0, 59), null] }, H(rater.token));
ok("rater form with a blank (null) refused (422), Not observed must be sent as 0", s === 422, `${s} ${j?.code}`);
[s, j] = await call(null, "PUT", "/v1/l360", { ratings: full.slice(0, 59) }, H(rater.token));
ok("rater form with a missing statement refused (422)", s === 422, `${s} ${j?.code}`);
[s, j] = await call(null, "PUT", "/v1/l360", { ratings: [...full.slice(0, 59), 6] }, H(rater.token));
ok("rating 6 refused (422)", s === 422, `${s} ${j?.code}`);
[s, j] = await call(null, "PUT", "/v1/l360", { ratings: full.slice(0, 50) }, H(rater.token));
ok("short form refused (422)", s === 422, `${s}`);
[s, j] = await call(null, "PUT", "/v1/l360", { ratings: [...full.slice(0, 55), 0, 0, 0, 0, 0], meta: { known_for: "FOREVER", contact: "DAILY" } }, H(rater.token));
ok("rater context outside the bands refused (422), link still open", s === 422, `${s} ${j?.code}`);
[s, j] = await call(null, "PUT", "/v1/l360", { ratings: [...full.slice(0, 55), 0, 0, 0, 0, 0], meta: { known_for: "Y1_3", contact: "WEEKLY" }, text: { "S-Q1": "A self question on a rater form." } }, H(rater.token));
ok("a self question code on a rater form is refused (422), link still open", s === 422, `${s} ${j?.code}`);
const COMMENT = "Listens well but often decides before the meeting ends.";
[s, j] = await call(null, "PUT", "/v1/l360", { ratings: [...full.slice(0, 55), 0, 0, 0, 0, 0], meta: { known_for: "Y1_3", contact: "WEEKLY" }, text: { "R-Q1": COMMENT, "R-Q2": "  " } }, H(rater.token));
ok("rater form with not observed, rater context and an open answer accepted", s === 200, `${s} ${j?.code} ${j?.title}`);
const txt = await sql(`select count(*)::int as n, bool_and(position(convert_to('often decides', 'UTF8') in ciphertext) = 0) as sealed from capture.response_360_text t join capture.response_360 r using (response_id) where r.assessment_id = '${A}'`);
ok("the open answer is stored encrypted, the blank one not at all", txt[0]?.n === 1 && txt[0]?.sealed === true, JSON.stringify(txt));
const metaRow = await sql(`select count(*)::int as n from capture.response_360 where assessment_id = '${A}' and known_for = 'Y1_3' and contact = 'WEEKLY'`);
ok("rater context stored as bands", metaRow[0]?.n === 1, JSON.stringify(metaRow));
const early = await svc.rpc("rpc_rater_meta_360", { p_assessment_id: A });
ok("rater context counts refused before freeze", !!early.error, JSON.stringify(early.data));
[s, j] = await call(null, "PUT", "/v1/l360", { ratings: full }, H(rater.token));
ok("used rater link -> 410", s === 410, `${s}`);
const unl = await sql(`select count(*)::int as n from capture.invitation_360 where assessment_id = '${A}' and submitted_at is not null and person_id is not null`);
ok("submitted links keep no person", unl[0]?.n === 0, JSON.stringify(unl));
const cols = await sql(`select string_agg(column_name, ',') as c from information_schema.columns where table_schema = 'capture' and table_name in ('response_360', 'response_360_item')`);
ok("360 answers have no person or token column", !/person|token|invitation/.test(cols[0]?.c ?? "x"), cols[0]?.c);
for (const [name, who] of [["consultant", con], ["other admin", other]]) {
  const r = await who.c.schema("capture").from("response_360").select("*").limit(1);
  ok(`${name} cannot read 360 answers directly`, !!r.error || (r.data ?? []).length === 0, JSON.stringify(r.data));
  const f = await who.c.rpc("rpc_frozen_360_set", { p_assessment_id: A });
  ok(`${name} cannot call the frozen 360 set`, !!f.error, "returned data");
}

// ---------------------------------------------------------------- answer the rest, freeze, score
for (const l of links) {
  if (l === rater) continue;
  const [st] = await call(null, "PUT", "/v1/l360", { ratings: Array.from({ length: 60 }, (_, i) => 2 + ((i * 7 + l.token.charCodeAt(0)) % 4)) }, H(l.token));
  if (st !== 200) { ok("all remaining forms submit", false, `${st}`); break; }
}
await svc.from("assessment").update({ status: "FROZEN", frozen_at: new Date().toISOString() }).eq("assessment_id", A);     // test shortcut, as the seeds do
await svc.from("engagement").update({ state: "SCORING" }).eq("engagement_id", asm.engagement_id);
// rater comments: reviewed by the consultant after freeze, with nothing that points to the rater (N4.7-COMMENTS)
// links carry no leader id, so the leader is read from the stored rater response (the one with the Y1_3 band)
const LC = (await sql(`select assignment_id from capture.response_360 where assessment_id = '${A}' and known_for = 'Y1_3'`))[0]?.assignment_id;
ok("the leader of the commented rater response is found", /^lea_/.test(LC ?? ""), String(LC));
[s, j] = await call(other, "GET", `/v1/assessments/${A}/comments?assignment=${LC}`);
ok("another tenant cannot read the comments (403)", s === 403, `${s}`);
[s, j] = await call(con, "GET", `/v1/assessments/${A}/comments?assignment=${LC}`);
const cm = j?.comments?.[0];
ok("the consultant reads the comment with its question code only", s === 200 && j.comments.length === 1 && cm.body === COMMENT && cm.question_code === "R-Q1" && Object.keys(cm).sort().join() === "body,comment_id,question_code,redacted,reviewed", `${s} ${JSON.stringify(j)}`);
[s] = await call(con, "POST", `/v1/assessments/${A}/comments`, { comment_id: cm?.comment_id, redacted: "   " });
ok("an empty redaction is refused (422)", s === 422, `${s}`);
[s] = await call(con, "POST", `/v1/assessments/${A}/comments`, { comment_id: cm?.comment_id, redacted: "Listens well but often decides early." });
ok("the consultant redacts it", s === 200, `${s}`);
[s, j] = await call(con, "GET", `/v1/assessments/${A}/comments?assignment=${LC}`);
ok("the redacted copy is kept beside the original, marked reviewed", j?.comments?.[0]?.redacted === "Listens well but often decides early." && j.comments[0].body === COMMENT && j.comments[0].reviewed === true, JSON.stringify(j));
[s, j] = await call(null, "GET", "/v1/l360", null, H(self.token));
ok("links stop working after freeze", s === 410, `${s}`);
const late = await svc.rpc("rpc_rater_meta_360", { p_assessment_id: A });
const lm = (late.data ?? []).find((m) => m.assignment_id === LC);
ok("after freeze, rater context counts per leader, only at three or more raters", !late.error && (late.data ?? []).every((m) => m.raters >= 3) && (!lm || lm.known_for.Y1_3 === 1), JSON.stringify(late.error ?? lm));
[s, j] = await call(con, "POST", `/v1/assessments/${A}/score`, {});
ok("score created", s === 201 || s === 200, `${s} ${j?.code} ${j?.title}`);
const version = j?.version;
const { data: lr } = await svc.from("leader_result").select("payload_json").eq("assessment_id", A).eq("score_version", version);
ok("a stored result for each of 10 leaders", lr?.length === 10, `${lr?.length}`);
ok("every leader with a self form and 3+ raters is valid", lr?.every((r) => r.payload_json.valid), JSON.stringify(lr?.map((r) => r.payload_json.rater_count)));
[s, j] = await call(con, "POST", `/v1/assessments/${A}/score`, {});
ok("re-score is idempotent", (s === 200) && j.created === false, `${s}`);
const { count } = await svc.from("leader_result").select("*", { count: "exact", head: true }).eq("assessment_id", A);
ok("no duplicate leader results", count === 10, `${count}`);
const upd = await svc.from("leader_result").update({ payload_json: {} }).eq("assessment_id", A);
ok("leader results are immutable", !!upd.error, "updated");
const seen = await other.c.from("leader_result").select("assignment_id").eq("assessment_id", A);
ok("another tenant's admin sees no leader results", (seen.data ?? []).length === 0);
const conSeen = await con.c.from("leader_result").select("assignment_id").eq("assessment_id", A);
ok("the assigned consultant sees them", (conSeen.data ?? []).length === 10, `${conSeen.data?.length}`);

// ---------------------------------------------------------------- development plans
[s, j] = await call(other, "POST", `/v1/assessments/${A}/development`, {});
ok("another tenant cannot draft development plans", s === 403, `${s}`);
[s, j] = await call(con, "POST", `/v1/assessments/${A}/development`, {});
ok("consultant drafts development plans", s === 201 && j.drafted > 0, `${s} ${j?.code} ${j?.title} ${JSON.stringify(j)}`);
const drafted = j?.drafted;
[s, j] = await call(con, "POST", `/v1/assessments/${A}/development`, {});
ok("drafting again adds nothing", (s === 200 || s === 201) && j.drafted === 0, `${s} ${JSON.stringify(j)}`);
const { data: items } = await svc.from("development_item").select("*").eq("assessment_id", A).eq("score_version", version).order("assignment_id").order("seq");
ok("one to three items per leader, each with a basis", items.length === drafted && items.every((i) => ["GROWTH", "TARGET", "BLIND_SPOT"].includes(i.basis) && i.seq <= 3));
// the leader with the most items, so agreeing covers a multi-item plan
const L1 = [...new Set(items.map((i) => i.assignment_id))].sort((x, y) => items.filter((i) => i.assignment_id === y).length - items.filter((i) => i.assignment_id === x).length)[0];
const mine = items.filter((i) => i.assignment_id === L1);
// How many items a leader gets depends on the scores (growth, target, blind spot), and the system now chooses the raters at random, so this is not fixed any more: the agree flow below is exercised whatever the count (owner ruling 22 Oct 2026 changed the raters).
ok("the plan under test has at least one item", mine.length >= 1, `${mine.length}`);
[s] = await call(con, "PATCH", `/v1/development/${mine[0].item_id}`, { start_stop_keep: "MAYBE" });
ok("an unknown start/stop/keep is refused", s === 422, `${s}`);
[s] = await call(other, "PATCH", `/v1/development/${mine[0].item_id}`, { behaviour: "Holds weekly one to ones" });
ok("another tenant cannot edit a development item", s === 403, `${s}`);
[s, j] = await call(con, "POST", `/v1/assessments/${A}/development`, { agree: L1 });
ok("agreeing an incomplete plan is refused", s === 422, `${s} ${j?.code}`);
for (const it of mine) {
  [s] = await call(con, "PATCH", `/v1/development/${it.item_id}`, { start_stop_keep: "START", behaviour: "Asks each direct report for one idea in every weekly meeting", visible_change_30d: "Team members say their ideas are asked for" });
  if (s !== 200) { ok("consultant completes every item", false, `${s}`); break; }
}
[s, j] = await call(con, "POST", `/v1/assessments/${A}/development`, { agree: L1 });
ok("consultant agrees the completed plan", s === 200 && j.agreed === mine.length, `${s} ${JSON.stringify(j)}`);
[s, j] = await call(con, "PATCH", `/v1/development/${mine[0].item_id}`, { behaviour: "Something else entirely" });
ok("an agreed plan does not change", s === 409, `${s} ${j?.code}`);
const devOther = await other.c.from("development_item").select("item_id").eq("assessment_id", A);
ok("another tenant's admin reads no development items", (devOther.data ?? []).length === 0);


// ---------------------------------------------------------------- Journey 3: leader link (S6), void after data freeze (S5), group profiles (S2)
const { data: ll } = await svc.from("leader_link_result").select("assignment_id, payload_json").eq("assessment_id", A).eq("score_version", version);
ok("S6: a stored leader link for each of the 10 valid leaders", ll?.length === 10, `${ll?.length}`);
const CLASSES = ["Critical Blocker", "Culture Blocker", "Culture Carrier", "Emerging Carrier", "Neutral", "CRITICAL_BLOCKER", "CULTURE_BLOCKER", "CULTURE_CARRIER", "EMERGING_CARRIER", "NEUTRAL"];
ok("S6: each link carries fit, band, class, team basis and quadrant", ll?.every((r) => r.payload_json.fit_index !== undefined && r.payload_json.fit_band && CLASSES.includes(r.payload_json.classification) && "team_basis" in r.payload_json && "contribution_quadrant" in r.payload_json), JSON.stringify(ll?.[0]?.payload_json).slice(0, 300));
const { count: lcount } = await svc.from("leader_link_result").select("*", { count: "exact", head: true }).eq("assessment_id", A);
ok("S6: re-scoring adds no duplicate links", lcount === 10, `${lcount}`);
const lupd = await svc.from("leader_link_result").update({ payload_json: {} }).eq("assessment_id", A);
ok("S6: leader links are immutable", !!lupd.error, "updated");
const lother = await other.c.from("leader_link_result").select("assignment_id").eq("assessment_id", A);
ok("S6: another tenant's admin sees no leader links", (lother.data ?? []).length === 0);
const lcon = await con.c.from("leader_link_result").select("assignment_id").eq("assessment_id", A);
ok("S6: the assigned consultant sees all 10", (lcon.data ?? []).length === 10, `${lcon.data?.length}`);

// No voiding (owner ruling 22 Oct 2026): a response cannot be voided after the data freeze either, and re-scoring does not change the version
const hashBefore = (await svc.from("assessment").select("response_set_hash").eq("assessment_id", A).single()).data.response_set_hash;
const victim = (await sql(`select response_id from capture.response where assessment_id = '${A}' and voided_reason is null order by response_id limit 1`))[0]?.response_id;
ok("a response exists to try", /^rsp_/.test(victim ?? ""), String(victim));
[s, j] = await call(con, "POST", `/v1/assessments/${A}/quality`, { response_id: victim, reason: "Duplicate entry confirmed with the respondent" });
ok("voiding is refused for the consultant too (405)", s === 405, `${s}`);
const vf = await svc.rpc("rpc_void_response", { p_assessment_id: A, p_response_id: victim, p_reason: "try", p_actor: "00000000-0000-0000-0000-000000000000" });
ok("the void function does not exist", !!vf.error, JSON.stringify(vf.data));
const man = (await svc.from("assessment").select("freeze_manifest, response_set_hash").eq("assessment_id", A).single()).data;
ok("the response set hash and the manifest are unchanged", man.response_set_hash === hashBefore && !("voids_after_freeze" in (man.freeze_manifest ?? {})), "changed");
[s, j] = await call(con, "POST", `/v1/assessments/${A}/score`, {});
ok("scoring again is idempotent (same version)", s === 200 && j.created === false && j.version === version, `${s} ${j?.version} was ${version}`);
const v2 = version;

// S2 and the freeze: group profiles are stored once, at score freeze, and a frozen score refuses a void
const none = await svc.from("segment_profile").select("segment_key", { count: "exact", head: true }).eq("assessment_id", A);
ok("S2: no group profiles before the score is frozen", none.count === 0, `${none.count}`);
[s, j] = await call(con, "POST", `/v1/assessments/${A}/score/freeze`, {});
ok("score freeze succeeds", s === 200 && j.changed === true && j.version === v2, `${s} ${j?.code} ${j?.title}`);
const { data: sp } = await svc.from("segment_profile").select("segment_key, axis, n, payload_hash, score_version").eq("assessment_id", A);
const frozenHash = (await svc.from("score_object").select("payload_hash").eq("assessment_id", A).eq("version", v2).single()).data.payload_hash;
ok("S2: group profiles are stored for the frozen version", sp?.length > 0 && sp.every((r) => r.score_version === v2), `${sp?.length}`);
ok("S2: every stored group meets the floor and carries the score hash", sp?.every((r) => r.n >= 5 && r.payload_hash === frozenHash), JSON.stringify(sp?.filter((r) => r.n < 5 || r.payload_hash !== frozenHash).slice(0, 3)));
ok("S2: stored groups come from the standard cuts", sp?.every((r) => ["division", "department", "team", "location", "country", "grade", "executive", "tenure_band"].includes(r.axis)), JSON.stringify([...new Set(sp?.map((r) => r.axis))]));
const spu = await svc.from("segment_profile").update({ n: 99 }).eq("assessment_id", A);
ok("S2: stored profiles are immutable", !!spu.error, "updated");
const spOther = await other.c.from("segment_profile").select("segment_key").eq("assessment_id", A);
ok("S2: another tenant's admin reads no profiles", (spOther.data ?? []).length === 0);
[s, j] = await call(con, "POST", `/v1/assessments/${A}/score/freeze`, {});
ok("freezing again changes nothing", s === 200 && j.changed === false, `${s} ${JSON.stringify(j)}`);

// S8: this client was frozen by the test shortcut, which writes no freeze manifest, so the technical appendix is incomplete and release is refused with the parts named
[s, j] = await call(con, "POST", `/v1/assessments/${A}/evaluate`, {});
ok("findings run on the frozen score", s === 201 || s === 200, `${s} ${j?.code} ${j?.title}`);
let rep;
[s, rep] = await call(con, "POST", `/v1/assessments/${A}/reports`, { type: "ORGANISATIONAL" });
ok("a report is created", s === 201 || s === 200, `${s} ${rep?.code}`);
const sysText = (await svc.from("report").select("sections_json, accepted_json").eq("report_id", rep?.report_id).single()).data;
ok("the system sysText both mandatory sections and stamped them accepted", !!sysText.sections_json.what_this_means && !!sysText.sections_json.what_to_do_next && !!sysText.accepted_json.what_this_means && !!sysText.accepted_json.what_to_do_next, JSON.stringify(sysText).slice(0, 200));
[s] = await call(con, "PUT", `/v1/reports/${rep?.report_id}/sections`, { sections: { what_this_means: "x" } });
ok("the consultant cannot edit the text (405)", s === 405, `${s}`);
[s, j] = await call(con, "POST", `/v1/reports/${rep?.report_id}/release`, {});
const why = JSON.stringify(j?.reasons ?? []);
ok("S8: release refused (422 RELEASE_INCOMPLETE) with the missing appendix parts named", s === 422 && j?.code === "RELEASE_INCOMPLETE" && /technical appendix missing: /.test(why) && /Response rate table/.test(why) && /Exclusions/.test(why) && /Window extensions/.test(why), `${s} ${why}`);
ok("S8: parts that exist are not reported missing (suppression, substitutions)", !/Suppression notes/.test(why) && !/Substitutions/.test(why), why);
const stillDraft = (await svc.from("report").select("status").eq("report_id", rep?.report_id).single()).data;
ok("S8: the refused report is still a draft", stillDraft?.status !== "RELEASED", JSON.stringify(stillDraft));
// give it the manifest the freeze route would have written, and the release goes through
const m = { invited: 20, started: 20, submitted: 20, abandoned: 0, voided: 1, auto_submitted: 0, counts_by_state: { COMPLETE: 19 }, extensions: [], response_set_hash: "sha256:test" };
await svc.from("assessment").update({ freeze_manifest: m }).eq("assessment_id", A);
[s, j] = await call(con, "POST", `/v1/reports/${rep?.report_id}/release`, {});
ok("S8: with the appendix parts present, release succeeds", s === 200 && j?.status === "RELEASED", `${s} ${JSON.stringify(j)}`);

done();
