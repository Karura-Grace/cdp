import { admin } from "./supabase/admin";

// Workshop record helpers (spec Table 16): who was in the room, and which setup sections must come first.
//
// Participants are person of record ids (per_...). Only an id whose person has an executive grade counts toward the two executive
// minimum (owner decision 18 Oct 2026). A typed name from an older record is kept as it is but never counts.

export const PERSON_ID = /^per_[0-9a-f]{16}$/;

export interface Attendance {
  verified: string[];      // person ids whose grade is an executive grade
  others: string[];        // person ids of people who are not executives (they attended, they do not count)
  unknown: string[];       // ids that are not a person of record of this organisation (refused on save)
  unverified: string[];    // typed names (legacy), kept but never counted
}
/** Executives that count toward the minimum: person ids with an executive grade only. */
export const executiveCount = (a: Attendance) => a.verified.length;

/** Check several participant lists with one read of the tenant's people and grades. */
export async function attendanceBatch(tenantId: string, lists: string[][]): Promise<Attendance[]> {
  const ids = [...new Set(lists.flat().filter((p) => PERSON_ID.test(p)))];
  const exec = new Map<string, boolean>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: people } = await admin().from("person_of_record").select("person_id, grade_id").eq("tenant_id", tenantId).in("person_id", ids.slice(i, i + 200));
    const gradeIds = [...new Set((people ?? []).map((p) => p.grade_id).filter((x): x is string => !!x))];
    const { data: grades } = gradeIds.length ? await admin().from("grade_band").select("grade_id, is_executive").eq("tenant_id", tenantId).in("grade_id", gradeIds) : { data: [] };
    const isExec = new Map((grades ?? []).map((g) => [g.grade_id, g.is_executive]));
    for (const p of people ?? []) exec.set(p.person_id, !!(p.grade_id && isExec.get(p.grade_id)));
  }
  return lists.map((l) => {
    const a: Attendance = { verified: [], others: [], unknown: [], unverified: [] };
    for (const p of l) {
      if (!PERSON_ID.test(p)) a.unverified.push(p);
      else if (!exec.has(p)) a.unknown.push(p);
      else (exec.get(p) ? a.verified : a.others).push(p);
    }
    return a;
  });
}
export const attendance = async (tenantId: string, list: string[]) => (await attendanceBatch(tenantId, [list]))[0];

/**
 * Spec 1.1, "Sequence": Sections B, C and D first; E, F and G captured and agreed after them; Section I finalised and locked last.
 * Returns what is missing, or null. The sentence names B to G and I only, so A and H are not gated (open question for the owner).
 * `agreed` holds the sections that are agreed or locked.
 */
export function sequenceBlock(section: string, agreed: Set<string>, act: "capture" | "agree"): string | null {
  const need = "EFG".includes(section) ? ["B", "C", "D"] : section === "I" && act === "agree" ? ["B", "C", "D", "E", "F", "G"] : [];
  const missing = need.filter((s) => !agreed.has(s));
  if (!missing.length) return null;
  return section === "I" ? `Section I is finalised last. Agree Section${missing.length > 1 ? "s" : ""} ${missing.join(", ")} first.` : `Sections B, C and D come first. Agree ${missing.join(", ")} before ${act === "capture" ? "capturing" : "agreeing"} Section ${section}.`;
}

/** PAC consultants assigned to the engagement now (the facilitator pick list). Name falls back to the email. */
export async function assignedConsultants(engagementId: string): Promise<{ user_id: string; name: string }[]> {
  const { data } = await admin().rpc("rpc_engagement_consultants", { p_engagement: engagementId });
  return ((data as { user_id: string; full_name: string | null; email: string }[] | null) ?? []).map((u) => ({ user_id: u.user_id, name: u.full_name || u.email }));
}

/** Sections E, F and G need an Executive and an HR entry saved before the agreed perspective can be agreed (decision 18 Oct 2026). Returns what is missing, or null. */
export async function perspectivesBlock(engagementId: string, section: string): Promise<string | null> {
  if (!"EFG".includes(section)) return null;
  const { data } = await admin().from("setup_record").select("perspective").eq("engagement_id", engagementId).eq("section", section).in("perspective", ["EXECUTIVE", "HR"]);
  const have = new Set((data ?? []).map((r) => r.perspective));
  const missing = ["EXECUTIVE", "HR"].filter((x) => !have.has(x)).map((x) => (x === "HR" ? "HR" : "Executive"));
  return missing.length ? `Section ${section} needs an ${missing.join(" and an ")} entry saved before it can be agreed.` : null;
}

/** Sections of an engagement that are agreed or locked (the AGREED perspective). */
export async function agreedSections(engagementId: string): Promise<Set<string>> {
  const { data } = await admin().from("setup_record").select("section, status, locked_at").eq("engagement_id", engagementId).eq("perspective", "AGREED");
  return new Set((data ?? []).filter((r) => r.status === "AGREED" || r.locked_at).map((r) => r.section));
}
