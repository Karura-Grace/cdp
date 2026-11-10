// The Workshop 1 workbook (owner rulings Q-WS1, Q-WS2, Erick comment 9, Oct 2026): an Excel file with one sheet per setup section A to I, filled in at the workshop, taken
// for review and changes, uploaded again, and the reviewed version marked final is the one that feeds Setup (and so the engine). Excel only, no CSV.
// Every answer is one row: a hidden path column (the field's place in the section, for example kpis[2].name), the question, the guidance and the answer. Lists show as
// numbered rows up to their maximum, so the sheet has a fixed shape and a re upload lines up row for row. The payload that comes back out is cleaned and checked by the
// same functions the Setup forms use (finalise, validateSection), so an upload can never hold something the forms would refuse.
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { SECTIONS, SECTION_TITLES, finalise, validateSection, type Field, type Json, type Leaf } from "./setup-sections";

export const SECTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"] as const;
export const WORKBOOK_FORMAT = "CDP-WORKSHOP-1";
const MAX_LIST_ROWS = 12;                      // a list longer than this is shown with this many rows (the sections' own maxima are smaller, bar a few)

type Row = { path: string; label: string; hint?: string; leaf: Leaf | { t: "kpi" }; required: boolean };

const leafOf = (f: Field): Leaf | null => (f.t === "text" || f.t === "enum" || f.t === "multi" || f.t === "date" || f.t === "num" || f.t === "bool" ? (f as Leaf) : null);

/** The rows of one section, in order. Section D (targets) is one pair of rows per KPI agreed in Section C. */
export function sectionRows(section: string, kpis: { id: string; name?: string }[] = []): Row[] {
  const out: Row[] = [];
  const walk = (fields: Field[], prefix: string, labelPrefix: string) => {
    for (const f of fields) {
      const path = prefix + f.key, label = labelPrefix + f.label, lf = leafOf(f);
      if (lf) out.push({ path, label, hint: f.hint, leaf: lf, required: !!f.req });
      else if (f.t === "group") walk(f.fields, path + ".", label + " / ");
      else if (f.t === "list") {
        const n = Math.min(f.max, MAX_LIST_ROWS);
        for (let i = 1; i <= n; i++) {
          if (f.of.t === "group") walk(f.of.fields, `${path}[${i}].`, `${label} ${i} / `);
          else out.push({ path: `${path}[${i}]`, label: `${label} ${i}`, hint: i === 1 ? f.hint : undefined, leaf: f.of as Leaf, required: i <= f.min && !!f.req });
        }
      } else if (f.t === "targets") {
        for (const k of kpis) {
          out.push({ path: `targets[${k.id}].target_12m`, label: `Target in 12 months: ${k.name ?? k.id}`, leaf: { t: "num", min: -1e12, max: 1e12 }, required: false },
            { path: `targets[${k.id}].target_3y`, label: `Target in 3 years: ${k.name ?? k.id}`, leaf: { t: "num", min: -1e12, max: 1e12 }, required: false });
        }
      }
    }
  };
  walk(SECTIONS[section] ?? [], "", "");
  return out;
}

const LEAF_HELP = (l: Row["leaf"]): string => {
  if (l.t === "enum") return "Choose one from the list.";
  if (l.t === "multi") return "Choose one or more, separated by commas.";
  if (l.t === "date") return "A date as YYYY-MM-DD.";
  if (l.t === "num") return "A number.";
  if (l.t === "bool") return "Yes or No.";
  if (l.t === "text") return `Up to ${l.max} characters.`;
  return "";
};

/** A blank (or pre filled) workbook. `values` is the payload per section when a workbook is regenerated from stored answers. */
export async function buildWorkbook(opts: { client: string; engagement: string; version: string; kpis?: { id: string; name?: string }[]; values?: Record<string, Json> }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Priority Activator Consulting"; wb.created = new Date();
  const cover = wb.addWorksheet("Cover");
  cover.columns = [{ width: 28 }, { width: 90 }];
  cover.addRows([
    ["Culture Dynamics Profile", "Workshop 1 workbook"], ["Client", opts.client], ["Engagement", opts.engagement], ["Workbook format", WORKBOOK_FORMAT], ["Version", opts.version],
    [], ["How to use it", "One sheet per setup section, A to I. Answer in the Answer column only. Lists show numbered rows; leave unused rows empty."],
    ["", "Choose from the drop down where a cell has one. Dates are written YYYY-MM-DD."],
    ["", "After the workshop the consultant reviews the answers and may change them, then uploads the file again. The version the consultant marks final is the one used."],
  ]);
  cover.getRow(1).font = { bold: true, size: 14 }; cover.getColumn(1).font = { bold: true };
  for (const sec of SECTION_KEYS) {
    const ws = wb.addWorksheet(`${sec} ${SECTION_TITLES[sec]}`.slice(0, 31));
    ws.columns = [{ header: "Path", key: "path", width: 4, hidden: true }, { header: "Question", key: "q", width: 52 }, { header: "Guidance", key: "g", width: 44 }, { header: "Answer", key: "a", width: 60 }];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const vals = flatten(opts.values?.[sec] ?? {});
    for (const r of sectionRows(sec, sec === "D" ? opts.kpis : [])) {
      const row = ws.addRow({ path: r.path, q: r.label + (r.required ? " *" : ""), g: [r.hint, LEAF_HELP(r.leaf)].filter(Boolean).join(" ") });
      const cell = row.getCell(4);
      cell.alignment = { wrapText: true, vertical: "top" }; row.getCell(2).alignment = { wrapText: true, vertical: "top" }; row.getCell(3).alignment = { wrapText: true, vertical: "top" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF6EF" } };
      const v = vals.get(r.path);
      if (v !== undefined) cell.value = r.leaf.t === "bool" ? (v ? "Yes" : "No") : Array.isArray(v) ? v.join(", ") : (v as string | number);
      if (r.leaf.t === "enum" && r.leaf.options.join(",").length <= 250) cell.dataValidation = { type: "list", allowBlank: true, formulae: [`"${r.leaf.options.join(",")}"`] };
      if (r.leaf.t === "bool") cell.dataValidation = { type: "list", allowBlank: true, formulae: ['"Yes,No"'] };
      if (r.leaf.t === "enum" && r.leaf.options.join(",").length > 250) row.getCell(3).value = `${row.getCell(3).value ?? ""} Allowed: ${r.leaf.options.join(", ")}.`;
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** A payload as path to value, so a stored answer can be put back in its row. */
function flatten(p: Json): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const go = (v: unknown, path: string) => {
    if (Array.isArray(v)) {
      if (path === "targets") { for (const t of v as Json[]) for (const k of ["target_12m", "target_3y"]) if (t[k] !== undefined) out.set(`targets[${t.kpi_id}].${k}`, t[k]); return; }
      v.forEach((x, i) => go(x, `${path}[${i + 1}]`));
    } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) go(x, path ? `${path}.${k}` : k);
    else out.set(path, v);
  };
  go(p, "");
  return out;
}

const text = (c: ExcelJS.CellValue): string => {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  if (typeof c === "object") { const o = c as { text?: string; result?: unknown; richText?: { text: string }[] }; return (o.richText ? o.richText.map((r) => r.text).join("") : o.text ?? (o.result !== undefined ? String(o.result) : "")).trim(); }
  return String(c).trim();
};

/** Puts the answers of one sheet back into a section payload, typed by each field. A cell that cannot be read as its type is returned as an error naming the row. */
function parseSheet(ws: ExcelJS.Worksheet, section: string, kpis: { id: string; name?: string }[]): { payload: Json; errors: string[] } {
  const rows = new Map(sectionRows(section, kpis).map((r) => [r.path, r]));
  const payload: Json = {}, errors: string[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const path = text(row.getCell(1).value), r = rows.get(path);
    if (!r) return;
    const raw = text(row.getCell(4).value);
    if (raw === "") return;
    let v: unknown = raw;
    if (r.leaf.t === "num") { const x = Number(raw.replace(/,/g, "")); if (!Number.isFinite(x)) { errors.push(`${r.label}: must be a number`); return; } v = x; }
    else if (r.leaf.t === "bool") { const l = raw.toLowerCase(); if (!["yes", "no", "true", "false"].includes(l)) { errors.push(`${r.label}: must be Yes or No`); return; } v = l === "yes" || l === "true"; }
    else if (r.leaf.t === "multi") v = raw.split(",").map((x) => x.trim()).filter(Boolean);
    set(payload, path, v);
  });
  return { payload, errors };
}

/** payload["a.b[2].c"] = v, creating the objects and arrays on the way. Targets rows (targets[K1].target_12m) become { kpi_id, target_12m } entries. */
function set(root: Json, path: string, v: unknown) {
  const t = /^targets\[(.+?)\]\.(target_12m|target_3y)$/.exec(path);
  if (t) { const list = ((root.targets as Json[] | undefined) ??= []); let e = list.find((x) => x.kpi_id === t[1]); if (!e) { e = { kpi_id: t[1] }; list.push(e); } e[t[2]] = v; return; }
  const parts = path.match(/[^.[\]]+|\[\d+\]/g) ?? [];
  let cur: unknown = root;
  parts.forEach((p, i) => {
    const last = i === parts.length - 1, idx = /^\[(\d+)\]$/.exec(p);
    const key = idx ? Number(idx[1]) - 1 : p, nextIsIdx = !last && /^\[\d+\]$/.test(parts[i + 1]);
    const holder = cur as Record<string | number, unknown>;
    if (last) holder[key] = v; else { holder[key] ??= nextIsIdx ? [] : {}; cur = holder[key]; }
  });
}

/** Compacts arrays that have holes (an empty row in the middle of a list) so the payload stays a plain list. */
const compact = (v: unknown): unknown => (Array.isArray(v) ? v.filter((x) => x !== undefined && x !== null).map(compact) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, compact(x)])) : v);

export type WorkbookParse = { ok: boolean; format: boolean; sections: Record<string, { payload: Json; errors: string[] }>; hash: string };

/** Reads an uploaded workbook. Section D needs the KPIs agreed in Section C; the C answers in the same file are used when the file carries them. */
export async function parseWorkbook(buf: Buffer, ctxKpis: { id: string; name?: string }[] = []): Promise<WorkbookParse> {
  const hash = createHash("sha256").update(buf).digest("hex");
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { return { ok: false, format: false, sections: {}, hash }; }
  const cover = wb.getWorksheet("Cover");
  const fmt = cover ? [...Array(12).keys()].some((i) => text(cover.getRow(i + 1).getCell(2).value) === WORKBOOK_FORMAT) : false;
  if (!fmt) return { ok: false, format: false, sections: {}, hash };
  const sections: WorkbookParse["sections"] = {};
  // C first, so D's targets can name the KPIs the file itself carries
  const order = ["C", ...SECTION_KEYS.filter((s) => s !== "C")];
  let kpis = ctxKpis;
  for (const sec of order) {
    const ws = wb.worksheets.find((w) => w.name.startsWith(sec + " "));
    if (!ws) { sections[sec] = { payload: {}, errors: [`The sheet for section ${sec} is missing`] }; continue; }
    const { payload, errors } = parseSheet(ws, sec, kpis);
    const clean = compact(payload) as Json;
    const fin = finalise(sec, clean);
    const check = validateSection(sec, fin, { complete: false, ctx: { today: new Date().toISOString().slice(0, 10), kpis: kpis as unknown as Json[] } });
    sections[sec] = { payload: fin, errors: [...errors, ...check] };
    if (sec === "C" && Array.isArray(fin.kpis)) kpis = (fin.kpis as Json[]).map((k) => ({ id: String(k.id), name: typeof k.name === "string" ? k.name : undefined }));
  }
  return { ok: Object.values(sections).every((s) => s.errors.length === 0), format: true, sections, hash };
}

/** Field by field differences between two section payloads, for the review screen. */
export function diffSections(prev: Record<string, Json> | null, next: Record<string, Json>): { section: string; path: string; was: unknown; now: unknown }[] {
  const out: { section: string; path: string; was: unknown; now: unknown }[] = [];
  for (const sec of SECTION_KEYS) {
    const a = flatten(prev?.[sec] ?? {}), b = flatten(next[sec] ?? {});
    for (const k of new Set([...a.keys(), ...b.keys()])) if (JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k))) out.push({ section: sec, path: k, was: a.get(k) ?? null, now: b.get(k) ?? null });
  }
  return out;
}
