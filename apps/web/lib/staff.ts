import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import { problem } from "./problem";
import { serverDb } from "./supabase/server";
import { IDLE_COOKIE, sessionEnd } from "./session-policy";
import { cookies } from "next/headers";

export interface Actor { db: SupabaseClient<Database>; userId: string }

// Staff authenticate with their Supabase access token. The `db` client carries that token, so every
// read through it is subject to RLS. Writes go through admin() only after the checks below pass.
export async function actor(req: Request): Promise<Actor | null> {
  const jwt = /^Bearer (.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!jwt) {
    // Browser session. Cookies are sent cross-site on form posts, so state-changing calls must carry a custom
    // header, which a foreign page cannot add without a CORS preflight we never answer.
    if (req.method !== "GET" && req.headers.get("x-cdp-csrf") !== "1") return null;
    const db = await serverDb();
    const { data } = await db.auth.getUser();
    if (!data.user) return null;
    const { data: s } = await db.auth.getSession();
    return sessionEnd(s.session?.access_token, (await cookies()).get(IDLE_COOKIE)?.value) ? null : { db, userId: data.user.id };
  }
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(jwt);
  return error || !data.user || sessionEnd(jwt, undefined) ? null : { db, userId: data.user.id };
}

const unauthenticated = () => problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
const forbidden = () => problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });

type Assessment = Database["public"]["Tables"]["assessment"]["Row"];

/** The caller must be an active PAC Consultant on this assessment's engagement (Table 7: score, freeze, report, release). */
export async function consultantOnAssessment(req: Request, assessmentId: string): Promise<{ a: Actor; asm: Assessment } | Response> {
  const a = await actor(req);
  if (!a) return unauthenticated();
  const { data: asm } = await a.db.from("assessment").select("*").eq("assessment_id", assessmentId).maybeSingle();
  if (!asm) return forbidden();                      // RLS hides assessments outside the caller's scope
  const { data: role } = await a.db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  return role === "PAC_CONSULTANT" ? { a, asm } : forbidden();
}

type Engagement = Database["public"]["Tables"]["engagement"]["Row"];

/** The caller must be an active PAC Consultant on this engagement (Table 7: setup sections, assessment, consent, launch). */
export async function consultantOnEngagement(req: Request, engagementId: string): Promise<{ a: Actor; eng: Engagement } | Response> {
  const a = await actor(req);
  if (!a) return unauthenticated();
  const { data: eng } = await a.db.from("engagement").select("*").eq("engagement_id", engagementId).maybeSingle();
  if (!eng) return forbidden();                      // RLS hides engagements outside the caller's scope
  const { data: role } = await a.db.rpc("rpc_actor_role", { p_engagement: engagementId });
  return role === "PAC_CONSULTANT" ? { a, eng } : forbidden();
}

/** Read a small JSON body; a Response (422) if it is too large or not an object. */
export async function readJson(req: Request, max = 64 * 1024): Promise<Record<string, unknown> | Response> {
  const raw = await req.text();
  if (raw.length > max) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The body is too large." });
  try {
    const b = JSON.parse(raw || "{}");
    if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  } catch { /* falls through */ }
  return problem({ code: "VALIDATION_FAILED", status: 422, title: "The body must be a JSON object." });
}

/**
 * The org graph is loaded and maintained by the tenant's Client Admin, and a PAC Consultant may edit it (Table 13).
 * Overrides are a consultant's call, so `consultantOnly` narrows it. Reads go through the caller's own client (RLS decides).
 */
export async function graphEditor(req: Request, engagementId: string, consultantOnly = false): Promise<{ a: Actor; eng: Engagement; role: string } | Response> {
  const a = await actor(req);
  if (!a) return unauthenticated();
  const { data: eng } = await a.db.from("engagement").select("*").eq("engagement_id", engagementId).maybeSingle();
  if (!eng) return forbidden();
  const { data: role } = await a.db.rpc("rpc_actor_role", { p_engagement: engagementId });
  const ok = role === "PAC_CONSULTANT" || (!consultantOnly && role === "CLIENT_ADMIN");
  return ok ? { a, eng, role: role as string } : forbidden();
}

/** Read access to the graph: the editors, plus a Super Admin and an Executive for the structure (Table 7). People rows come back empty for them (RLS). */
export async function graphReader(req: Request, engagementId: string): Promise<{ a: Actor; eng: Engagement; role: string } | Response> {
  const a = await actor(req);
  if (!a) return unauthenticated();
  const { data: eng } = await a.db.from("engagement").select("*").eq("engagement_id", engagementId).maybeSingle();
  if (!eng) return forbidden();
  const { data: role } = await a.db.rpc("rpc_actor_role", { p_engagement: engagementId });
  return ["PAC_CONSULTANT", "CLIENT_ADMIN", "SUPER_ADMIN", "EXECUTIVE"].includes(role as string) ? { a, eng, role: role as string } : forbidden();
}
