// Shared by the e2e and seed scripts: environment, demo passwords, sign in, and the PASS/FAIL tally.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { STAFF_TEMPLATE_VERSION } from "../../apps/web/lib/staff-message.ts";

export const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
/** The scoring key (role scoring_reader): the only client that may run the functions returning response rows (AC 3.6). */
export const scoring = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + process.env.SCORING_KEY } } });
export const svc = () => createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const CREDS = "context-sessions/demo-credentials.txt";
/** Demo passwords by email, read fresh (seeds append to the file). */
export const passwords = () => Object.fromEntries(readFileSync(CREDS, "utf8").trim().split("\n")
  .map((l) => /(\S+@\S+)\s+(\S+)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]));
export const pwOf = (email) => passwords()[email];

/** Signs in with the anon key; returns the client and its access token. */
export async function signIn(email, password = pwOf(email)) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { c, t: data.session.access_token };
}

let fail = 0;
export const ok = (n, c, x = "") => { if (!c) fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : String(x).slice(0, 300)); };
/** Prints the tally (plus any extra lines) and sets the exit code. */
export function done(...extra) {
  console.log(fail ? `\n${fail} FAILED` : "\nall passed", ...extra);
  process.exit(fail ? 1 : 0);   // exit now: open Supabase clients would otherwise keep the process alive
}

/** Launch needs the owner's approval of both staff message templates (strict gate, owner decision 18 October 2026). A script that launches calls this first
 *  and the returned function last: it sets the platform wide approval for the run and puts back what was there. */
export async function approveTemplates() {
  const db = svc(), was = (await db.from("platform_setting").select("value").eq("key", "staff_templates_approved").single()).data.value;
  await db.from("platform_setting").update({ value: { approved_version: STAFF_TEMPLATE_VERSION } }).eq("key", "staff_templates_approved");
  return () => db.from("platform_setting").update({ value: was }).eq("key", "staff_templates_approved");
}
