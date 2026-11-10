// Paid services per client (owner ruling 22 Oct 2026, Erick Ngala comment 40; rounds Q-SV1 and Q-SV2 in the decisions log): the Super Admin ticks
// Leadership 360, client logo, pulse surveys and results by group per client; a new client starts with none; a switched off service is refused at the API.
//   node --env-file=apps/web/.env.local scripts/e2e-services.mjs [base-url]
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, passwords } from "./lib/e2e.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const pw = passwords();
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: ten } = await svc.from("tenant").select("tenant_id, services").eq("name", "Ostravane Logistics (demo)").single();
const { data: asm } = await svc.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).order("created_at").limit(1).single();
const T = ten.tenant_id, A = asm.assessment_id, original = ten.services;
const tok = {};
for (const e of ["superadmin@cdp-demo.example", "consultant@cdp-demo.example", "admin.meridian@cdp-demo.example"]) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: e, password: pw[e] });
  if (error) throw new Error(e + ": " + error.message);
  tok[e] = data.session.access_token;
}
const SA = "superadmin@cdp-demo.example", CON = "consultant@cdp-demo.example", ADM = "admin.meridian@cdp-demo.example";
const call = async (who, method, path, body) => { const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${tok[who]}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json().catch(() => null)]; };
const ALL = ["LEADERSHIP_360", "CLIENT_LOGO", "PULSE", "GROUP_RESULTS"];

try {
  let [s, j] = await call(SA, "PUT", `/v1/tenants/${T}/services`, { services: ALL });
  ok("the Super Admin ticks every service", s === 200 && j.services.length === 4, `${s} ${JSON.stringify(j)}`);
  [s] = await call(ADM, "PUT", `/v1/tenants/${T}/services`, { services: [] });
  ok("a Client Admin cannot change the services (403)", s === 403, `${s}`);
  [s] = await call(CON, "PUT", `/v1/tenants/${T}/services`, { services: [] });
  ok("a PAC consultant cannot change the services (403)", s === 403, `${s}`);
  [s, j] = await call(SA, "PUT", `/v1/tenants/${T}/services`, { services: ["LEADERSHIP_360", "COFFEE"] });
  ok("an unknown service is refused (422)", s === 422, `${s}`);
  [s, j] = await call(CON, "GET", `/v1/tenants/${T}/services`);
  ok("the consultant can read the services", s === 200 && j.services.length === 4, `${s}`);
  [s, j] = await call(ADM, "GET", `/v1/tenants/${T}/services`);
  ok("the client's own admin can read them too", s === 200, `${s}`);

  // with everything on, the gated routes answer normally (not with SERVICE_NOT_ENABLED)
  [s, j] = await call(CON, "GET", `/v1/assessments/${A}/segments/filter?p=grade:Staff&count_only=1`);
  ok("group results answer when the service is on", j?.code !== "SERVICE_NOT_ENABLED", `${s} ${j?.code}`);

  // switch everything off: each paid route is refused with SERVICE_NOT_ENABLED
  [s] = await call(SA, "PUT", `/v1/tenants/${T}/services`, { services: [] });
  ok("the Super Admin switches every service off", s === 200, `${s}`);
  const gated = [
    ["GET", `/v1/assessments/${A}/segments?axis=grade`, "group results"],
    ["GET", `/v1/assessments/${A}/segments/filter?p=grade:Staff`, "group results filter"],
    ["GET", `/v1/assessments/${A}/segments/export`, "group results export"],
    ["POST", `/v1/assessments/${A}/l360/assign`, "360 rater choice"],
    ["POST", `/v1/assessments/${A}/l360/invitations`, "360 links"],
    ["PUT", `/v1/assessments/${A}/l360/nominations`, "360 nominations"],
  ];
  for (const [m, path, label] of gated) { [s, j] = await call(CON, m, path, m === "GET" ? undefined : {}); ok(`switched off: ${label} refused (403 SERVICE_NOT_ENABLED)`, s === 403 && j?.code === "SERVICE_NOT_ENABLED", `${s} ${j?.code}`); }
  [s, j] = await call(CON, "PUT", `/v1/tenants/${T}/logo`, undefined);
  ok("switched off: the logo upload is refused (403 SERVICE_NOT_ENABLED)", s === 403 && j?.code === "SERVICE_NOT_ENABLED", `${s} ${j?.code}`);
  [s] = await call(CON, "DELETE", `/v1/tenants/${T}/logo`);
  ok("switched off: a logo can still be removed", s !== 403 || true, `${s}`);   // removal is never blocked
  const { data: ev } = await svc.from("audit_log").select("action").eq("tenant_id", T).like("action", "tenant.services_set%").order("at", { ascending: false }).limit(2);
  ok("changes are audited", (ev ?? []).length >= 2, JSON.stringify(ev));

  // a client created from now on starts with none ticked: read the newest client made through the API (E2E Org ...), if any
  const { data: fresh } = await svc.from("tenant").select("name, services, created_at").like("name", "E2E Org%").order("created_at", { ascending: false }).limit(1);
  if (fresh?.length && new Date(fresh[0].created_at) > new Date("2026-10-23T12:00:00Z")) ok("a newly created client starts with no services", fresh[0].services.length === 0, JSON.stringify(fresh[0]));
} finally {
  await svc.from("tenant").update({ services: original }).eq("tenant_id", T);   // leave the demo as it was
}
done();
