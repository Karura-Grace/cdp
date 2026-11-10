import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { actor, readJson } from "@/lib/staff";
import { superAdmin } from "@/lib/users";
import { fromDbError, json, problem } from "@/lib/problem";
import { bad } from "@/lib/privacy";

export const runtime = "nodejs";

// The platform's sub processor list (spec 1.4.5) is PAC wide, not per client. Any signed in staff member may read it; only a Super Admin adds to it.
export async function GET(req: Request) {
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data, error } = await a.db.from("sub_processor").select("*").order("name");
  return error ? fromDbError(error.message) : json(data);
}

export async function POST(req: Request) {
  const g = await superAdmin(req);
  if (g instanceof Response) return g;
  const b = await readJson(req, 4 * 1024);
  if (b instanceof Response) return b;
  const spec = { name: 120, purpose: 300, region: 80, transfer_basis: 300 };
  const row: Record<string, string> = {};
  for (const [k, max] of Object.entries(spec)) { const v = typeof b[k] === "string" ? (b[k] as string).trim() : ""; if (!v || v.length > max) return bad(`${k} is required (up to ${max} characters).`); row[k] = v; }
  const ins = await admin().from("sub_processor").insert({ name: row.name, purpose: row.purpose, region: row.region, transfer_basis: row.transfer_basis, added_by: g.a.userId }).select().single();
  if (ins.error) return /unique|duplicate/i.test(ins.error.message) ? bad("A sub processor with that name already exists.") : fromDbError(ins.error.message);
  // platform wide: the audit row has no tenant
  await audit(null, g.a.userId, "privacy.sub_processor.added", "sub_processor", ins.data.processor_id);
  return json(ins.data, 201);
}
