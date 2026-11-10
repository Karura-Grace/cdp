import { requireServiceForPulse } from "@/lib/services";
import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/staff";
import { consultantOnPulse } from "@/lib/pulse";
import { fromDbError, json, problem } from "@/lib/problem";
import { pulseMail, sendMail } from "@/lib/email";
import { followEvent } from "@/lib/lifecycle";

export const runtime = "nodejs";

// POST { closes: "YYYY-MM-DD", send_email?: boolean }. Opens a draft pulse and issues one single-use link to every active person on the
// roster. Only token hashes are stored; the raw links come back once, with name and email, so the consultant can send them. With
// send_email the server also emails each person (hello@pac.africa) and reports sent and failed counts.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForPulse(id, "PULSE"); if (svcOff) return svcOff;
  const c = await consultantOnPulse(req, id);
  if (c instanceof Response) return c;
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  if (typeof b.closes !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.closes)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "closes must be a date, YYYY-MM-DD." });
  const closes = `${b.closes}T23:59:59Z`;

  const db = admin();
  const { data, error } = await db.rpc("rpc_pulse_open", { p_actor: c.a.userId, p_pulse: id, p_closes: closes });
  if (error) return fromDbError(error.message);
  await followEvent(c.pulse.engagement_id, "PULSE", "IMPLEMENTATION");   // the cycle shows a pulse is running
  const issued = data as unknown as { person_id: string; token: string }[];
  const { data: people } = await db.from("person_of_record").select("person_id, display_name, email").in("person_id", issued.map((x) => x.person_id));
  const who = new Map((people ?? []).map((p) => [p.person_id, p]));

  let mail: { sent: number; failed: number } | undefined;
  if (b.send_email === true) {
    const { data: t } = await db.from("tenant").select("name").eq("tenant_id", c.pulse.tenant_id).single();
    const origin = new URL(req.url).origin;
    const sent = await Promise.all(issued.map((r) => { const p = who.get(r.person_id); return p?.email ? sendMail(pulseMail({ to: p.email, name: p.display_name, org: t?.name ?? "Your organisation", url: `${origin}/respond/pulse#${r.token}`, close: closes })) : false; }));
    mail = { sent: sent.filter(Boolean).length, failed: sent.filter((x) => !x).length };
    await audit(c.pulse.tenant_id, c.a.userId, `pulse.emailed:${mail.sent}/${issued.length}`, "pulse", id);
  }
  return json({ count: issued.length, mail, links: issued.map((r) => ({ name: who.get(r.person_id)?.display_name ?? null, email: who.get(r.person_id)?.email ?? null, token: r.token })) }, 201);
}
