// Moves the survey window's closing time a few hours ahead, so a rehearsal can be frozen the same day. Allowed only while the
// assessment is still a draft (before Launch), and only on a client whose name ends in "(rehearsal)".
//   node --env-file=apps/web/.env.local scripts/rehearsal-set-close.mjs "<client name>" [hours=3]
import { svc } from "./lib/e2e.mjs";

const [name, hours = "3"] = process.argv.slice(2);
if (!name || !/\(rehearsal\)$/.test(name)) { console.error('give the client name, which must end in "(rehearsal)"'); process.exit(2); }
const db = svc();
const { data: t } = await db.from("tenant").select("tenant_id").eq("name", name).order("created_at", { ascending: false }).limit(1).maybeSingle();
if (!t) { console.error("no such client"); process.exit(1); }
const { data: a } = await db.from("assessment").select("assessment_id, status").eq("tenant_id", t.tenant_id).maybeSingle();
if (!a) { console.error("create the assessment first (Setup page, Create assessment)"); process.exit(1); }
if (a.status !== "DRAFT") { console.error("the assessment has launched; the window is fixed now"); process.exit(1); }
const close = new Date(Date.now() + Number(hours) * 3600e3).toISOString();
const { error } = await db.from("assessment").update({ window_close: close }).eq("assessment_id", a.assessment_id);
if (error) { console.error(error.message); process.exit(1); }
console.log(`window now closes at ${close}`);
