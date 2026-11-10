import { problem } from "@/lib/problem";

export const runtime = "nodejs";

// Report text is written by the system and nobody edits it (owner ruling 22 Oct 2026, Erick Ngala comment 24): the consultant reviews and releases,
// and gives comments to the client in the debrief, outside the report.
export async function PUT() {
  return problem({ code: "METHOD_NOT_ALLOWED", status: 405, title: "Report text is drafted by the system and cannot be edited." });
}
