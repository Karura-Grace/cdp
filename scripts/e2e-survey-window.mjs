// Journey 2, slices S3 and S5: reminders on a simulated clock (AC-2.5), window extensions (S2.6.2-005 to 007), the window pinned
// against plain updates, and the quality monitor (S2-16); voiding was removed on 22 Oct 2026.
//   node --env-file=apps/web/.env.local scripts/e2e-survey-window.mjs <project-ref> <token-file> [base-url]
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, pwOf } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-demo.mjs", ref, tokenFile, "live", "1", base, "600"], { encoding: "utf8" });
const fx = JSON.parse(readFileSync("packages/cdp-engine/oracle/cases/fixture.json"));
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: ten } = await svc.from("tenant").select("tenant_id").like("name", "Live Demo Co%").order("created_at", { ascending: false }).limit(1).single();
const { data: asm } = await svc.from("assessment").select("assessment_id, window_close").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id;

async function session(em) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email: em, password: pwOf(em) });
  if (error) throw new Error(em + ": " + error.message);
  return async (method, path, body) => { const r = await fetch(base + path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "x-cdp-csrf": "1", "content-type": "application/json" } }); return [r.status, await r.json().catch(() => null)]; };
}
const con = await session("consultant@cdp-demo.example"), sup = await session("superadmin@cdp-demo.example");

// named links for the roster (reminders need a person to remind)
let [s, j] = await con("POST", `/v1/assessments/${A}/invitations`, { mode: "roster" });
const toks = (j?.links ?? []).map((l) => l.token);
ok("named links issued for the roster", s === 201 && toks.length >= 4, `${s} ${toks.length}`);
{ const k = (await (await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${readFileSync(tokenFile, "utf8").trim()}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: `select count(*)::int n, count(*) filter (where demographic_snapshot_json ?& array['department','team','division','location','grade','tenure_band','is_executive'])::int full from capture.invitation where assessment_id = '${A}' and submitted_at is null and person_id is not null` }) })).json())[0];
  ok("every named link carries all seven cuts (Journey 3 S1)", Number(k?.n) > 0 && k.n === k.full, JSON.stringify(k)); }
for (const t of toks.slice(0, 3)) await svc.rpc("rpc_record_consent", { p_token: t, p_decision: "AGREE" });
const r0 = fx.input.responses[0];
const sub = await svc.rpc("rpc_submit_response", { p_token: toks[0], p_payload: { alloc: r0.alloc, likert: r0.likert, eos: r0.eos }, p_duration: r0.duration });
ok("one person submits", !sub.error, sub.error?.message);
await fetch(`${base}/v1/survey/draft`, { method: "PUT", headers: { "content-type": "application/json", "x-survey-token": toks[1] }, body: JSON.stringify({ step: 2, alloc: {}, likert: {}, eos: [] }) });

// reminders
const cron = (q = "", secret = process.env.CRON_SECRET) => fetch(`${base}/v1/jobs/reminders${q}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {} });
ok("the reminder job refuses without the cron secret (401)", (await cron("", "")).status === 401 && (await cron("", "wrong")).status === 401);
const closeDay = asm.window_close.slice(0, 10);
const run = async (day) => ((await (await cron(`?today=${day}`)).json()).ran ?? []).filter((x) => x.assessment_id === A);
const first = await run(closeDay);
const by = Object.fromEntries(first.map((x) => [x.kind, x.claimed]));
const n = toks.length;
ok("every reminder due by the last day goes to everyone who has not submitted", ["Working day 3", "Working day 6", "24 hours before close"].every((k) => by[k] === n - 1), JSON.stringify(by));
ok("the final reminder goes only to the person who started and did not submit", by["Final reminder"] === 1, JSON.stringify(by));
const again = await run(closeDay);
ok("a second run on the same day sends nothing (claimed once)", again.every((x) => x.claimed === 0), JSON.stringify(again));
const { data: aud } = await svc.from("audit_log").select("action").eq("object_id", A).like("action", "reminders.sent:%");
ok("each reminder batch is audited with counts only", (aud ?? []).length === 4, JSON.stringify(aud));

// window extensions
const pinned = await svc.from("assessment").update({ window_close: new Date(Date.now() + 9 * 864e5).toISOString() }).eq("assessment_id", A);
ok("a plain update of the close date is refused (ASSESSMENT_PINNED)", !!pinned.error && pinned.error.message.includes("ASSESSMENT_PINNED"), pinned.error?.message);
[s, j] = await con("POST", `/v1/assessments/${A}/extend`, { working_days: 366, reason: "Too long" });
ok("an extension over 365 working days is refused as a sanity bound (422)", s === 422, s);
[s, j] = await con("POST", `/v1/assessments/${A}/extend`, { working_days: 3, reason: "Low response in two units" });
ok("the consultant extends once by 3 working days (201)", s === 201 && j.extension === 1 && j.window_close > asm.window_close, `${s} ${JSON.stringify(j)}`);
const exp = (await (await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${readFileSync(tokenFile, "utf8").trim()}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: `select count(*) filter (where expires_at = '${j?.window_close}'::timestamptz) moved, count(*) filter (where submitted_at is null) open from capture.invitation where assessment_id = '${A}'` }) })).json())[0];
ok("every open link follows the new close date", Number(exp?.moved) === Number(exp?.open) && Number(exp?.open) > 0, JSON.stringify(exp));
[s, j] = await con("POST", `/v1/assessments/${A}/extend`, { working_days: 30, reason: "Lockdown: the offices are closed" });
ok("the consultant extends again by 30 working days (201): no cap on how often or how long", s === 201 && j.extension === 2, `${s} ${JSON.stringify(j)}`);
[s, j] = await sup("POST", `/v1/assessments/${A}/extend`, { working_days: 2, reason: "Super Admin extension" });
ok("a Super Admin may extend too", s === 201 && j.extension === 3, `${s} ${JSON.stringify(j)}`);
[s] = await con("POST", `/v1/assessments/${A}/extend`, { working_days: 1, reason: "x" });
ok("a reason of under 3 characters is still refused (422)", s === 422, s);
const { data: ext } = await svc.from("window_extension").select("seq, approved_by, reason").eq("assessment_id", A).order("seq");
ok("all three extensions are recorded in order with their reasons", ext?.length === 3 && ext.map((x) => x.seq).join() === "1,2,3", JSON.stringify(ext));
const del = await svc.from("window_extension").delete().eq("assessment_id", A);
ok("the extension record cannot be deleted", !!del.error || (await svc.from("window_extension").select("seq").eq("assessment_id", A)).data.length === 3);

// quality monitor and void
for (const [i, t] of toks.slice(1, 3).entries()) {
  const r = fx.input.responses[i + 1];
  await svc.rpc("rpc_submit_response", { p_token: t, p_payload: { alloc: r.alloc, likert: r.likert, eos: r.eos }, p_duration: i === 0 ? 30 : r.duration });
}
[s, j] = await con("GET", `/v1/assessments/${A}/quality`);
ok("the monitor gives counts and the median, never answers", s === 200 && j.submitted === 3 && typeof j.median_seconds === "number" && !JSON.stringify(j).includes("alloc") && !JSON.stringify(j).includes("snapshot"), `${s} ${JSON.stringify(j).slice(0, 300)}`);
const fast = j?.flagged?.find((f) => f.flags.includes("SPEEDING"));
ok("the 30 second response is flagged SPEEDING", !!fast && /^rsp_/.test(fast.response_id), JSON.stringify(j?.flagged));
// owner ruling 22 Oct 2026 (Erick Ngala comments 23 and 27): nobody can void or change a response, so there is no void route and no void function
[s] = await con("POST", `/v1/assessments/${A}/quality`, { response_id: fast?.response_id, reason: "Completed in 30 seconds" });
ok("there is no way to void a response (POST refused, 405)", s === 405, s);
const vf = await svc.rpc("rpc_void_response", { p_assessment_id: A, p_response_id: fast?.response_id, p_reason: "Completed in 30 seconds", p_actor: "00000000-0000-0000-0000-000000000000" });
ok("the void function no longer exists in the database", !!vf.error, JSON.stringify(vf.data));
[s, j] = await con("GET", `/v1/assessments/${A}/quality`);
ok("the flagged response is still counted and shown as information", s === 200 && j.submitted === 3 && j.flagged.some((f) => f.response_id === fast?.response_id) && (j.voided ?? []).length === 0, JSON.stringify(j?.voided));
const direct = await createClient(URL_, ANON).rpc("rpc_monitor_set", { p_assessment_id: A });
ok("the monitor set is not callable with the anon key", !!direct.error);
const viaSvc = await svc.rpc("rpc_monitor_set", { p_assessment_id: A });
ok("the monitor set is not callable with the server key either (scoring key only)", !!viaSvc.error, JSON.stringify(viaSvc.data)?.slice(0, 80));

done();
