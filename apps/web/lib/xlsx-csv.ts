import ExcelJS from "exceljs";

// XLSX in for the org graph (spec S1-03). The first worksheet is read and turned into the CSV text the importer already understands, row for
// row: sheet row N is CSV line N (blank rows stay blank lines), so every message that names a row names the row the person sees in Excel.
// Pure and self contained (no relative imports) so a node check can run it. Server side only: exceljs is a Node library.
export const MAX_XLSX_BYTES = 3 * 1024 * 1024;
const MAX_ROWS = 50_000, MAX_COLS = 20;

const q = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const day = (d: Date) => d.toISOString().slice(0, 10);

function text(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return day(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if ("result" in v) return text((v as { result?: ExcelJS.CellValue }).result ?? null);           // a formula: its result, never the formula
  if ("richText" in v) return v.richText.map((r) => r.text).join("");
  if ("text" in v) return String((v as { text: unknown }).text ?? "");                          // a hyperlink: its label
  if ("error" in v) return "";
  return "";
}

/** Throws an Error with a plain message when the file is not a readable workbook. */
export async function xlsxToCsv(buf: Buffer | Uint8Array): Promise<string> {
  if (buf.length > MAX_XLSX_BYTES) throw new Error("The file is larger than 3 MB.");
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error("This is not an XLSX file. Save it as .xlsx, or as CSV.");
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { throw new Error("The workbook could not be read. Save it again as .xlsx, or as CSV."); }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The workbook has no sheets.");
  if (ws.rowCount > MAX_ROWS) throw new Error(`The sheet has more than ${MAX_ROWS} rows.`);
  const lines: string[] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r), cells: string[] = [];
    const last = Math.min(row.cellCount, MAX_COLS);
    for (let c = 1; c <= last; c++) cells.push(q(text(row.getCell(c).value).trim()));
    while (cells.length && cells[cells.length - 1] === "") cells.pop();
    lines.push(cells.join(","));
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\r\n") + "\r\n";
}
