// User-management checks with real cookie sessions against a running server and the seeded fixture tenant.
// Creates throwaway users (unique emails) and deletes them at the end, so it is re-runnable.
//   node --env-file=.env.local scripts/e2e-users.mjs [base-url]
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON } from "./lib/e2e.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const creds = readFileSync("context-sessions/demo-credentials.txt", "utf8");
const pw = Object.fromEntries(creds.trim().split("\n").map((l) => { const m = /(\S+@\S+)\s+(\S+)$/.exec(l); return [m[1], m[2]]; }));
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const H = { "content-type": "application/json", "x-cdp-csrf": "1" };

async function login(email, password) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) return { error };
  const f = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), ...(init.headers ?? {}) } });
  const call = async (method, path, body) => { const r = await f(path, { method, headers: H, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json().catch(() => null)]; };
  return { f, call, c };
}
const created = [];

const stamp = Date.now().toString(36);
const sa = await login("superadmin@cdp-demo.example", pw["superadmin@cdp-demo.example"]);
const ca = await login("admin.fixture@cdp-demo.example", pw["admin.fixture@cdp-demo.example"]);
const exec = await login("exec.fixture@cdp-demo.example", pw["exec.fixture@cdp-demo.example"]);
const lead = await login("peoplelead.fixture@cdp-demo.example", pw["peoplelead.fixture@cdp-demo.example"]);
const consult = await login("consultant@cdp-demo.example", pw["consultant@cdp-demo.example"]);
const otherCa = "admin.meridian@cdp-demo.example";   // a fixed demo tenant: the live test tenants are removed after conformance runs
const { data: ten } = await svc.from("tenant").select("tenant_id").eq("name", "Demo Retail Bank (fixture)").single();
const { data: eng } = await svc.from("engagement").select("engagement_id").eq("tenant_id", ten.tenant_id).single();

// ---- who may call
let r = await fetch(base + "/v1/users");
ok("no session -> 401", r.status === 401, r.status);
for (const [n, s] of [["executive", exec], ["people leader", lead], ["consultant", consult]]) {
  const [st] = await s.call("GET", "/v1/users");
  ok(`${n} cannot list users (403)`, st === 403, st);
}
let [s, list] = await ca.call("GET", "/v1/users");
ok("client admin sees only their own tenant, no PAC or Super Admin rows", s === 200 && list.length >= 3 && list.every((u) => u.tenant_id === ten.tenant_id && !["PAC_CONSULTANT", "SUPER_ADMIN"].includes(u.role)), `${s} ${JSON.stringify(list?.map((u) => u.role))}`);
let [, all] = await sa.call("GET", "/v1/users");
ok("super admin sees every role", ["SUPER_ADMIN", "PAC_CONSULTANT", "CLIENT_ADMIN", "EXECUTIVE", "PEOPLE_LEADER"].every((r2) => all.some((u) => u.role === r2)), JSON.stringify([...new Set(all.map((u) => u.role))]));

// ---- create
const mk = (name, role, extra = {}) => ({ email: `${name}.${stamp}@cdp-demo.example`, full_name: `Test ${name}`, role, ...extra });
[s, r] = await ca.call("POST", "/v1/users", mk("lead1", "PEOPLE_LEADER"));
ok("client admin creates a People Leader with a one-time password", s === 201 && r.temp_password?.length === 19, `${s} ${JSON.stringify(r)}`);
const lead1 = { id: r.user_id, email: `lead1.${stamp}@cdp-demo.example`, pw: r.temp_password }; created.push(lead1.id);
[s] = await ca.call("POST", "/v1/users", mk("lead1", "COACH"));
ok("duplicate email -> 409 EMAIL_IN_USE", s === 409, s);
[s] = await ca.call("POST", "/v1/users", mk("x", "CLIENT_ADMIN"));
ok("client admin cannot create a Client Admin", s === 403, s);
[s] = await ca.call("POST", "/v1/users", mk("x", "PAC_CONSULTANT"));
ok("client admin cannot create a PAC Consultant", s === 403, s);
[s] = await ca.call("POST", "/v1/users", { ...mk("x", "COACH"), email: "not-an-email" });
ok("bad email -> 422", s === 422, s);
[s, r] = await ca.call("POST", "/v1/users", mk("coach1", "COACH", { tenant_id: "ten_someoneelse" }));
ok("tenant_id in the body is ignored for a client admin (created in their own tenant)", s === 201, `${s} ${JSON.stringify(r)}`);
const coach1 = { id: r.user_id, email: `coach1.${stamp}@cdp-demo.example`, pw: r.temp_password }; created.push(coach1.id);
[, list] = await ca.call("GET", "/v1/users");
ok("new users appear in the list under the right tenant and role", list.find((u) => u.user_id === coach1.id)?.tenant_id === ten.tenant_id && list.find((u) => u.user_id === lead1.id)?.role === "PEOPLE_LEADER");

// ---- forced password change
const u1 = await login(lead1.email, lead1.pw);
ok("new user can sign in with the temporary password", !u1.error, u1.error?.message);
r = await u1.f("/dashboard");
ok("temporary password forces /account/password", r.status === 307 && r.headers.get("location")?.includes("/account/password"), `${r.status} ${r.headers.get("location")}`);
[s, r] = await u1.call("POST", "/v1/me/password-changed");
ok("clearing the flag without changing the password is refused (PASSWORD_UNCHANGED)", s === 422 && r.code === "PASSWORD_UNCHANGED", `${s} ${JSON.stringify(r)}`);
const newPw = `Changed-${stamp}-pw7!`;   // the auth policy needs lower, upper and a digit; the base 36 stamp may hold no digit
const up = await u1.c.auth.updateUser({ password: newPw });
ok("user sets their own password", !up.error, up.error?.message);
[s] = await u1.call("POST", "/v1/me/password-changed");
ok("now the flag clears", s === 200, s);
r = await u1.f("/dashboard");
ok("dashboard opens after the change", r.status === 200, r.status);
r = await u1.f("/users");
ok("a People Leader opening /users is sent away", r.status === 307 && r.headers.get("location")?.includes("/dashboard"), `${r.status} ${r.headers.get("location")}`);

// ---- role change
[s] = await ca.call("PATCH", `/v1/users/${lead1.id}`, { role: "EXECUTIVE" });
ok("client admin changes People Leader -> Executive", s === 200, s);
[s] = await ca.call("PATCH", `/v1/users/${lead1.id}`, { role: "CLIENT_ADMIN" });
ok("client admin cannot promote to Client Admin (403)", s === 403, s);
[, list] = await ca.call("GET", "/v1/users");
ok("role change is stored", list.find((u) => u.user_id === lead1.id)?.role === "EXECUTIVE");
const me = list.find((u) => u.email === "admin.fixture@cdp-demo.example");
[s] = await ca.call("PATCH", `/v1/users/${me.user_id}`, { active: false });
ok("nobody can deactivate themselves", s === 403, s);

// ---- cross-tenant and privileged targets
const otherAdmin = all.find((u) => u.email === otherCa);
const rootUser = all.find((u) => u.role === "SUPER_ADMIN");
const consultantUser = all.find((u) => u.email === "consultant@cdp-demo.example");
[s] = await ca.call("PATCH", `/v1/users/${otherAdmin.user_id}`, { active: false });
ok("client admin cannot deactivate another tenant's admin", s === 403, s);
[s] = await ca.call("POST", `/v1/users/${otherAdmin.user_id}/reset-password`);
ok("client admin cannot reset another tenant's password (403)", s === 403, s);
const stillOk = await login(otherCa, pw[otherCa]);
ok("...and that user's password was NOT changed (authorised before acting)", !stillOk.error, stillOk.error?.message);
[s] = await ca.call("POST", `/v1/users/${rootUser.user_id}/reset-password`);
ok("client admin cannot reset the Super Admin", s === 403, s);
[s] = await sa.call("POST", `/v1/users/${rootUser.user_id}/reset-password`);
ok("nobody resets a Super Admin here, not even themselves", s === 403, s);
[s] = await ca.call("PATCH", `/v1/users/${consultantUser.user_id}`, { active: false });
ok("client admin cannot touch a PAC Consultant", s === 403, s);

// ---- deactivate / reactivate
[s] = await ca.call("PATCH", `/v1/users/${coach1.id}`, { active: false });
ok("client admin deactivates a Coach", s === 200, s);
const dead = await login(coach1.email, coach1.pw);
ok("a deactivated user cannot sign in", !!dead.error, "signed in");
[, list] = await ca.call("GET", "/v1/users");
ok("list shows them deactivated", list.find((u) => u.user_id === coach1.id)?.active === false);
// a token issued before deactivation stops working at the database
[s, r] = await ca.call("POST", "/v1/users", mk("coach2", "COACH")); const coach2 = { id: r.user_id, email: `coach2.${stamp}@cdp-demo.example`, pw: r.temp_password }; created.push(coach2.id);
const c2 = await login(coach2.email, coach2.pw);
const before = await c2.c.rpc("rpc_actor_scope");
await ca.call("PATCH", `/v1/users/${coach2.id}`, { active: false });
const after = await c2.c.rpc("rpc_actor_scope");
const tenantRows = await c2.c.from("tenant").select("tenant_id");
ok("an existing session stops being honoured by the database once deactivated", before.data?.role === "COACH" && after.data?.role === null && (tenantRows.data?.length ?? 0) === 0, `${JSON.stringify(before.data)} -> ${JSON.stringify(after.data)}`);
[s] = await ca.call("PATCH", `/v1/users/${coach1.id}`, { active: true });
const back = await login(coach1.email, coach1.pw);
ok("reactivation restores sign-in", s === 200 && !back.error, back.error?.message);

// ---- reset password
[s, r] = await ca.call("POST", `/v1/users/${coach1.id}/reset-password`);
ok("client admin resets a Coach's password", s === 200 && r.temp_password?.length === 19 && r.temp_password !== coach1.pw, `${s}`);
const oldFails = await login(coach1.email, coach1.pw);
const newWorks = await login(coach1.email, r.temp_password);
ok("old password stops working, new one works", !!oldFails.error && !newWorks.error);
r = await newWorks.f("/dashboard");
ok("reset sends them to /account/password again", r.status === 307 && r.headers.get("location")?.includes("/account/password"), r.status);

// ---- PAC consultant time-box (Super Admin only)
[s] = await ca.call("POST", `/v1/users/${consultantUser.user_id}/assignments`, { engagement_id: eng.engagement_id, valid_to: new Date(Date.now() + 864e5).toISOString() });
ok("client admin cannot assign consultants", s === 403, s);
[s, r] = await sa.call("POST", "/v1/users", mk("pac1", "PAC_CONSULTANT"));
ok("super admin creates a PAC Consultant", s === 201, `${s} ${JSON.stringify(r)}`);
const pac = { id: r.user_id, email: `pac1.${stamp}@cdp-demo.example`, pw: r.temp_password }; created.push(pac.id);
const p1 = await login(pac.email, pac.pw);
let engs = await p1.c.from("engagement").select("engagement_id");
ok("a consultant with no assignment sees no engagements", (engs.data?.length ?? 0) === 0);
[s, r] = await sa.call("POST", `/v1/users/${pac.id}/assignments`, { engagement_id: eng.engagement_id, valid_to: new Date(Date.now() + 7 * 864e5).toISOString() });
ok("super admin assigns the consultant for 7 days", s === 201, `${s} ${JSON.stringify(r)}`);
const aid = r.assignment_id;
engs = await p1.c.from("engagement").select("engagement_id");
ok("the consultant now sees that engagement", engs.data?.length === 1);
[s] = await sa.call("POST", `/v1/users/${pac.id}/assignments`, { engagement_id: eng.engagement_id, valid_to: new Date(Date.now() + 400 * 864e5).toISOString() });
ok("access beyond a year is refused", s === 422, s);
[s] = await sa.call("DELETE", `/v1/assignments/${aid}`);
ok("super admin revokes early", s === 200, s);
engs = await p1.c.from("engagement").select("engagement_id");
ok("the consultant sees nothing after revoke", (engs.data?.length ?? 0) === 0, engs.data?.length);
[s] = await sa.call("POST", `/v1/users/${rootUser.user_id}/assignments`, { engagement_id: eng.engagement_id, valid_to: new Date(Date.now() + 864e5).toISOString() });
ok("a Super Admin cannot be assigned as a consultant", s === 422, s);

// ---- audit
const { data: aud } = await svc.from("audit_log").select("action, actor_id").like("object_type", "user");
const has = (p) => aud.some((a) => a.action.startsWith(p));
ok("audit log has created / role_changed / deactivated / reactivated / password_reset / password_changed / assignment", ["user.created:", "user.role_changed:", "user.deactivated", "user.reactivated", "user.password_reset", "user.password_changed", "assignment.created:", "assignment.revoked:"].every(has), JSON.stringify([...new Set(aud.map((a) => a.action.split(":")[0]))]));
const mfa = await svc.rpc("rpc_users_list", { p_actor: lead1.id });
ok("the database refuses the list to a non-manager even when called directly", !!mfa.error);

for (const id of created) await svc.auth.admin.deleteUser(id);
done();
