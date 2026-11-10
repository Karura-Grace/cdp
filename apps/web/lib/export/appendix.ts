import type { LoadedReport } from "../report-data";

/** Technical appendix rows: versions and hashes, then the org graph checks and every override with its reason (spec §1.6.1). */
export function appendixRows(l: LoadedReport): [string, string][] {
  const { rep, score: s } = l;
  const rows: [string, string][] = [
    ["Instrument version", s.instrument_version], ["Rules version", s.rules_version],
    ["Score version", `${rep.score_version}${l.frozenAt ? ` (frozen ${l.frozenAt.slice(0, 10)})` : ""}`],
    ["Score hash", l.scoreHash], ["Report hash", rep.payload_hash ?? ""], ["Evaluation hash", l.evaluationHash ?? "n/a"],
  ];
  if (l.version) {
    rows.push(["Setup version", String(l.version.setup_version)]);
    if (l.version.supersedes) rows.push(["Replaces assessment", l.version.supersedes], ["Reason for this version", l.version.reason ?? "not recorded"]);
  }
  const ov = Object.entries(l.org.overrides);
  rows.push(["Organisation graph checks", !l.org.recorded ? "Not recorded: this engagement launched before the organisation graph checks existed."
    : ov.length ? `Launched with ${ov.length} blocking rule(s) overridden by a consultant (listed below).` : "All blocking rules (V1 to V7) passed at launch. No overrides."]);
  ov.forEach(([r, why]) => rows.push([`Override ${r}`, why]));
  l.org.warnings.forEach((w) => rows.push(["Graph warning at launch", w]));
  rows.push(...l.appendixParts.flatMap((p) => p.rows));
  return rows;
}
