import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Pulse respondents hold a single-use token, like the main survey. Prefer the header: URLs end up in platform logs, bodies do not.
// Never log the token or the body (CLAUDE.md §8).
const tokenOf = (req: Request) => req.headers.get("x-survey-token") ?? new URL(req.url).searchParams.get("token") ?? "";
const GONE = { code: "TOKEN_INVALID", status: 410, title: "This link is no longer valid." } as const;

type Status = { state: string; pulse_id?: string; items?: string[]; assessment_id?: string; closes_at?: string };

export async function GET(req: Request) {
  const token = tokenOf(req);
  if (!/^[0-9a-f]{32}$/.test(token)) return problem(GONE);
  const db = admin();
  const { data, error } = await db.rpc("rpc_pulse_status", { p_token: token });
  if (error) return fromDbError(error.message);
  const st = data as Status;
  if (st.state !== "OPEN") return problem(GONE);

  // Only what the pulse asks: its scenarios, the short-form items of its dimensions and the eOS questions it names.
  const refs = st.items!.map((r) => E.parsePulseRef(r)).filter((r): r is E.PulseRef => r !== null);
  const asm = await db.from("assessment").select("tenant_id, instrument_version_id").eq("assessment_id", st.assessment_id!).single();
  const org = asm.data ? await db.from("tenant").select("name").eq("tenant_id", asm.data.tenant_id).single() : null;
  const v = asm.data!.instrument_version_id;
  const scen = refs.flatMap((r) => (r.kind === "scenario" ? [`${r.dim}-S${r.set}`] : []));
  const itemIds = refs.flatMap((r) => (r.kind === "dimension" ? E.SHORT_FORM_ITEM_IDS[r.dim] : []));
  const [scenarios, statements, likert, eos] = await Promise.all([
    scen.length ? db.from("scenario").select("scenario_id, dimension, title, prompt_now").eq("version_id", v).in("scenario_id", scen) : { data: [], error: null },
    scen.length ? db.from("scenario_statement").select("scenario_id, orientation, text").eq("version_id", v).in("scenario_id", scen) : { data: [], error: null },
    itemIds.length ? db.from("item").select("item_id, dimension, canonical_text").eq("version_id", v).in("item_id", itemIds).order("sequence") : { data: [], error: null },
    refs.some((r) => r.kind === "eos") ? db.from("item").select("item_id, sequence, canonical_text").eq("version_id", v).eq("block", "EOS").order("sequence") : { data: [], error: null },
  ]);
  if (scenarios.error || statements.error || likert.error || eos.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  return json({ state: "OPEN", org: org?.data?.name ?? null, closes: st.closes_at ?? null, items: st.items, scenarios: scenarios.data, statements: statements.data, likert: likert.data, eos: eos.data });
}

// Final submit. Drafts stay in the browser; nothing reaches the database before this call.
export async function PUT(req: Request) {
  const token = tokenOf(req);
  if (!/^[0-9a-f]{32}$/.test(token)) return problem(GONE);
  const raw = await req.text();
  if (raw.length > 16 * 1024) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The submission is too large." });
  let body: { answers?: E.PulseAnswers };
  try { body = JSON.parse(raw); } catch { return problem({ code: "VALIDATION_FAILED", status: 422, title: "The body is not valid JSON." }); }
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "answers are required." });

  const db = admin();
  const { data, error } = await db.rpc("rpc_pulse_status", { p_token: token });
  if (error) return fromDbError(error.message);
  const st = data as Status;
  if (st.state !== "OPEN") return problem(GONE);
  const errors = E.validatePulseAnswers(st.items!, body.answers);
  if (errors.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: errors[0], errors });
  const r = await db.rpc("rpc_pulse_submit", { p_token: token, p_answers: body.answers as never });
  if (r.error) return fromDbError(r.error.message);
  return json({ ok: true }, 201);
}
