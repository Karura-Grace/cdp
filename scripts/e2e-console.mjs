// Engagement console check: the Overview page and the tab bar on every engagement page, per role, on the seeded fixture
// (released) and the live demo engagement. Read only.
//   node --env-file=apps/web/.env.local scripts/e2e-console.mjs [base-url]
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
  return (path) => fetch(base + path, { redirect: "manual", headers: { cookie: cookie() } });
}
const tabsOf = (html) => [...(html.match(/aria-label="Engagement"[\s\S]*?<\/nav>/)?.[0] ?? "").matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]);

const { data: ten } = await svc.from("tenant").select("tenant_id").eq("name", "Demo Retail Bank (fixture)").single();
const { data: asm } = await svc.from("assessment").select("assessment_id, engagement_id").eq("tenant_id", ten.tenant_id).single();
const eng = asm.engagement_id;

let r = await fetch(`${base}/engagements/${eng}`, { redirect: "manual" });
ok("signed out Overview redirects to /login", r.status === 307 && r.headers.get("location")?.includes("/login"), r.status);

const consultant = await session("consultant@cdp-demo.example");
r = await consultant("/dashboard?all=1");
ok("Portfolio links each engagement to its console", (await r.text()).includes(`href="/engagements/${eng}"`));
r = await consultant(`/engagements/${eng}`);
let html = await r.text();
ok("consultant Overview renders", r.status === 200 && html.includes("Step ") && html.includes("Reports released"), r.status);
let tabs = tabsOf(html);
for (const t of ["Overview", "Organisation", "Setup and launch", "Leadership 360", "Results by group", "Action plan", "Measure"]) ok(`consultant sees tab ${t}`, tabs.includes(t), tabs.join(", "));
ok("Overview tab marked current", /aria-current="page"[^>]*>(<svg[\s\S]*?<\/svg>)?<span>Overview/.test(html));
for (const [path, label] of [[`/engagements/${eng}/setup`, "Setup and launch"], [`/engagements/${eng}/org`, "Organisation"], [`/assessments/${asm.assessment_id}/plan`, "Action plan"], [`/assessments/${asm.assessment_id}/segments`, "Results by group"], [`/assessments/${asm.assessment_id}/leaders`, "Leadership 360"], [`/engagements/${eng}/measure`, "Measure"]]) {
  r = await consultant(path); html = await r.text();
  ok(`${label} page carries the tab bar with itself current`, r.status === 200 && tabsOf(html).includes("Overview") && new RegExp(`aria-current="page"[^>]*>(<svg[\\s\\S]*?<\\/svg>)?<span>${label}`).test(html), r.status);
}

const admin = await session("admin.fixture@cdp-demo.example");
r = await admin(`/engagements/${eng}`); html = await r.text(); tabs = tabsOf(html);
ok("client admin Overview renders", r.status === 200, r.status);
ok("client admin sees Setup and launch (drafts A to D, J1 decision 18 Oct) but no group results tab", tabs.includes("Setup and launch") && !tabs.includes("Results by group"), tabs.join(", "));
ok("client admin sees Organisation and, once released, the plan", tabs.includes("Organisation") && tabs.includes("Action plan"), tabs.join(", "));

const lead = await session("peoplelead.fixture@cdp-demo.example");
r = await lead(`/engagements/${eng}`); html = await r.text(); tabs = tabsOf(html);
ok("people leader sees My team, not Measure or Organisation", tabs.includes("My team") && !tabs.includes("Measure") && !tabs.includes("Organisation"), tabs.join(", "));

const other = await session("admin.live@cdp-demo.example");
r = await other(`/engagements/${eng}`);
ok("someone from another organisation is sent away", r.status === 307 && r.headers.get("location")?.includes("/dashboard"), r.status);
done();
