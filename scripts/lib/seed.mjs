// Shared by the seed scripts: clients, demo users, the agreed setup sections, consent text, engine pre-flight and launch.
// Every write goes through the same tables, RPCs and engine checks the app uses.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import * as E from "../../packages/cdp-engine/dist/index.js";
import { consentText } from "../../apps/web/lib/consent-template.mjs";
import { svc, scoring } from "./e2e.mjs";

export const day = (n) => new Date(Date.now() + n * 864e5).toISOString();
export const isoDate = (s) => s.slice(0, 10);
export const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

/** db (service role), sql (Management API; the app schema is not exposed over REST), user() and writeCreds(). */
export function seedKit(ref, tokenFile) {
  const pat = readFileSync(tokenFile, "utf8").replace(/[\r\n]/g, "");
  const db = svc();
  const sql = async (query, tries = 6) => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST", headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
    });
    // the management API rate limits (429) after many seeds in a row; wait and retry instead of leaving a half seeded client
    if (r.status === 429 && tries > 1) { await new Promise((ok) => setTimeout(ok, (Number(r.headers.get("retry-after")) || 20) * 1000)); return sql(query, tries - 1); }
    if (!r.ok) throw new Error("sql: " + (await r.text()).slice(0, 400));
    return r.json();
  };
  const creds = [];
  /** Creates a confirmed demo user, or returns the existing one. New passwords go to context-sessions/demo-credentials.txt. */
  async function user(email, label) {
    const password = randomBytes(12).toString("base64url") + "Aa1";   // meets the 12+, upper, lower, digit rule
    const r = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (r.error) {
      if (!/already|registered/i.test(r.error.message)) throw new Error(`user ${email}: ${r.error.message}`);
      return must(await db.auth.admin.listUsers({ perPage: 1000 }), "listUsers").users.find((u) => u.email === email).id;
    }
    creds.push(`${label.padEnd(18)} ${email}  ${password}`);
    return r.data.user.id;
  }
  function writeCreds() {
    if (!creds.length) return;
    mkdirSync("context-sessions", { recursive: true });
    const f = "context-sessions/demo-credentials.txt";
    writeFileSync(f, (existsSync(f) ? readFileSync(f, "utf8") : "") + creds.join("\n") + "\n", { mode: 0o600 });
    console.log(`\n${creds.length} new demo user(s); passwords in ${f} (gitignored).`);
    creds.length = 0;
  }
  return { db, sql, user, writeCreds };
}

/** Agreed sections A to I from the oracle fixture's setup, with an organisation context line. */
export function demoSections(fx, context) {
  const s = fx.input.setup;
  return {
    A: { context },
    B: { priorities: s.priorities, business_model: s.business_model, planned_model: s.planned_model },
    C: { note: "Strategy context agreed in workshop." }, D: { note: "Operating model agreed in workshop." }, E: { note: "Executive and HR perspectives reconciled." },
    F: { f1_tags: s.f1_tags, tie_break: null },
    G: { objectives: s.priorities.map((p) => ({ ref: p.ref, text: p.text })), kpi_for: s.kpi_for },
    H: { h1: "Performance management is annual.", contradiction_h1: false },
    I: { consent_text_version: 1, languages: ["en"], cohorts: [{ name: "Executives", axis1: "EXECUTIVE", value1: "YES", rollup_to_parent: true }] },
  };
}

/** The first three people in an executive grade (person ids). Only these count toward the two executive minimum of a workshop record. */
export async function executiveIds(db, tenant) {
  const grades = must(await db.from("grade_band").select("grade_id").eq("tenant_id", tenant.tenant_id).eq("is_executive", true), "executive grades");
  if (!grades.length) return [];
  return must(await db.from("person_of_record").select("person_id").eq("tenant_id", tenant.tenant_id).in("grade_id", grades.map((g) => g.grade_id)).order("employee_ref").limit(3), "executives").map((p) => p.person_id);
}
/** After the org graph is loaded: records those executives as the participants of every agreed section (typed names no longer count). */
export async function setWorkshopExecutives(db, tenant, eng) {
  const ids = await executiveIds(db, tenant);
  if (ids.length < 2) throw new Error("the organisation needs at least two people in an executive grade for the workshop record");
  must(await db.from("setup_record").update({ participants: ids }).eq("engagement_id", eng.engagement_id).eq("perspective", "AGREED"), "workshop participants");
  // the Executive tick on A to D that launch needs (owner ruling 19 October 2026); demo seeds record it under a placeholder user
  const { data: present } = await db.from("setup_record").select("section").eq("engagement_id", eng.engagement_id).eq("perspective", "AGREED").in("section", ["A", "B", "C", "D"]);
  if (present?.length) must(await db.from("setup_confirmation").upsert(present.map((r) => ({ engagement_id: eng.engagement_id, tenant_id: tenant.tenant_id, section: r.section,
    user_id: "00000000-0000-4000-8000-000000000e1e" })), { onConflict: "engagement_id,section,user_id", ignoreDuplicates: true }), "executive ticks");
}

/** Inserts the agreed sections, an approved consent text (demo: empty approver) and a DRAFT assessment. */
export async function draftAssessment(db, { tenant, eng, sections, window }) {
  const workshop = isoDate(day(-30));
  must(await db.from("setup_record").insert(Object.entries(sections).map(([section, payload_json]) => ({
    tenant_id: tenant.tenant_id, engagement_id: eng.engagement_id, section, perspective: "AGREED", payload_json,
    status: "AGREED", workshop_date: workshop, participants: [],   // person ids are set by setWorkshopExecutives once the org graph exists
  }))), "setup_record");
  const ct = consentText({ orgName: tenant.name, privacyRegime: tenant.privacy_regime });
  const consent = must(await db.from("consent_text").insert({
    tenant_id: tenant.tenant_id, privacy_regime: tenant.privacy_regime, version: 1, title: ct.title, body: ct.body, status: "APPROVED", approved_at: new Date().toISOString(),
  }).select().single(), "consent_text");
  const asm = must(await db.from("assessment").insert({
    tenant_id: tenant.tenant_id, engagement_id: eng.engagement_id, instrument_version_id: "ins_v1_1", rules_version_id: process.env.SEED_RULES_VERSION ?? "rul_v2_0",   // SEED_RULES_VERSION=rul_v2_2 seeds a client owned plan
    consent_text_id: consent.consent_text_id, window_open: window.open, window_close: window.close,
  }).select().single(), "assessment");
  return { asm, workshop };
}

/** The engine's pre-flight on the agreed sections (the graph is built valid, so no org defects). Returns the derived setup. */
export function preflightOrThrow({ sections, workshop, window, transferBasisRecorded }) {
  const setupInput = { ...sections.B, ...sections.F, kpi_for: sections.G.kpi_for };
  const derived = E.deriveSetup(setupInput);
  const pf = E.preflight({
    orgDefects: [], sections: Object.fromEntries(Object.keys(sections).map((k) => [k, { status: "AGREED", workshop_date: workshop, executive_participants: 3, has_agreed_perspective: true }])),
    hasPriorityWithGoalType: setupInput.priorities.some((p) => p.goal_type), businessModelSet: !!setupInput.business_model, leadershipTargetResolved: !!derived.leadership_target_orientation,
    scorecard: { objectives: sections.G.objectives.length, kpisWithBaselineAndTarget: Object.values(sections.G.kpi_for).length },
    sectionILocked: true, window: { open: isoDate(window.open), close: isoDate(window.close) }, overlapsLiveAssessment: false, languagesPublished: true,
    consentApproved: true, privacyRegimeSet: true, residencySet: true, outOfRegionProcessing: true, transferBasisRecorded, dpiaRecorded: true, invitationDiff: 0, l360InScope: false, ratersApprovedForAll: true,
  });
  if (!pf.pass) throw new Error("preflight failed: " + JSON.stringify(pf.checks.filter((c) => !c.pass)));
  return { derived, checks: pf.checks.length };
}

/** The same launch function the app calls: locks setup, takes the org graph snapshot, LAUNCHED, FIELDING.
 *  The leaders in scope are counted here in SQL, independently of the app's own code. */
export async function launch(db, sql, { tenant, asm, consultant, window }) {
  const go = E.checkEngagementTransition("SETUP", "FIELDING", "PAC_CONSULTANT", { preflightPassed: true });
  if (go) throw new Error("launch refused: " + go.title);
  const ws = isoDate(window.open);
  const scope = await sql(`select l.assignment_id, t.unit_key as team_key, (select count(*) from public.person_of_record p where p.unit_id = t.unit_id and p.employment_status = 'ACTIVE')::int as headcount_led
    from public.leader_assignment l join public.org_unit t on t.unit_id = l.team_id
    where l.tenant_id = '${tenant.tenant_id}' and l.effect_from <= '${ws}' and (l.effect_to is null or l.effect_to >= '${ws}') order by t.unit_key`);
  const ver = (await sql(`select org_graph_version from public.tenant where tenant_id = '${tenant.tenant_id}'`))[0].org_graph_version;
  must(await db.rpc("rpc_launch_assessment", { p_actor: consultant, p_assessment: asm.assessment_id, p_graph_version: ver, p_window_start: ws, p_scope: scope, p_defects: [] }), "launch");
}

/** Seed shortcut: freeze while the window is still open (the freeze route would refuse), store the set hash, SCORING. */
export async function freezeNow(db, { asm, eng }) {
  const sc = E.checkEngagementTransition("FIELDING", "SCORING", "PAC_CONSULTANT", { windowClosed: true, dataFrozen: true });
  if (sc) throw new Error(sc.title);
  must(await db.from("assessment").update({ status: "FROZEN", frozen_at: new Date().toISOString() }).eq("assessment_id", asm.assessment_id), "freeze");
  const set = must(await scoring().rpc("rpc_frozen_response_set", { p_assessment_id: asm.assessment_id }), "frozen set");
  const hash = E.payloadHash(E.toJsonable(set));
  // the freeze manifest the freeze route writes (counts by state, fielding counts, extensions), so the release gate's appendix is complete
  const rules = must(await db.from("assessment").select("rules_version(semver), instrument_version(semver)").eq("assessment_id", asm.assessment_id).single(), "versions");
  const fc = must(await db.rpc("rpc_fielding_counts", { p_assessment_id: asm.assessment_id }), "fielding counts");
  const states = {};
  for (const r of E.withRules(rules.rules_version.semver, () => E.classifyAll(set)).scored) states[r._state] = (states[r._state] ?? 0) + 1;
  const frozenAt = new Date().toISOString();
  const manifest = { assessment_id: asm.assessment_id, frozen_at: frozenAt, instrument_version: rules.instrument_version.semver, rules_version: rules.rules_version.semver,
    invited: fc.invited ?? 0, started: fc.started ?? 0, submitted: fc.submitted ?? 0, abandoned: (fc.started ?? 0) - (fc.submitted ?? 0), voided: 0, auto_submitted: 0,
    counts_by_state: states, extensions: [], response_set_hash: hash };
  must(await db.from("assessment").update({ response_set_hash: hash, freeze_manifest: manifest }).eq("assessment_id", asm.assessment_id), "set hash");
  must(await db.from("engagement").update({ state: "SCORING" }).eq("engagement_id", eng.engagement_id), "engagement SCORING");
  return set;
}
