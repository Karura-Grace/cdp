// Unit checks for the CSV parser and the row mapping (no database, no server).
import * as C from "../apps/web/lib/org-csv.ts";
let fail = 0;
const ok = (n, c, x = "") => { if (!c) fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : x); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok("plain rows", eq(C.parseCsv("a,b\n1,2\n"), [["a", "b"], ["1", "2"]]));
ok("CRLF and a missing final newline", eq(C.parseCsv("a,b\r\n1,2"), [["a", "b"], ["1", "2"]]));
ok("a BOM is dropped", eq(C.parseCsv("﻿a,b\n1,2"), [["a", "b"], ["1", "2"]]));
ok("quoted comma, doubled quote and newline", eq(C.parseCsv('a,b\n"x, y","say ""hi""\nthere"\n'), [["a", "b"], ["x, y", 'say "hi"\nthere']]));
ok("empty fields are kept", eq(C.parseCsv("a,b,c\n1,,3\n,,\n"), [["a", "b", "c"], ["1", "", "3"]]));
ok("blank lines are skipped", eq(C.parseCsv("a\n\n1\n\n"), [["a"], ["1"]]));
ok("an unclosed quote throws", (() => { try { C.parseCsv('a\n"x'); return false; } catch { return true; } })());
ok("a quote in the middle of an unquoted field is kept", eq(C.parseCsv('a\nab"c\n'), [["a"], ['ab"c']]));

ok("csvCell quotes commas", C.csvCell("a,b") === '"a,b"');
ok("csvCell doubles quotes", C.csvCell('a"b') === '"a""b"');
ok("csvCell neutralises formulas", ["=1+1", "+1", "-1", "@x", "\tx"].every((v) => C.csvCell(v).startsWith("'") || C.csvCell(v).startsWith("\"'")));
ok("csvCell leaves numbers and empties", C.csvCell(5) === "5" && C.csvCell(null) === "");
ok("toCsv round-trips through parseCsv", eq(C.parseCsv(C.toCsv([["a", "b"], ["x,y", 'q"r'], ["=SUM(A1)", ""]])), [["a", "b"], ["x,y", 'q"r'], ["'=SUM(A1)", ""]]));

for (const k of Object.keys(C.TEMPLATES)) { const r = C.parseKind(k, C.TEMPLATES[k]); ok(`the ${k} template parses with no errors`, r.errors.length === 0 && r.rows.length > 0, r.errors.join("; ")); }
const g = C.parseKind("grades", "Name, Rank_Order ,IS_EXECUTIVE\nBoard,1,YES\nStaff,2,\n");
ok("headers are case-insensitive and trimmed; booleans parse", g.errors.length === 0 && eq(g.rows, [{ name: "Board", rank_order: 1, is_executive: true }, { name: "Staff", rank_order: 2, is_executive: false }]), JSON.stringify(g));
ok("an unknown column is refused", C.parseKind("grades", "name,rank_order,colour\nA,1,red\n").errors[0].includes('Unknown column "colour"'));
ok("a missing required column is refused", C.parseKind("people", "employee_ref,email\nE1,a@b.c\n").errors.some((e) => e.includes("employment_status")));
ok("a repeated column is refused", C.parseKind("locations", "name,name\nA,B\n").errors.some((e) => e.includes("twice")));
ok("an empty file is refused", C.parseKind("units", "").errors[0].includes("empty"));
ok("a header with no rows is refused", C.parseKind("units", "unit_key,name,type\n").errors[0].includes("no rows"));
const bad = C.parseKind("people", "employee_ref,email,employment_status,unit_key,grade,location\nE1,a@b.c,RETIRED,,,\n,x@y.z,ACTIVE,,,\n");
ok("row errors name the file row (header is row 1)", bad.errors.some((e) => e.startsWith("Row 2:") && e.includes("employment_status")) && bad.errors.some((e) => e.startsWith("Row 3:") && e.includes("employee_ref")), bad.errors.join("; "));
ok("nothing is returned when a row is wrong", bad.rows.length === 0);
ok("rank_order must be a whole number", C.parseKind("grades", "name,rank_order\nA,1.5\n").errors.some((e) => e.includes("whole number")));
ok("a bad date is refused", C.parseKind("leaders", "employee_ref,team_key,effect_from\nE1,T,2026-02-30\n").errors.some((e) => e.includes("effect_from")));
ok("an empty effect_to means open ended", C.parseKind("leaders", "employee_ref,team_key,effect_from,effect_to\nE1,T,2026-01-01,\n").rows[0].effect_to === null);
ok("a row with too many fields is refused", C.parseKind("locations", "name\nA,B\n").errors.some((e) => e.includes("more fields")));
ok("unit type is upper-cased", C.parseKind("units", "unit_key,name,type\nT,Team,team\n").rows[0].type === "TEAM");
ok("an invalid unit type is refused", C.parseKind("units", "unit_key,name,type\nT,Team,SQUAD\n").errors.some((e) => e.includes("DIVISION")));
ok("values keep their case and inner spaces; edges are trimmed", C.parseKind("locations", "name\n  Dar es Salaam \n").rows[0].name === "Dar es Salaam");
console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
