import { requireServiceForPulse } from "@/lib/services";
import { admin } from "@/lib/supabase/admin";
import { consultantOnPulse } from "@/lib/pulse";
import { fromDbError, json } from "@/lib/problem";

export const runtime = "nodejs";

// POST: closes an open pulse. After this no link works and the results can be stored.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForPulse(id, "PULSE"); if (svcOff) return svcOff;
  const c = await consultantOnPulse(req, id);
  if (c instanceof Response) return c;
  const { error } = await admin().rpc("rpc_pulse_close", { p_actor: c.a.userId, p_pulse: id });
  if (error) return fromDbError(error.message);
  return json({ pulse_id: id, status: "CLOSED" });
}
