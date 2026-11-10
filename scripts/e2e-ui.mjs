// Staff UI check with real cookie sessions against a running dev server and the seeded fixture (already released
// by e2e-release.mjs). Creates and releases a fresh LEADERSHIP_TEAM report on every run, so it is re-runnable.
//   node --env-file=.env.local scripts/e2e-ui.mjs [base-url]
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, passwords } from "./lib/e2e.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const pw = passwords();
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function session(email) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email, password: pw[email] });
  if (error) throw new Error(email + ": " + error.message);
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  return (path, init = {}) => fetch(base + path, { redirect: "manual", ...init, headers: { cookie: cookie(), ...(init.headers ?? {}) } });
}

const { data: ten } = await svc.from("tenant").select("tenant_id").eq("name", "Demo Retail Bank (fixture)").single();
const { data: asm } = await svc.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).single();
const { data: org } = await svc.from("report").select("report_id").eq("assessment_id", asm.assessment_id).eq("type", "ORGANISATIONAL").single();

// signed out
let r = await fetch(base + "/dashboard", { redirect: "manual" });
ok("signed-out /dashboard redirects to /login", r.status === 307 && r.headers.get("location")?.includes("/login"), r.status);
r = await fetch(base + `/reports/${org.report_id}`, { redirect: "manual" });
ok("signed-out report redirects to /login", r.status === 307, r.status);
r = await fetch(base + "/login");
ok("login page renders", r.status === 200 && (await r.text()).includes("Sign in"));

const consultant = await session("consultant@cdp-demo.example");
const admin = await session("admin.fixture@cdp-demo.example");
const exec = await session("exec.fixture@cdp-demo.example");
const lead = await session("peoplelead.fixture@cdp-demo.example");
const other = await session("admin.live@cdp-demo.example");
const root = await session("superadmin@cdp-demo.example");

// the way in: where you are and what to do, on the Portfolio; the order of the work, on the setup page
let dh = (await (await consultant("/dashboard")).text()).replace(/<!--.*?-->/g, "");
ok("Portfolio tells the consultant the step and what to do", /Step \d of 8/.test(dh) && dh.includes("What you can do here as a PAC Consultant"));

// the read only instrument preview: every scenario and item, for staff only
let pv = await consultant("/preview"); let pvh = (await pv.text()).replace(/<!--.*?-->/g, "");
ok("preview shows all six culture dimensions, three readiness blocks, eOS and the open questions", pv.status === 200 && ["D1 · Cultural DNA", "D6 · Victory Conditions", "D7 · Digital Readiness", "D9 · Adaptive Capacity", "Employee Orientation Survey", "Open questions"].every((x) => pvh.includes(x)) && (pvh.match(/Scenario \d: /g) ?? []).length === 18, pv.status);
ok("a signed out visitor is sent to sign in", (await fetch(base + "/preview", { redirect: "manual" })).status === 307);

// released organisational report
for (const [name, s] of [["admin", admin], ["exec", exec], ["lead", lead], ["consultant", consultant]]) {
  r = await s(`/reports/${org.report_id}`);
  const h = await r.text();
  ok(`${name}: released report renders in the new look (Now and Preferred culture, no Today)`, r.status === 200 && h.includes("Now and Preferred culture") && !/Today versus preferred/.test(h) && (name !== "consultant" || h.includes("sha256:3366fa7d")), r.status);
  if (name === "admin") ok("report shows consultant summary + findings + chart", h.includes("What this means") && h.includes("Shadow culture") && h.includes("<svg"));
  ok(`${name}: the report draws the culture graphics (framed map with its axis words, concentric chart) and no radar`, ["ADAPTIVE", "STRUCTURED", "INWARD", "OUTWARD", "Preferred (dashed)"].every((w) => h.includes(w)) && (h.match(/<svg/g) ?? []).length >= 4 && !/radar/i.test(h.replace(/<!--.*?-->/g, "")));
  ok(`${name}: no draft editor on a released report`, !h.includes("Draft: not visible to the client"));
}
for (const [name, s] of [["other tenant", other], ["super admin", root]]) {
  r = await s(`/reports/${org.report_id}`);
  ok(`${name}: released report is 404`, r.status === 404, r.status);
}

// dashboard
r = await admin("/dashboard"); let h = await r.text();
ok("admin dashboard lists the report", r.status === 200 && h.includes("Organisational") && h.includes("Demo Retail Bank"), r.status);
r = await other("/dashboard"); h = await r.text();
ok("other tenant dashboard does not show the fixture report", r.status === 200 && !h.includes("Demo Retail Bank") && !h.includes(org.report_id));

// draft report: only the consultant sees it
r = await consultant(`/v1/assessments/${asm.assessment_id}/reports`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "BOARD_EXEC_SUMMARY" }) });
ok("cookie POST without CSRF header is refused", r.status === 401, r.status);
const { data: sco } = await svc.from("score_object").select("payload_hash").eq("assessment_id", asm.assessment_id).single();
const { data: draft } = await svc.from("report").insert({ tenant_id: ten.tenant_id, assessment_id: asm.assessment_id, score_version: 1, type: "LEADERSHIP_TEAM", payload_hash: sco.payload_hash }).select("report_id").single();
r = await consultant(`/reports/${draft.report_id}`); h = await r.text();
ok("consultant sees the draft with the editor", r.status === 200 && h.includes("Draft: not visible to the client") && h.includes("Release to client"), r.status);
for (const [name, s] of [["admin", admin], ["exec", exec], ["lead", lead]]) {
  r = await s(`/reports/${draft.report_id}`);
  ok(`${name}: draft is 404`, r.status === 404, r.status);
}
const H = { "content-type": "application/json", "x-cdp-csrf": "1" };
r = await admin(`/v1/reports/${draft.report_id}/release`, { method: "POST", headers: H });
ok("client admin cannot release via the browser path", r.status === 403, r.status);
r = await consultant(`/v1/reports/${draft.report_id}/release`, { method: "POST", headers: H });
ok("release refused with empty sections", r.status === 422, r.status);
// the fixture predates the freeze manifest the release gate reads (S8): give it the manifest a freeze would have written
await svc.from("assessment").update({ freeze_manifest: { invited: 475, started: 475, submitted: 475, abandoned: 0, voided: 0, auto_submitted: 0, counts_by_state: { COMPLETE: 475 }, extensions: [], response_set_hash: "fixture" } }).eq("assessment_id", asm.assessment_id);
r = await consultant(`/v1/reports/${draft.report_id}/sections`, { method: "PUT", headers: H, body: JSON.stringify({ sections: { what_this_means: "x" } }) });
ok("report text cannot be edited, even with the cookie session (405)", r.status === 405, r.status);
// a draft inserted straight into the table has no system text: give it what the reports route would have drafted
await svc.from("report").update({ sections_json: { what_this_means: "Board summary: delivery is strong.", what_to_do_next: "Start with the largest gap." }, accepted_json: { what_this_means: new Date().toISOString(), what_to_do_next: new Date().toISOString() } }).eq("report_id", draft.report_id);
r = await consultant(`/v1/reports/${draft.report_id}/release`, { method: "POST", headers: H });
ok("consultant releases via cookie session", r.status === 200, r.status);
r = await exec(`/reports/${draft.report_id}`);
ok("exec now sees the released report", r.status === 200 && (await r.text()).includes("Board summary: delivery is strong"), r.status);
r = await lead(`/reports/${draft.report_id}`);
ok("people lead still cannot see the leadership-team report", r.status === 404, r.status);

r = await admin("/auth/signout", { method: "POST" });
ok("sign-out redirects", r.status === 303, r.status);
done();
