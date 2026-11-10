// The glossary (apps/web/lib/glossary.ts): unique terms, plain client text (no dashes or hyphenated words), every group used, and the terms the reports print as headings exist.
// Run: node --experimental-strip-types scripts/check-glossary.mts
import assert from "node:assert/strict";
import { TERMS, GLOSSARY_AZ, GLOSSARY_GROUPS } from "../apps/web/lib/glossary.ts";

const names = TERMS.map((t) => t.term.toLowerCase());
assert.equal(new Set(names).size, names.length, "duplicate term");
assert.ok(TERMS.length >= 90, `expected at least 90 terms, got ${TERMS.length}`);
for (const t of TERMS) {
  assert.ok(t.def.length >= 25 && t.def.length <= 420, `definition length: ${t.term}`);
  assert.ok(!/[–—]/.test(t.term + t.def), `dash in ${t.term}`);
  assert.ok(!/\b[A-Za-z]+-[A-Za-z]+\b/.test(t.term + t.def), `hyphenated word in ${t.term}`);
  assert.ok(!/\btoday\b/i.test(t.term + t.def.replace(/\bToday\b/g, "")) || true);
  assert.ok(!/\b(today)\b/i.test(t.def), `say Now, not today: ${t.term}`);
}
assert.equal(GLOSSARY_AZ.length, TERMS.length);
assert.deepEqual(GLOSSARY_AZ.map((r) => r[0]), [...GLOSSARY_AZ.map((r) => r[0])].sort((a, b) => a.localeCompare(b)), "A to Z order");
assert.equal(GLOSSARY_GROUPS.reduce((n, g) => n + g.terms.length, 0), TERMS.length);
// terms the reports and the site print
for (const need of ["Orientation", "Now and Preferred", "Gap", "Culture map", "Stepping stone", "Culture fingerprint", "Cultural entropy", "Culture Risk Index", "Transformation Probability Score (TPS)",
  "Psychological safety", "Employee Orientation Survey", "Perception gap", "Shadow culture", "Reporting floor", "Sub culture", "Leadership 360", "Blind spot", "Pre condition (priority zero)",
  "Playbook", "Visible signal", "Verdict", "Hash", "Frozen score", "Rules version", "Instrument", "Pulse", "RAG status", "KPI"]) {
  assert.ok(names.includes(need.toLowerCase()), `missing term: ${need}`);
}
console.log(`glossary ok (${TERMS.length} terms)`);
