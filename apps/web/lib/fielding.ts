import { admin } from "@/lib/supabase/admin";

export interface Fielding { invited: number; agreed: number; declined: number; submitted: number }

// Counts only, never rows: who answered is not knowable and per-group rates need the cohort floor (AC 2.7), so this is the whole-survey total.
// Service role after the caller's own role check; the capture function returns numbers and nothing else.
export async function fieldingCounts(assessmentId: string): Promise<Fielding | null> {
  const { data, error } = await admin().rpc("rpc_fielding_counts", { p_assessment_id: assessmentId });
  if (error || !data) return null;
  const c = data as { invited: number; submitted: number; consent_agree: number; consent_decline: number };
  return { invited: c.invited, agreed: c.consent_agree, declined: c.consent_decline, submitted: c.submitted };
}

export const rate = (f: Fielding) => (f.invited ? Math.round((f.submitted / f.invited) * 100) : 0);
