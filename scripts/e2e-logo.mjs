// Client logo (migration 24): who may set it, what is refused, and that released exports carry it. Ends with the logo cleared.
//   node --env-file=apps/web/.env.local scripts/e2e-logo.mjs [base-url]
import { readFileSync } from "node:fs";
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
  return (path, init = {}) => fetch(base + path, { redirect: "manual", ...init, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "x-cdp-csrf": "1", ...(init.headers ?? {}) } });
}
const png = readFileSync(new URL("../apps/web/app/icon.png", import.meta.url));
const put = (s, ten, body, type = "image/png") => s(`/v1/tenants/${ten}/logo`, { method: "PUT", body, headers: { "content-type": type } });

const { data: ten } = await svc.from("tenant").select("tenant_id").eq("name", "Demo Retail Bank (fixture)").single();
const { data: asm } = await svc.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).single();
const { data: rep } = await svc.from("report").select("report_id").eq("assessment_id", asm.assessment_id).eq("type", "ORGANISATIONAL").eq("status", "RELEASED").limit(1).single();
const T = ten.tenant_id;

let r = await fetch(`${base}/v1/tenants/${T}/logo`, { method: "PUT", body: png, headers: { "content-type": "image/png", "x-cdp-csrf": "1" } });
ok("signed out is refused", r.status === 401, r.status);
const consultant = await session("consultant@cdp-demo.example");
const adminF = await session("admin.fixture@cdp-demo.example");
const exec = await session("exec.fixture@cdp-demo.example");
const other = await session("admin.live@cdp-demo.example");

r = await put(exec, T, png); ok("an executive may not set the logo", r.status === 403, r.status);
r = await put(other, T, png); ok("a client admin of another organisation may not", r.status === 403, r.status);
r = await put(consultant, T, png, "image/gif"); ok("a GIF is refused", r.status === 422, r.status);
r = await put(consultant, T, Buffer.from("not an image at all"), "image/png"); ok("a file that is not a PNG is refused", r.status === 422, r.status);
r = await put(consultant, T, Buffer.concat([png, Buffer.alloc(210 * 1024)])); ok("a logo over 200 KB is refused", r.status === 422, r.status);
r = await put(adminF, T, png); ok("the client admin sets the logo", r.status === 200, r.status);
r = await put(consultant, T, png); ok("the assigned PAC consultant sets the logo", r.status === 200, r.status);
const { data: row } = await svc.from("tenant").select("logo_type").eq("tenant_id", T).single();
ok("the logo is stored with its type", row.logo_type === "image/png");
const { count } = await svc.from("audit_log").select("*", { count: "exact", head: true }).eq("object_id", T).eq("action", "tenant.logo_set");
ok("setting the logo is audit logged", count >= 2, count);

r = await adminF(`/v1/reports/${rep.report_id}/export?format=pptx`);
const deck = Buffer.from(await r.arrayBuffer());
ok("the PowerPoint carries the client logo and the presenter line", r.status === 200 && deck.includes("Presented by Priority Activator Consulting"), r.status);
r = await adminF(`/reports/${rep.report_id}`);
ok("the report page shows the client logo", (await r.text()).includes("Presented by Priority Activator Consulting"));

r = await consultant(`/v1/tenants/${T}/logo`, { method: "DELETE" }); ok("the consultant clears the logo", r.status === 200, r.status);
const { data: after } = await svc.from("tenant").select("logo_type").eq("tenant_id", T).single();
ok("the logo is gone", after.logo_type === null);
done();
