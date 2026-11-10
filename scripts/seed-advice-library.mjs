// Load an advice library version into the database (Erick #197; owner rounds Q-AL1 to Q-AL25, 31 October 2026).
//   node --env-file=apps/web/.env.local scripts/seed-advice-library.mjs seed/advice_library_1.json [--publish] [--replace]
// The version is written as DRAFT for owner review (Q-AL19); --publish makes it the current version once approved.
// Besides the items in the file, it moves today's playbook in as is (Q-AL1, Q-AL9): the four orientation profiles, the twelve
// scenarios and the twelve pathways, and fills `from_playbook` items with the playbook's actions, 30 day signal, watch list,
// what good looks like and traps. --replace rewrites a DRAFT version of the same label (proposals of unreleased reports are cleared).
import { readFileSync } from "node:fs";
import * as E from "../packages/cdp-engine/dist/index.js";
import { svc } from "./lib/e2e.mjs";

const [file] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!file) { console.error("usage: seed-advice-library.mjs <file.json> [--publish] [--replace]"); process.exit(2); }
const lib = JSON.parse(readFileSync(file, "utf8"));
const db = svc();
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

const NAME = { ENGAGE: "Engage", INNOVATE: "Innovate", PERFORM: "Perform", GOVERN: "Govern" };
const P = E.ORIENTATION_PLAYBOOK, PB = E.RULES_2_0.playbook;
const flat = (o, label) => (o.rows.find((r) => r.label.startsWith(label))?.values ?? []).flat();
const LEVER_OWNER = { PERFORMANCE_MANAGEMENT: "Chief People Officer", PROMOTION: "Chief People Officer", ONBOARDING: "Chief People Officer",
  REWARD: "Chief People Officer and Chief Financial Officer", DECISION_RIGHTS: "Executive team" };

// the playbook parts of an orientation item: what leaders do now, what the organisation sets, the system levers, the 30 day signal
function fromPlaybook(o) {
  const p = P[o], r = PB[o];
  return {
    actions: [
      ...flat(p.actions, "Actions individuals").slice(0, 3).map((text) => ({ text, owner_role: "Leaders at every level", horizon: "0 to 30 days" })),
      ...flat(p.actions, "Priorities the team").slice(0, 2).map((text) => ({ text: `Set as a priority: ${text.charAt(0).toLowerCase()}${text.slice(1)}`, owner_role: "Executive team", horizon: "30 to 90 days" })),
      ...r.levers.map((l) => ({ text: l.text, owner_role: LEVER_OWNER[l.lever] ?? "Executive team", horizon: "3 to 12 months", lever: l.lever })),
    ],
    signal: r.signal,
    watch: r.watch,
    good: flat(p.metrics, "Cultures strong here").slice(0, 4),
    traps: [...flat(p.metrics, "Culture blind spots").slice(0, 3), ...flat(p.metrics, "Leadership blind spot")].slice(0, 4),
  };
}

const moved = [
  // the orientation profiles, shown once at the start of the report (Q-AL23)
  ...Object.keys(NAME).map((o) => {
    const p = P[o], spec = (a) => p.profile.find((x) => x.attribute.startsWith(a))?.specification ?? [];
    return { key: `profile.${o}`, topic: "PROFILE", section: `profile.${o}`, priority: 50, title: `${NAME[o]}: ${p.tagline.split("·")[0].trim()}`,
      diagnosis: p.intro, why: spec("How it creates value").join(" "),
      watch: ["Core focus", "Values", "Leader type", "Relationship to other orientations"].map((a) => `${a}: ${spec(a).join(" ")}`).filter((w) => !w.endsWith(": ")),
      good: spec("Strengths"), traps: spec("Overplay"), rule: {} };
  }),
  // the twelve scenarios: the engine decides when they fire (Q-AL13); the library holds their words
  ...E.SCENARIOS.map(([id, name, , , diagnosis, risks, hypotheses]) => ({ key: `scenario.${id}`, topic: "SCENARIO", section: "checks.pattern", priority: 70,
    title: `Pattern to explore: ${name}`, diagnosis, risks, questions: hypotheses, rule: { fact: "scenario", op: "has", value: id } })),
  // the twelve pathways: from the leading orientation to the one people most want more of
  ...E.RULES_2_0.pathways.map((w) => ({ key: `pathway.${w.from}.${w.to}`, topic: "PATHWAY", section: "roadmap.pathway", priority: 60,
    title: `The pathway from ${NAME[w.from]} to ${NAME[w.to]}`, diagnosis: `The culture leads with ${NAME[w.from]} and people most want more ${NAME[w.to]}. The bridging story: ${w.narrative}`,
    why: `Moving from ${NAME[w.from]} to ${NAME[w.to]} works best when the change is told as using the strength the culture has Now to build the new one, not replacing it.`,
    actions: w.interventions.replace(/\.$/, "").split(/;\s*/).map((t) => ({ text: `${t.charAt(0).toUpperCase()}${t.slice(1)}.`, owner_role: "Executive team", horizon: "3 to 12 months" })),
    rule: { all: [{ fact: "dominant", op: "eq", value: w.from }, { fact: "largest_gap", op: "eq", value: w.to }] } })),
];

const items = [...moved, ...lib.items].map((it) => {
  const base = it.from_playbook ? fromPlaybook(it.from_playbook) : {};
  return { topic: it.topic, level: it.level ?? "ORG", section: it.section, priority: it.priority ?? 50, title: it.title,
    diagnosis: it.diagnosis ?? "", why: it.why ?? "", risks: it.risks ?? [], actions: it.actions ?? base.actions ?? [], questions: it.questions ?? [],
    signal: it.signal ?? base.signal ?? "", watch: it.watch ?? base.watch ?? [], good: it.good ?? base.good ?? [], traps: it.traps ?? base.traps ?? [],
    tags: it.tags ?? {}, rule: it.rule ?? {}, status: "APPROVED" };
});
const keys = [...moved, ...lib.items].map((i) => i.key);
if (new Set(keys).size !== keys.length) throw new Error("duplicate item keys");

let { data: ver } = await db.from("advice_library_version").select("version_id, status").eq("label", lib.label).maybeSingle();
if (ver && ver.status !== "DRAFT") throw new Error(`version ${lib.label} is ${ver.status}; published versions never change`);
if (ver && !process.argv.includes("--replace")) throw new Error(`version ${lib.label} exists; add --replace to rewrite the draft`);
if (ver) {
  must(await db.from("report_advice").delete().eq("version_id", ver.version_id), "clear proposals");
  must(await db.from("advice_item").delete().eq("version_id", ver.version_id), "clear items");
} else ver = must(await db.from("advice_library_version").insert({ label: lib.label }).select("version_id, status").single(), "version");
must(await db.from("advice_item").insert(items.map((i) => ({ ...i, version_id: ver.version_id }))), "items");
if (process.argv.includes("--publish")) {
  must(await db.from("advice_library_version").update({ status: "RETIRED" }).eq("status", "PUBLISHED"), "retire current");
  must(await db.from("advice_library_version").update({ status: "PUBLISHED" }).eq("version_id", ver.version_id), "publish");
}
const by = items.reduce((m, i) => ({ ...m, [i.topic]: (m[i.topic] ?? 0) + 1 }), {});
console.log(`advice library ${lib.label} (${ver.version_id}): ${items.length} items`, by, process.argv.includes("--publish") ? "PUBLISHED" : "DRAFT");
