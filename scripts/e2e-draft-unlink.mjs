// Journey 2, slice S2: server side drafts (S2.3.1-005), started count, and that no draft outlives the person link
// (deleted at submit and at freeze, AC-2.4 extended to capture.draft).
//   node --env-file=apps/web/.env.local scripts/e2e-draft-unlink.mjs <project-ref> <token-file> [base-url]
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const out = execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-demo.mjs", ref, tokenFile, "live", "3", base, "1"], { encoding: "utf8" });
const tokens = [...out.matchAll(/#([0-9a-f]{32})/g)].map((m) => m[1]);
ok("seeded 3 links", tokens.length === 3);
const fx = JSON.parse(readFileSync("packages/cdp-engine/oracle/cases/fixture.json"));
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: ten } = await svc.from("tenant").select("tenant_id").like("name", "Live Demo Co%").order("created_at", { ascending: false }).limit(1).single();
const { data: asm } = await svc.from("assessment").select("assessment_id, window_close").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id;

const mgmt = readFileSync(tokenFile, "utf8").trim();
const sql = async (query) => (await (await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${mgmt}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) })).json());
const drafts = async () => Number((await sql(`select count(*) n from capture.draft d join capture.invitation i using (invitation_id) where i.assessment_id = '${A}'`))[0].n);
const survey = (path, tok, init = {}) => fetch(base + path, { ...init, headers: { "content-type": "application/json", "x-survey-token": tok, ...(init.headers ?? {}) } });
const put = (tok, body) => survey("/v1/survey/draft", tok, { method: "PUT", body: JSON.stringify(body) });

const draft = { step: 3, spent: 120, alloc: { NOW: { D1: fx.input.responses[0].alloc.NOW.D1 }, PREFERRED: {} }, likert: {}, eos: [], qual: ["", "", ""] };
let r = await put(tokens[0], draft);
ok("no draft is saved before consent (409)", r.status === 409, r.status);
for (const t of tokens) await svc.rpc("rpc_record_consent", { p_token: t, p_decision: "AGREE" });
r = await put(tokens[0], draft);
ok("a draft is saved after consent", r.status === 200, r.status);
await put(tokens[1], draft);
r = await survey("/v1/survey/draft", tokens[0]);
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
ok("the token holder reads the same draft back", r.status === 200 && canon((await r.json()).draft) === canon(draft));
r = await survey("/v1/survey/draft", tokens[2]);
ok("an unstarted link has no draft", r.status === 200 && (await r.json()).draft === null);
const counts = (await svc.rpc("rpc_fielding_counts", { p_assessment_id: A })).data;
ok("started counts the two saved drafts, counts only", counts.started === 2 && counts.submitted === 0 && counts.invited === 3, JSON.stringify(counts));
const raw = await sql(`select encode(ciphertext, 'escape') like '%ENGAGE%' plain from capture.draft d join capture.invitation i using (invitation_id) where i.assessment_id = '${A}' limit 1`);
ok("the stored draft is encrypted", raw?.[0]?.plain === false, JSON.stringify(raw));
for (const role of ["anon", "authenticated", "service_role"]) {
  const g = await sql(`select has_table_privilege('${role}', 'capture.draft', 'select') p`);
  ok(`${role} cannot select capture.draft`, g?.[0]?.p === false, JSON.stringify(g));
}
const direct = await createClient(URL_, ANON).rpc("rpc_load_draft", { p_token: tokens[0] });
ok("the draft functions are not callable with the anon key", !!direct.error);

ok("two drafts stored", (await drafts()) === 2);
const resp = fx.input.responses[0];
const sub = await svc.rpc("rpc_submit_response", { p_token: tokens[0], p_payload: { alloc: resp.alloc, likert: resp.likert, eos: resp.eos }, p_duration: resp.duration });
ok("submit succeeds", !sub.error, sub.error?.message);
ok("the submit deleted that draft in the same transaction", (await drafts()) === 1);
r = await survey("/v1/survey/draft", tokens[0]);
ok("a submitted link can no longer read or save a draft (410)", r.status === 410 && (await put(tokens[0], draft)).status === 410);

// auto submit at close (S2.6.3-005): the third person ticks it; one fully answered dimension and one half done set
const half = { ENGAGE: 50, INNOVATE: null, PERFORM: null, GOVERN: null };
r = await put(tokens[2], { ...draft, autoSubmit: true, alloc: { NOW: { D1: fx.input.responses[1].alloc.NOW.D1, D2: [half, null, null] }, PREFERRED: {} } });
ok("a ticked draft is saved", r.status === 200, r.status);
// freeze removes every remaining draft
const cpw = /consultant@\S+\s+(\S+)/.exec(readFileSync("context-sessions/demo-credentials.txt", "utf8"))[1];
const jar = new Map();
const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
await c.auth.signInWithPassword({ email: "consultant@cdp-demo.example", password: cpw });
const wait = new Date(asm.window_close).getTime() - Date.now() + 1500;
if (wait > 0) await new Promise((res) => setTimeout(res, wait));
const fz = await fetch(`${base}/v1/assessments/${A}/freeze`, { method: "POST", body: "{}", headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "x-cdp-csrf": "1", "content-type": "application/json" } });
ok("consultant freezes", fz.status === 200, fz.status);
ok("freeze deleted the unsubmitted draft", (await drafts()) === 0);
const fm = (await svc.from("assessment").select("freeze_manifest").eq("assessment_id", A).single()).data.freeze_manifest;
ok("only the ticked draft was submitted at close; the unticked one was not", fm?.auto_submitted === 1 && fm.submitted === 2, JSON.stringify(fm));
const kept = await sql(`select count(distinct a.response_id)::int n from capture.response_allocation a join capture.response r using (response_id) where r.assessment_id = '${A}' and a.scenario_id like 'D2-%'`);
ok("the half done set was left out, never balanced (only the full submit has D2)", kept?.[0]?.n === 1, JSON.stringify(kept));
const linked = await sql(`select count(*)::int n from capture.invitation where assessment_id = '${A}' and submitted_at is not null and person_id is not null`);
ok("the auto submitted response is unlinked like any other", linked?.[0]?.n === 0, JSON.stringify(linked));

done();
