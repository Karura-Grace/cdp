// Action plan end to end. Seeds its own client up to a released report (seed-rich-demo.mjs ... released), then:
// build (idempotent), who sees what before and after, field edits and locks, every engine transition with its role,
// the P0 gate (engine and database), evidence before closing, KPI readings, stale status, and append-only history.
//   node --env-file=apps/web/.env.local scripts/e2e-plan.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { ok, done, svc, signIn } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const NAME = `Plan test ${new Date().toISOString().slice(2, 19).replace(/\D/g, "")}`;
execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-rich-demo.mjs", ref, tokenFile, base, NAME, "released"], { encoding: "utf8" });
const SLUG = NAME.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
const db = svc();
const { data: ten } = await db.from("tenant").select("tenant_id").eq("name", NAME).single();
const { data: asm } = await db.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id;
const who = {
  con: await signIn("consultant@cdp-demo.example"),
  admin: await signIn(`admin.${SLUG}@cdp-demo.example`),
  exec: await signIn(`exec.${SLUG}@cdp-demo.example`),
  other: await signIn("admin.fixture@cdp-demo.example"),
};
const call = async (w, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${who[w].t}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const seen = async (w, table, q = (x) => x) => (await q(who[w].c.from(table).select("*").eq("assessment_id", A))).data ?? [];

// ---------------------------------------------------------------- build
let [s, j] = await call("admin", "POST", `/v1/assessments/${A}/plan`, {});
ok("client admin cannot build the plan", s === 403, `${s}`);
[s, j] = await call("con", "POST", `/v1/assessments/${A}/plan`, {});
ok("consultant builds the plan", s === 201 && j.created === true, `${s} ${j?.code} ${j?.title}`);
const V = j.score_version;
[s, j] = await call("con", "POST", `/v1/assessments/${A}/plan`, {});
ok("building again is idempotent", s === 200 && j.created === false, `${s}`);
const { data: acts } = await db.from("action").select("*").eq("assessment_id", A).eq("score_version", V).order("engine_ref");
const { data: pris } = await db.from("priority").select("*").eq("assessment_id", A).eq("score_version", V);
ok("priorities and actions stored", pris.length > 0 && acts.length > 0, `${pris.length} ${acts.length}`);
ok("every action starts as a rules-engine DRAFT", acts.every((x) => x.status === "DRAFT" && x.generated_by === "RULES_ENGINE"));
ok("client roles see no draft actions", (await seen("exec", "action")).length === 0 && (await seen("admin", "action")).length === 0);
ok("another tenant sees nothing", (await seen("other", "plan")).length === 0 && (await seen("other", "action")).length === 0);
ok("the consultant sees every action", (await seen("con", "action")).length === acts.length);

// pick an action whose priority is blocked by a finding a P0 item covers, if there is one
const { data: p0 } = await db.from("priority_zero_item").select("*").eq("assessment_id", A).eq("score_version", V);
ok("the engine blocked at least one priority behind an open P0 item (so the gate is tested)", pris.some((p) => p.blocked_by.length) && p0.some((z) => !z.completed_at));
const gated = pris.find((p) => p.blocked_by.length && p0.some((z) => !z.completed_at && p.blocked_by.some((f) => z.finding_ids.includes(f))));
const X = (gated ? acts.find((x) => x.priority_id === gated.priority_id && x.status === "DRAFT") : null) ?? acts.find((x) => x.status === "DRAFT");
const path = `/v1/actions/${X.action_id}`;

// ---------------------------------------------------------------- fields and early moves
[s] = await call("admin", "PATCH", path, { fields: { owner: "Someone" } });
ok("client admin cannot edit plan fields", s === 403, `${s}`);
[s] = await call("con", "PATCH", path, { fields: { owner: "x".repeat(300) } });
ok("an over-long owner is refused", s === 422, `${s}`);
[s] = await call("con", "PATCH", path, { fields: { baseline_value: "abc" } });
ok("a non-numeric baseline is refused", s === 422, `${s}`);
[s] = await call("con", "PATCH", path, { fields: { status: "PUBLISHED" } });
ok("status cannot be set as a field", s === 422, `${s}`);
[s, j] = await call("con", "PATCH", path, { to: "PUBLISHED" });
ok("DRAFT straight to PUBLISHED refused (engine)", s === 409 && j.code === "ILLEGAL_TRANSITION", `${s} ${j?.code}`);
[s, j] = await call("con", "PATCH", path, { to: "IN_REVIEW" });
ok("consultant sends for review", s === 200, `${s} ${j?.code}`);
[s, j] = await call("con", "PATCH", path, { to: "IN_CO_DESIGN" });
ok("consultant starts co-design", s === 200, `${s}`);
ok("an executive now sees the action (co-design)", (await seen("exec", "action", (q) => q.eq("action_id", X.action_id))).length === 1);
[s, j] = await call("exec", "PATCH", path, { to: "APPROVED" });
ok("approval refused until owner, sponsor, KPI, baseline, target and dates are set", s === 422 && j.code === "VALIDATION_FAILED", `${s} ${j?.code} ${j?.title}`);
[s] = await call("con", "PATCH", path, { fields: { owner: "Head of Operations", sponsor: "CEO", kpi: X.kpi ?? "Voluntary attrition (%)", baseline_value: X.baseline_value ?? "19", target_value: X.target_value ?? "13" } });
ok("consultant completes the mandatory fields", s === 200, `${s}`);
[s, j] = await call("con", "PATCH", path, { to: "APPROVED" });
ok("a consultant cannot approve (engine role rule)", s === 403 && j.code === "FORBIDDEN", `${s} ${j?.code}`);
[s, j] = await call("exec", "PATCH", path, { to: "APPROVED" });
ok("the executive approves", s === 200, `${s} ${j?.code} ${j?.title}`);
[s, j] = await call("con", "PATCH", path, { fields: { owner: "Someone else" } });
ok("fields are locked once approved (database)", s === 409, `${s} ${j?.code}`);

// ---------------------------------------------------------------- the P0 gate
const blockers = (pris.find((p) => p.priority_id === X.priority_id)?.blocked_by ?? []);
if (blockers.length) {
  [s, j] = await call("con", "PATCH", path, { to: "PUBLISHED" });
  ok("publishing refused while a pre-condition is open (engine)", s === 409 && j.code === "BLOCKING_GATE_OPEN", `${s} ${j?.code}`);
  const direct = await db.rpc("rpc_action_transition", { p_actor: (await who.con.c.auth.getUser()).data.user.id, p_action: X.action_id, p_from: "APPROVED", p_to: "PUBLISHED", p_reason: "" });
  ok("and refused by the database when called directly", !!direct.error && /BLOCKING_GATE_OPEN/.test(direct.error.message), direct.error?.message);
  for (const z of p0.filter((z) => !z.completed_at && z.finding_ids.some((f) => blockers.includes(f)))) {
    [s] = await call("admin", "POST", `/v1/assessments/${A}/p0/${z.item_id}`, { score_version: V, note: "Workshop held" });
    ok("client admin cannot complete a P0 item", s === 403, `${s}`);
    [s, j] = await call("exec", "POST", `/v1/assessments/${A}/p0/${z.item_id}`, { score_version: V, note: "x" });
    ok("a P0 note under 3 characters is refused", s === 422, `${s}`);
    [s, j] = await call("exec", "POST", `/v1/assessments/${A}/p0/${z.item_id}`, { score_version: V, note: "Perception-gap workshop held with the executive team." });
    ok(`the executive completes ${z.item_id}`, s === 200, `${s} ${j?.code} ${j?.title}`);
  }
  const stillOpen = blockers.filter((f) => !p0.some((z) => z.finding_ids.includes(f)));
  if (stillOpen.length) console.log("note: blocking findings with no P0 item:", stillOpen.join(", "));
}
[s, j] = await call("con", "PATCH", path, { to: "PUBLISHED" });
ok("consultant publishes once the gate is clear", s === 200, `${s} ${j?.code} ${j?.title}`);
[s, j] = await call("con", "PATCH", path, { to: "PUBLISHED" });
ok("the same move again is refused (no such transition)", s === 409, `${s} ${j?.code}`);
const uid = (await who.con.c.auth.getUser()).data.user.id;
const stale = await db.rpc("rpc_action_transition", { p_actor: uid, p_action: X.action_id, p_from: "APPROVED", p_to: "PUBLISHED", p_reason: "" });
ok("a stale status is refused by the database", !!stale.error && /ILLEGAL_TRANSITION/.test(stale.error.message), stale.error?.message);
const raw = await db.from("action").update({ status: "CLOSED" }).eq("action_id", X.action_id);
ok("a raw status update is refused by the database", !!raw.error, "updated");

// ---------------------------------------------------------------- tracking
[s, j] = await call("exec", "PATCH", path, { to: "IN_PROGRESS" });
ok("the executive starts it", s === 200, `${s} ${j?.code}`);
[s] = await call("admin", "POST", `${path}/kpi-readings`, { value: "abc", read_on: "2026-10-01" });
ok("a non-numeric reading is refused", s === 422, `${s}`);
[s] = await call("admin", "POST", `${path}/kpi-readings`, { value: "17.5", read_on: new Date().toISOString().slice(0, 10), note: "Q4 first month" });
ok("client admin records a KPI reading", s === 201, `${s}`);
[s] = await call("exec", "PATCH", path, { to: "UNDER_REVIEW" });
ok("the executive sends it for review", s === 200, `${s}`);
[s, j] = await call("exec", "PATCH", path, { to: "CLOSED" });
ok("closing refused without evidence (engine)", s === 409 && j.code === "EVIDENCE_REQUIRED", `${s} ${j?.code}`);
[s] = await call("exec", "POST", `${path}/evidence`, { kind: "MINUTES", description: "ExCo minutes", link: "http://not-https.example" });
ok("evidence with a non-https link is refused", s === 422, `${s}`);
[s] = await call("exec", "POST", `${path}/evidence`, { kind: "MINUTES", description: "ExCo minutes recording the new recognition ritual" });
ok("the executive adds evidence", s === 201, `${s}`);
// evidence files in R2: signed upload, server-side check of the stored object, signed download, scope
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
[s, j] = await call("exec", "POST", `${path}/evidence/upload`, { file_name: "notes.exe", size: 10, content_type: "application/x-msdownload" });
ok("an executable is refused before upload", s === 422, `${s}`);
[s, j] = await call("exec", "POST", `${path}/evidence/upload`, { file_name: "big.pdf", size: 21 * 1024 * 1024, content_type: "application/pdf" });
ok("a file over 20 MB is refused before upload", s === 422, `${s}`);
[s, j] = await call("other", "POST", `${path}/evidence/upload`, { file_name: "x.pdf", size: pdf.length, content_type: "application/pdf" });
ok("another tenant cannot get an upload link", s === 403, `${s}`);
[s, j] = await call("exec", "POST", `${path}/evidence/upload`, { file_name: "ExCo minutes.pdf", size: pdf.length, content_type: "application/pdf" });
ok("the executive gets a 5-minute upload link", s === 201 && /^https:\/\/[^/]+\.r2\.cloudflarestorage\.com\//.test(j.url) && j.key.startsWith(`evidence/${ten.tenant_id}/${X.action_id}/`), `${s} ${j?.code} ${j?.title}`);
const up = j;
const wrongType = await fetch(up.url, { method: "PUT", headers: { "content-type": "text/plain" }, body: pdf });
ok("R2 refuses an upload whose type differs from the signed one", !wrongType.ok, `${wrongType.status}`);
const put = await fetch(up.url, { method: "PUT", headers: { "content-type": "application/pdf" }, body: pdf });
ok("the file uploads straight to R2", put.ok, `${put.status}`);
[s, j] = await call("exec", "POST", `${path}/evidence`, { kind: "DOCUMENT", description: "Signed recognition policy", file_key: `evidence/${ten.tenant_id}/act_other/x.pdf` });
ok("a file key outside this action is refused", s === 422, `${s}`);
[s, j] = await call("exec", "POST", `${path}/evidence`, { kind: "DOCUMENT", description: "Signed recognition policy", file_key: up.key, file_name: "ExCo minutes.pdf", link: "https://example.com" });
ok("a file and a link together are refused", s === 422, `${s}`);
[s, j] = await call("exec", "POST", `${path}/evidence`, { kind: "DOCUMENT", description: "Signed recognition policy", file_key: up.key, file_name: "ExCo minutes.pdf" });
ok("the uploaded file is recorded as evidence", s === 201 && j.file?.size === pdf.length, `${s} ${j?.code} ${j?.title}`);
const evId = j.evidence_id;
const dl = await fetch(`${base}/v1/evidence/${evId}/file`, { headers: { authorization: `Bearer ${who.admin.t}` }, redirect: "manual" });
const signed = dl.headers.get("location") ?? "";
ok("a client admin gets a signed download link", dl.status === 302 && signed.includes("X-Amz-Signature") && signed.includes("X-Amz-Expires=300"), `${dl.status}`);
const got = signed ? await fetch(signed) : null;
ok("the download returns the same file", got?.ok && Buffer.from(await got.arrayBuffer()).equals(pdf), `${got?.status}`);
const dl2 = await fetch(`${base}/v1/evidence/${evId}/file`, { headers: { authorization: `Bearer ${who.other.t}` }, redirect: "manual" });
ok("another tenant cannot download it", dl2.status === 404, `${dl2.status}`);
const bare = await fetch(signed.split("?")[0]);
ok("the object is not public without a signature", bare.status === 400 || bare.status === 403, `${bare.status}`);

[s, j] = await call("exec", "PATCH", path, { to: "CLOSED" });
ok("the executive closes it", s === 200, `${s} ${j?.code} ${j?.title}`);

// ---------------------------------------------------------------- history and discards
const { data: evs } = await db.from("action_event").select("to_status").eq("action_id", X.action_id).order("at");
ok("every move is in the history", evs.map((e) => e.to_status).join(">") === "IN_REVIEW>IN_CO_DESIGN>APPROVED>PUBLISHED>IN_PROGRESS>UNDER_REVIEW>CLOSED", evs.map((e) => e.to_status).join(">"));
const hdel = await db.from("action_event").delete().eq("action_id", X.action_id);
const rdel = await db.from("kpi_reading").delete().eq("action_id", X.action_id);
ok("history and readings are append-only", !!hdel.error && !!rdel.error);
const Y = acts.find((x) => x.action_id !== X.action_id && x.status === "DRAFT");
if (Y) {
  [s, j] = await call("con", "PATCH", `/v1/actions/${Y.action_id}`, { to: "DISCARDED" });
  ok("a discard needs a reason (engine)", s === 422, `${s} ${j?.code}`);
  [s] = await call("con", "PATCH", `/v1/actions/${Y.action_id}`, { to: "DISCARDED", reason: "Covered by the HR redesign action" });
  ok("consultant discards with a reason", s === 200, `${s}`);
  ok("a discarded action stays hidden from the client", (await seen("exec", "action", (q) => q.eq("action_id", Y.action_id))).length === 0);
}
[s] = await call("other", "PATCH", path, { to: "RETIRED", reason: "x" });
ok("another tenant cannot touch the action", s === 403, `${s}`);
done();
