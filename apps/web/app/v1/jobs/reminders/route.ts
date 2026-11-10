import { runReminders } from "@/lib/reminder-job";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Vercel Cron, daily (vercel.json). Vercel sends Authorization: Bearer CRON_SECRET; without the secret set, the job refuses (fails closed).
// ?today=YYYY-MM-DD runs it on a simulated clock (tests); it needs the same secret.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Not authorised." });
  const q = new URL(req.url).searchParams.get("today");
  if (q && !/^\d{4}-\d{2}-\d{2}$/.test(q)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "today must be YYYY-MM-DD." });
  return json({ ran: await runReminders(q ?? new Date().toISOString().slice(0, 10)) });
}
