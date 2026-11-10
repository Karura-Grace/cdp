// Role tags and location countries (owner rulings 22 Oct 2026, Erick Ngala comments 34 and 39; rounds Q-SV3 and Q-SV4 in the decisions log), on a throwaway
// open client (seed-rich-demo open): the Client Admin tags people and gives locations a country, a tag wins over the grade flag on the survey link,
// a tagged person cannot be re tagged once a link is issued, the country becomes a results cut, and other tenants are refused.
//   node --env-file=apps/web/.env.local scripts/e2e-tags.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, passwords } from "./lib/e2e.mjs";
import { seedKit } from "./lib/seed.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const NAME = `Tags test ${new Date().toISOString().slice(2, 19).replace(/\D/g, "")}`;
const out = execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-rich-demo.mjs", ref, tokenFile, base, NAME, "open"], { encoding: "utf8" });
const [, TID, EID, AID] = /Open\. .+?: (ten_\S+) \/ (eng_\S+) \/ (asm_\S+)/.exec(out);
const SLUG = NAME.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
const { sql } = seedKit(ref, tokenFile);   // the service key cannot insert people; the management API can
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pw = passwords();
const login = async (e) => { const c = createClient(URL_, ANON, { auth: { persistSession: false } }); const { data, error } = await c.auth.signInWithPassword({ email: e, password: pw[e] }); if (error) throw new Error(e + ": " + error.message); return data.session.access_token; };
const T = { admin: await login(`admin.${SLUG}@cdp-demo.example`), other: await login("admin.fixture@cdp-demo.example"), con: await login("consultant@cdp-demo.example") };
const call = async (w, method, path, body) => { const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${T[w]}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json().catch(() => null)]; };
const P = `/v1/engagements/${EID}`;

// the open demo client has already issued links to everyone, so add four new people who have none (staff members, executive grade and a staff grade)
const tmpl = (await svc.from("person_of_record").select("unit_id, grade_id, location_id").eq("tenant_id", TID).eq("employment_status", "ACTIVE").limit(1)).data[0];
const execGrade = (await svc.from("grade_band").select("grade_id").eq("tenant_id", TID).eq("is_executive", true).limit(1)).data[0].grade_id;
const fresh = [["TG-1", execGrade], ["TG-2", execGrade], ["TG-3", tmpl.grade_id], ["TG-4", tmpl.grade_id]];
for (const [r, grade] of fresh) await sql(`insert into public.person_of_record (tenant_id, employee_ref, email, unit_id, grade_id, location_id, employment_status) values ('${TID}', '${r}', '${r.toLowerCase()}@kilima-rehearsal.example', '${tmpl.unit_id}', '${grade}', ${tmpl.location_id ? `'${tmpl.location_id}'` : "null"}, 'ACTIVE')`);
let [s, j] = await call("admin", "GET", `${P}/role-tags`);
ok("the Client Admin reads everyone's tag", s === 200 && j.people.length > 10 && j.people.every((p) => p.role_tag === null), `${s} ${j?.people?.length}`);
const staffMember = j.people.find((p) => p.employee_ref === "TG-1"), another = j.people.find((p) => p.employee_ref === "TG-2"), third = j.people.find((p) => p.employee_ref === "TG-3");
ok("the new people are not locked, and the people who already have links are", !staffMember.locked && j.people.some((p) => p.locked), JSON.stringify(j.people.filter((p) => p.locked).length));
[s] = await call("other", "GET", `${P}/role-tags`);
ok("another tenant's admin cannot read them (403)", s === 403, `${s}`);
[s] = await call("other", "PUT", `${P}/role-tags`, { tags: [{ employee_ref: staffMember.employee_ref, role_tag: "EXECUTIVE" }] });
ok("another tenant's admin cannot tag (403)", s === 403, `${s}`);
[s] = await call("admin", "PUT", `${P}/role-tags`, { tags: [{ employee_ref: staffMember.employee_ref, role_tag: "BOSS" }] });
ok("an unknown tag is refused (422)", s === 422, `${s}`);
[s] = await call("admin", "PUT", `${P}/role-tags`, { tags: [{ employee_ref: "NOBODY-999", role_tag: "STAFF" }] });
ok("an unknown person is refused (422)", s === 422, `${s}`);
[s, j] = await call("admin", "PUT", `${P}/role-tags`, { tags: [{ employee_ref: staffMember.employee_ref, role_tag: "EXECUTIVE" }, { employee_ref: another.employee_ref, role_tag: "STAFF" }, { employee_ref: third.employee_ref, role_tag: "LEADER" }] });
ok("the Client Admin tags three people (200)", s === 200 && j.changed === 3, `${s} ${JSON.stringify(j)}`);
[s, j] = await call("admin", "PUT", `${P}/role-tags`, { tags: [{ employee_ref: staffMember.employee_ref, role_tag: "EXECUTIVE" }] });
ok("tagging the same again changes nothing", s === 200 && j.changed === 0 && j.unchanged === 1, `${s} ${JSON.stringify(j)}`);
const { data: audited } = await svc.from("audit_log").select("action").eq("tenant_id", TID).like("action", "org.role_tags_set%");
ok("tag changes are audited", (audited ?? []).length >= 1, JSON.stringify(audited));

// the tag wins over the grade flag on the survey link
const ppl = (await svc.from("person_of_record").select("person_id, employee_ref, grade_id, role_tag").eq("tenant_id", TID).in("employee_ref", [staffMember.employee_ref, another.employee_ref, third.employee_ref])).data;
const grades = new Map((await svc.from("grade_band").select("grade_id, is_executive").eq("tenant_id", TID)).data.map((g) => [g.grade_id, g.is_executive]));
const issue = await svc.rpc("rpc_issue_person_invitations", { p_assessment_id: AID, p_people: ppl.map((p) => p.person_id) });
ok("links can be issued for the tagged people", !issue.error && issue.data.length === 3, issue.error?.message);
const snapSql = async (ids) => await sql(`select person_id, demographic_snapshot_json from capture.invitation where assessment_id = '${AID}' and person_id in (${ids.map((i) => `'${i}'`).join(",")})`);
const snaps = await snapSql(ppl.map((p) => p.person_id));
const snapOf = (ref) => snaps.find((x) => x.person_id === ppl.find((p) => p.employee_ref === ref).person_id)?.demographic_snapshot_json;
ok("an EXECUTIVE tag makes the link executive, whatever the grade", snapOf(staffMember.employee_ref)?.is_executive === true, JSON.stringify(snapOf(staffMember.employee_ref)));
ok("a STAFF tag makes the link not executive, even on an executive grade", snapOf(another.employee_ref)?.is_executive === false);
ok("a LEADER tag is not executive", snapOf(third.employee_ref)?.is_executive === false);
// an untagged person still follows the grade flag
const untagged = (await svc.from("person_of_record").select("person_id, employee_ref, grade_id").eq("tenant_id", TID).eq("employee_ref", "TG-4")).data[0];
await svc.rpc("rpc_issue_person_invitations", { p_assessment_id: AID, p_people: [untagged.person_id] });
const us = (await snapSql([untagged.person_id]))[0]?.demographic_snapshot_json;
ok("an untagged person follows the grade flag", us?.is_executive === !!grades.get(untagged.grade_id), JSON.stringify(us));

// locked once a link is issued
[s, j] = await call("admin", "PUT", `${P}/role-tags`, { tags: [{ employee_ref: staffMember.employee_ref, role_tag: "STAFF" }] });
ok("a person who has a link cannot be re tagged (409)", s === 409 && j?.locked?.includes(staffMember.employee_ref), `${s} ${JSON.stringify(j)?.slice(0, 160)}`);
[s, j] = await call("admin", "GET", `${P}/role-tags`);
ok("the list marks them locked", j.people.find((p) => p.employee_ref === staffMember.employee_ref)?.locked === true);

// location countries
[s, j] = await call("admin", "GET", `${P}/location-countries`);
ok("the Client Admin reads locations and the organisation's countries", s === 200 && j.locations.length >= 1 && j.countries.includes("KE"), `${s} ${JSON.stringify(j)}`);
const loc = j.locations[0].name;
[s] = await call("admin", "PUT", `${P}/location-countries`, { locations: [{ name: loc, country: "UG" }] });
ok("a country the organisation does not have is refused (422)", s === 422, `${s}`);
[s] = await call("admin", "PUT", `${P}/location-countries`, { locations: [{ name: loc, country: "ke" }] });
ok("a lower case code is refused (422)", s === 422, `${s}`);
[s] = await call("admin", "PUT", `${P}/location-countries`, { locations: [{ name: "Atlantis", country: "KE" }] });
ok("an unknown location is refused (422)", s === 422, `${s}`);
[s] = await call("other", "PUT", `${P}/location-countries`, { locations: [{ name: loc, country: "KE" }] });
ok("another tenant's admin cannot set countries (403)", s === 403, `${s}`);
[s, j] = await call("admin", "PUT", `${P}/location-countries`, { locations: [{ name: loc, country: "KE" }] });
ok("the Client Admin sets a location's country", s === 200 && j.updated === 1, `${s}`);
// a Super Admin adds a country after launch, then it is accepted
await svc.from("tenant").update({ geographies: ["KE", "UG"] }).eq("tenant_id", TID);
[s] = await call("admin", "PUT", `${P}/location-countries`, { locations: [{ name: loc, country: "UG" }] });
ok("a country added by the Super Admin is accepted straight away", s === 200, `${s}`);
await call("admin", "PUT", `${P}/location-countries`, { locations: [{ name: loc, country: "KE" }] });
// the country is on the next link and is a results cut
await sql(`insert into public.person_of_record (tenant_id, employee_ref, email, unit_id, grade_id, location_id, employment_status) values ('${TID}', 'TG-5', 'tg-5@kilima-rehearsal.example', '${tmpl.unit_id}', '${tmpl.grade_id}', ${tmpl.location_id ? `'${tmpl.location_id}'` : "null"}, 'ACTIVE')`);
const p2 = (await svc.from("person_of_record").select("person_id").eq("tenant_id", TID).eq("employee_ref", "TG-5")).data[0];
await svc.rpc("rpc_issue_person_invitations", { p_assessment_id: AID, p_people: [p2.person_id] });
const sn2 = (await snapSql([p2.person_id]))[0]?.demographic_snapshot_json;
ok("the link snapshot carries the country (KE or UNKNOWN for a person with no location)", ["KE", "UNKNOWN"].includes(sn2?.country), JSON.stringify(sn2));
[s, j] = await call("con", "GET", `/v1/assessments/${AID}/segments?axis=country`);
ok("country is an accepted results cut (409 before the data is frozen, never 422)", s !== 422, `${s} ${j?.code}`);
done(`\nClient to remove with cleanup-test-tenants: ${TID}`);
