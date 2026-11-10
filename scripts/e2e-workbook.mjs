// The Workshop 1 workbook end to end (owner rulings Q-WS1, Q-WS2): download a blank Excel workbook (one sheet per setup section A to I), fill it in, upload it as versions,
// review the changes, mark one version final, and check that only the final version reaches Setup, nothing is overwritten and every role is held to its place.
//   node --env-file=apps/web/.env.local scripts/e2e-workbook.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { ok, done, URL_, ANON, pwOf, passwords } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const out = execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-demo.mjs", ref, tokenFile, "bare"], { encoding: "utf8" });
const [, tenantId, E] = /: (ten_\S+) \/ (eng_\S+) BARE/.exec(out);
const adminEmail = Object.keys(passwords()).filter((e) => /^admin\.bare\d+@/.test(e)).at(-1);
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const login = async (em) => {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: em, password: pwOf(em) });
  if (error) throw new Error(em + ": " + error.message);
  return data.session.access_token;
};
const T = { con: await login("consultant@cdp-demo.example"), admin: await login(adminEmail) };
const call = async (who, method, path, body, raw = false) => {
  const r = await fetch(base + path, { method, headers: { ...(who ? { authorization: `Bearer ${T[who]}` } : {}), ...(raw ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  return r;
};
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const W = `/v1/engagements/${E}/setup/workbook`;

// ---- an open setup (the assessment must exist for Setup to be in use)
let r = await call("con", "POST", `/v1/engagements/${E}/assessments`, { window_open: day(-15), window_close: day(1) });
ok("assessment created", r.status === 201, r.status);

// ---- roles
r = await call(null, "GET", W);
ok("no session: 401 on the workbook download", r.status === 401, r.status);
r = await call("admin", "GET", W);
ok("a client admin cannot download the workbook (403)", r.status === 403, r.status);
r = await call("admin", "POST", W, Buffer.from("x"), true);
ok("a client admin cannot upload one (403)", r.status === 403, r.status);

// ---- the blank workbook
r = await call("con", "GET", W);
ok("the consultant downloads a blank workbook (xlsx)", r.status === 200 && /spreadsheetml/.test(r.headers.get("content-type") ?? ""), r.status);
const blank = Buffer.from(await r.arrayBuffer());
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(blank);
const names = wb.worksheets.map((w) => w.name);
ok("it has a cover and one sheet for each of the sections A to I", names[0] === "Cover" && "ABCDEFGHI".split("").every((s) => names.some((n) => n.startsWith(s + " "))), names.join(" | "));
ok("every sheet has a hidden path column, a question, guidance and an answer column", wb.worksheets.slice(1).every((w) => w.getRow(1).getCell(2).value === "Question" && w.getColumn(1).hidden === true && w.getRow(1).getCell(4).value === "Answer"));
const sheetA = wb.worksheets.find((w) => w.name.startsWith("A "));
const rowOf = (ws, path) => { let found = null; ws.eachRow((row) => { if (row.getCell(1).value === path) found = row; }); return found; };
ok("an enum question carries a drop down", !!rowOf(sheetA, "maturity")?.getCell(4).dataValidation?.formulae?.length);

// ---- not a workbook, then a bad answer
r = await call("con", "POST", W, Buffer.from("not an excel file"), true);
ok("a file that is not a workbook is refused (422)", r.status === 422, r.status);
const wrong = new ExcelJS.Workbook(); wrong.addWorksheet("Sheet1").addRow(["hello"]);
r = await call("con", "POST", W, Buffer.from(await wrong.xlsx.writeBuffer()), true);
ok("an Excel file that is not the CDP workbook is refused (422)", r.status === 422, r.status);

// ---- fill the workbook in (version 1 with a bad enum, version 2 corrected, version 3 changed after review)
const fill = async (edit) => {
  const w = new ExcelJS.Workbook(); await w.xlsx.load(blank);
  edit((name, path, val) => { const ws = w.worksheets.find((x) => x.name.startsWith(name + " ")); const row = rowOf(ws, path); if (!row) throw new Error(`no row ${name} ${path}`); row.getCell(4).value = val; });
  return Buffer.from(await w.xlsx.writeBuffer());
};
const v1 = await fill((put) => { put("A", "maturity", "NOT_A_STAGE"); put("A", "trigger", "A new three year strategy and rising attrition in the field."); });
r = await call("con", "POST", W, v1, true);
let j = await r.json();
ok("version 1 is stored with its problems listed (a wrong drop down value)", r.status === 201 && j.version_no === 1 && j.clean === false && !!j.problems?.A?.length, JSON.stringify(j).slice(0, 200));
const bad = j.version_id;
r = await call("con", "POST", `${W}/final`, { version_id: bad });
ok("a version with problems cannot be marked final (422)", r.status === 422, r.status);

const v2 = await fill((put) => { put("A", "maturity", "GROWTH"); put("A", "trigger", "A new three year strategy and rising attrition in the field."); put("A", "sponsor_name", "Grace Wanjiru"); put("A", "sponsor_role", "Managing Director"); });
r = await call("con", "POST", W, v2, true); j = await r.json();
ok("version 2 is clean", r.status === 201 && j.version_no === 2 && j.clean === true, JSON.stringify(j).slice(0, 200));
ok("the change list names what changed since version 1", Array.isArray(j.changes) && j.changes.some((c) => c.path === "maturity" && c.now === "GROWTH") && j.changes.some((c) => c.path === "sponsor_name"), JSON.stringify(j.changes?.slice(0, 3)));
const good = j.version_id;
r = await call("con", "POST", W, v2, true); j = await r.json();
ok("uploading the same file again changes nothing", r.status === 200 && j.changed === false, JSON.stringify(j));

// ---- nothing reaches Setup until a version is marked final
let { data: rec } = await svc.from("setup_record").select("payload_json, status").eq("engagement_id", E).eq("section", "A").eq("perspective", "AGREED").maybeSingle();
ok("before it is marked final nothing is written to Setup", !rec || !rec.payload_json?.sponsor_name, JSON.stringify(rec));
r = await call("admin", "POST", `${W}/final`, { version_id: good });
ok("a client admin cannot mark a version final (403)", r.status === 403, r.status);
r = await call("con", "POST", `${W}/final`, { version_id: good }); j = await r.json();
ok("the consultant marks version 2 final", r.status === 200 && j.sections_written.includes("A"), JSON.stringify(j));
({ data: rec } = await svc.from("setup_record").select("payload_json, status").eq("engagement_id", E).eq("section", "A").eq("perspective", "AGREED").single());
ok("the final version fills Setup section A as a DRAFT, not as agreed", rec.payload_json.maturity === "GROWTH" && rec.payload_json.sponsor_name === "Grace Wanjiru" && rec.status === "DRAFT", JSON.stringify(rec));

// ---- review and change, upload again: a new version, the old ones stay, Setup does not move until the new one is final
const v3 = await fill((put) => { put("A", "maturity", "MATURE"); put("A", "trigger", "A new three year strategy and rising attrition in the field."); put("A", "sponsor_name", "Grace Wanjiru"); put("A", "sponsor_role", "Managing Director"); });
r = await call("con", "POST", W, v3, true); j = await r.json();
ok("version 3 (after review) is a new version", r.status === 201 && j.version_no === 3 && j.clean === true, JSON.stringify(j).slice(0, 160));
({ data: rec } = await svc.from("setup_record").select("payload_json").eq("engagement_id", E).eq("section", "A").eq("perspective", "AGREED").single());
ok("Setup still holds the final version 2 answer until version 3 is marked final", rec.payload_json.maturity === "GROWTH", rec.payload_json.maturity);
const v3id = j.version_id;
r = await call("con", "POST", `${W}/final`, { version_id: v3id });
({ data: rec } = await svc.from("setup_record").select("payload_json").eq("engagement_id", E).eq("section", "A").eq("perspective", "AGREED").single());
ok("marking version 3 final moves Setup to it", r.status === 200 && rec.payload_json.maturity === "MATURE", r.status);
const { data: vers } = await svc.from("setup_workbook_version").select("version_no, clean").eq("engagement_id", E).order("version_no");
ok("every version is kept, in order", vers.map((v) => v.version_no).join() === "1,2,3", JSON.stringify(vers));
const hist = await (await call("con", "GET", `${W}/versions`)).json();
ok("the version list says which one is final and is newest first", hist.final_version_id === v3id && hist.versions[0].version_no === 3, JSON.stringify(hist).slice(0, 160));
const prefilled = Buffer.from(await (await call("con", "GET", `${W}?version=${good}`)).arrayBuffer());
const pw = new ExcelJS.Workbook(); await pw.xlsx.load(prefilled);
ok("an old version can be downloaded again with its own answers", rowOf(pw.worksheets.find((w) => w.name.startsWith("A ")), "maturity")?.getCell(4).value === "GROWTH");

// ---- append only
const upd = await svc.from("setup_workbook_version").update({ clean: false }).eq("engagement_id", E);
const del = await svc.from("setup_workbook_version").delete().eq("engagement_id", E);
ok("a version can be neither changed nor removed (database)", !!upd.error && !!del.error, JSON.stringify([upd.error?.message, del.error?.message]));
const fdel = await svc.from("setup_workbook_final").delete().eq("engagement_id", E);
ok("the final marks cannot be removed either", !!fdel.error);
ok("a client admin cannot read the versions through the data api", ((await (await fetch(`${URL_}/rest/v1/setup_workbook_version?select=version_id&engagement_id=eq.${E}`, { headers: { apikey: ANON, authorization: `Bearer ${T.admin}` } })).json()) ?? []).length === 0);
done();
