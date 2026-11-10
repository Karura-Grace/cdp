import * as E from "@pac/cdp-engine";
import { checkEngagementTransition, payloadHash, toJsonable } from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { scoringClient } from "@/lib/supabase/scoring";
import { consultantOnAssessment } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Freeze the response set once the survey window has closed, and move the engagement FIELDING -> SCORING.
// After this the dataset is read-only: submit_response refuses, and capture.frozen_response_set opens.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const { asm } = g;
  if (asm.frozen_at) return json({ frozen_at: asm.frozen_at, response_set_hash: asm.response_set_hash, changed: false });

  const db = admin();
  const { data: eng } = await db.from("engagement").select("state").eq("engagement_id", asm.engagement_id).single();
  const closed = !!asm.window_close && new Date(asm.window_close) <= new Date();
  const bad = checkEngagementTransition(eng!.state, "SCORING", "PAC_CONSULTANT", { windowClosed: closed, dataFrozen: true });
  if (bad) return problem(bad);

  // drafts whose respondent ticked "submit what I have if the window closes" are stored first (S2.6.3-005); the rest are deleted at freeze
  const auto = await db.rpc("rpc_auto_submit_drafts", { p_assessment_id: id });
  if (auto.error) return fromDbError(auto.error.message);
  const frozenAt = new Date().toISOString();
  const up = await db.from("assessment").update({ status: "FROZEN", frozen_at: frozenAt }).eq("assessment_id", id);
  if (up.error) return fromDbError(up.error.message);

  const set = await scoringClient().rpc("rpc_frozen_response_set", { p_assessment_id: id });
  if (set.error) return fromDbError(set.error.message);
  const hash = payloadHash(toJsonable(set.data));
  // the freeze manifest: counts by completion state under the pinned rules, the fielding counts, versions and extensions
  const [{ data: ver }, { data: fc }, { data: ext }, { count: voided }] = await Promise.all([
    db.from("assessment").select("instrument_version(semver), rules_version(semver)").eq("assessment_id", id).single(),
    db.rpc("rpc_fielding_counts", { p_assessment_id: id }),
    db.from("window_extension").select("seq, old_close, new_close, working_days, reason").eq("assessment_id", id).order("seq"),
    db.from("exclusion_log").select("response_id", { count: "exact", head: true }).eq("assessment_id", id).eq("kind", "VOID"),
  ]);
  const rules = ((ver?.rules_version as { semver?: string } | null)?.semver ?? E.RULES_VERSION) as E.RulesVersion;
  const states: Record<string, number> = {};
  for (const r of E.withRules(rules, () => E.classifyAll(set.data as unknown as E.ResponseInput[])).scored) states[r._state] = (states[r._state] ?? 0) + 1;
  const f = (fc ?? {}) as { invited?: number; started?: number; submitted?: number };
  const manifest = { assessment_id: id, frozen_at: frozenAt, instrument_version: (ver?.instrument_version as { semver?: string } | null)?.semver ?? null, rules_version: rules,
    invited: f.invited ?? 0, started: f.started ?? 0, submitted: f.submitted ?? 0, abandoned: (f.started ?? 0) - (f.submitted ?? 0), voided: voided ?? 0, auto_submitted: auto.data ?? 0,
    counts_by_state: states, extensions: ext ?? [], response_set_hash: hash };
  const h = await db.from("assessment").update({ response_set_hash: hash, freeze_manifest: manifest }).eq("assessment_id", id);
  if (h.error) return fromDbError(h.error.message);
  const st = await db.from("engagement").update({ state: "SCORING" }).eq("engagement_id", asm.engagement_id);
  if (st.error) return fromDbError(st.error.message);
  return json({ frozen_at: frozenAt, response_set_hash: hash, responses: (set.data as unknown[]).length, manifest, changed: true });
}
