import { graphEditor } from "@/lib/staff";
import { MAX_XLSX_BYTES, xlsxToCsv } from "@/lib/xlsx-csv";
import { problem } from "@/lib/problem";

export const runtime = "nodejs";

// POST the bytes of an .xlsx file; the response is the first sheet as CSV text, row for row, for the importer to check and save the same way
// as an uploaded CSV. Nothing is stored here. The Client Admin and the consultant, the same people who may import.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphEditor(req, id);
  if (g instanceof Response) return g;
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > MAX_XLSX_BYTES) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The file is larger than 3 MB." });
  try { return new Response(await xlsxToCsv(buf), { headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" } }); }
  catch (e) { return problem({ code: "VALIDATION_FAILED", status: 422, title: (e as Error).message }); }
}
