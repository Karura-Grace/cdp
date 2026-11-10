// Appendix C: the item bank in the spec (Tables 108 to 113) against what respondents get: the instrument tables in the
// database (scenario, scenario_statement, item; read only) and the Leadership 360 items in apps/web/lib/l360-items.json.
// Text is compared exactly and, if that fails, after normalising quotes, dashes and spaces (reported separately).
//   node --env-file=apps/web/.env.local scripts/conformance/probes/item-bank.mjs
import { readFileSync } from "node:fs";
import { ok, done, svc } from "../../lib/e2e.mjs";

const spec = readFileSync("docs/spec/CDP_Platform_Developer_Specification_v2_1.md", "utf8");
const table = (n) => { const s = spec.indexOf(`**Table ${n} `); const e = spec.indexOf("**Table ", s + 10); return spec.slice(s, e > 0 ? e : undefined); };
const rows = (t) => t.split("\n").filter((l) => /^\| [A-Z]/.test(l) && !/^\| \*\*/.test(l)).map((l) => l.replace(/^\| | \|$/g, "").split(" | ").map((c) => c.trim()));
const norm = (s) => String(s ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
const cmp = (id, label, want, have) => {
  if (have === undefined || have === null) return ok(`[${id}] ${label} present`, false, "missing in the platform");
  if (want === have) return ok(`[${id}] ${label} matches exactly`, true);
  ok(`[${id}] ${label} matches (ignoring quote, dash and space style)`, norm(want) === norm(have), `spec: ${want.slice(0, 120)} | platform: ${String(have).slice(0, 120)}`);
};

const db = svc();
const [{ data: ver }] = [await db.from("instrument_version").select("version_id, semver").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(1).single()];
ok("[APPC-version] published instrument version is 1.1", ver?.semver === "1.1", ver?.semver);
const v = ver.version_id;
const [{ data: scen }, { data: sts }, { data: items }] = await Promise.all([
  db.from("scenario").select("scenario_id, dimension, sequence, title, prompt_now, prompt_preferred").eq("version_id", v),
  db.from("scenario_statement").select("scenario_id, orientation, text").eq("version_id", v),
  db.from("item").select("item_id, block, dimension, sequence, title, canonical_text").eq("version_id", v),
]);
const O = { E: "ENGAGE", I: "INNOVATE", P: "PERFORM", G: "GOVERN" };

// Table 108 scenarios
const t108 = rows(table(108));
ok("[APPC-T108] 18 scenarios in the spec and the platform", t108.length === 18 && scen.length === 18, `${t108.length} / ${scen.length}`);
for (const [id, , title, now, pref] of t108) {
  const s = scen.find((x) => x.scenario_id === id);
  cmp(`APPC-${id}`, `${id} title`, title, s?.title);
  cmp(`APPC-${id}`, `${id} NOW prompt`, now, s?.prompt_now);
  cmp(`APPC-${id}`, `${id} PREFERRED prompt`, pref, s?.prompt_preferred?.replace(/^PREFERRED perspective:\s*/i, ""));
}
// Table 109 statements
const t109 = rows(table(109));
ok("[APPC-T109] 72 statements in the spec and the platform", t109.length === 72 && sts.length === 72, `${t109.length} / ${sts.length}`);
for (const [sid, orient, text] of t109) {
  const [d, s, o] = sid.split("-");
  cmp(`APPC-${sid}`, `${sid} (${orient})`, text, sts.find((x) => x.scenario_id === `${d}-${s}` && x.orientation === O[o])?.text);
}
// Table 110 readiness items
const t110 = rows(table(110));
ok("[APPC-T110] 36 readiness items", t110.length === 36 && items.filter((i) => i.block === "LIKERT").length === 36);
for (const [iid, , text] of t110) cmp(`APPC-${iid}`, iid, text, items.find((i) => i.item_id === iid)?.canonical_text);
// Table 111 eOS (platform ids EOS-1..8, spec EOS-Q1..Q8)
const t111 = rows(table(111));
ok("[APPC-T111] 8 eOS items", t111.length === 8 && items.filter((i) => i.block === "EOS").length === 8);
for (const [iid, , text] of t111) cmp(`APPC-${iid}`, iid, text, items.find((i) => i.item_id === iid.replace("EOS-Q", "EOS-"))?.canonical_text);
ok("[APPC-T111-ids] eOS item ids match the spec (EOS-Q1 form)", items.some((i) => i.item_id === "EOS-Q1"), "platform uses EOS-1 to EOS-8");
// Table 112 qualitative (platform ids Q1..Q3)
const t112 = rows(table(112));
for (const [iid, title, text] of t112) {
  const it = items.find((i) => i.item_id === iid.replace("QUAL-", ""));
  cmp(`APPC-${iid}`, `${iid} text`, text, it?.canonical_text);
}
ok("[APPC-T112-ids] qualitative item ids match the spec (QUAL-Q1 form)", items.some((i) => i.item_id === "QUAL-Q1"), "platform uses Q1 to Q3");
// Table 113 Leadership 360
const L = JSON.parse(readFileSync("apps/web/lib/l360-items.json", "utf8"));
const t113 = rows(table(113));
ok("[APPC-T113] 60 Leadership 360 items", t113.length === 60 && L.self.length === 60 && L.rater.length === 60, `${t113.length}`);
t113.forEach(([iid, , self, rater], i) => { cmp(`APPC-${iid}`, `${iid} self form`, self, L.self[i]); cmp(`APPC-${iid}`, `${iid} rater form`, rater, L.rater[i]); });
done();
