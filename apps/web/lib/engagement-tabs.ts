import type { StaffNav } from "@/components/staff-shell";
import { admin } from "./supabase/admin";
import { servicesOf } from "./services";

type Db = { rpc: (fn: "rpc_actor_role", args: { p_engagement: string }) => PromiseLike<{ data: unknown }> };
export type TabKey = "overview" | "org" | "setup" | "scorecard" | "leaders" | "raters" | "segments" | "score-review" | "findings" | "playbook" | "plan" | "team" | "measure" | "privacy" | "completion" | "fielding";

// One tab bar for every page of an engagement, so setup, results and the plan are always one click apart.
// Which tabs show follows the same rules as the Portfolio buttons: client roles see results only once a report is released.
// The assessment and release state are read with the service role (ids and statuses only); each page still checks access itself.
export async function engagementTabs(db: Db, engagementId: string, active: TabKey): Promise<{ label: string; items: StaffNav[] }> {
  const { data: eng } = await admin().from("engagement").select("tenant_id").eq("engagement_id", engagementId).maybeSingle();
  const paid = new Set(eng ? await servicesOf(eng.tenant_id) : []);   // parts the client has paid for (owner ruling 22 Oct 2026)
  const [{ data: role }, { data: asm }] = await Promise.all([
    db.rpc("rpc_actor_role", { p_engagement: engagementId }),
    admin().from("assessment").select("assessment_id, status, frozen_at").eq("engagement_id", engagementId).neq("status", "SUPERSEDED").maybeSingle(),
  ]);
  const released = asm ? !!(await admin().from("report").select("report_id").eq("assessment_id", asm.assessment_id).eq("status", "RELEASED").limit(1)).data?.length : false;
  const consultant = role === "PAC_CONSULTANT";
  const a = asm ? `/assessments/${asm.assessment_id}` : null;
  const e = `/engagements/${engagementId}`;
  const tabs: [TabKey, string, StaffNav["icon"], boolean][] = [
    ["overview", e, "overview", true],
    ["org", `${e}/org`, "building", consultant || role === "CLIENT_ADMIN"],
    ["setup", `${e}/setup`, "key", consultant || role === "CLIENT_ADMIN" || role === "EXECUTIVE"],
    ["scorecard", `${e}/scorecard`, "tracker", ["PAC_CONSULTANT", "CLIENT_ADMIN", "EXECUTIVE"].includes(role as string)],
    ["leaders", `${a}/leaders`, "perc", paid.has("LEADERSHIP_360") && !!a && (consultant ? asm!.status !== "DRAFT" : released && role !== "PEOPLE_LEADER")],
    ["raters", `${e}/raters`, "perc", paid.has("LEADERSHIP_360") && !!a && (consultant || role === "CLIENT_ADMIN" || role === "PEOPLE_LEADER") && (asm!.status === "DRAFT" || (asm!.status === "LAUNCHED" && !asm!.frozen_at))],
    ["score-review", `${a}/score-review`, "ready", !!a && consultant && !!asm!.frozen_at],
    ["findings", `${a}/findings`, "tracker", !!a && consultant && !!asm!.frozen_at],
    ["segments", `${a}/segments`, "segments", paid.has("GROUP_RESULTS") && !!a && consultant && !!asm!.frozen_at],
    ["team", `${a}/team`, "users", !!a && released && role === "PEOPLE_LEADER"],
    ["playbook", `${a}/playbook`, "tracker", !!a && (consultant ? !!asm!.frozen_at : released && role !== "COACH")],
    ["plan", `${a}/plan`, "tracker", !!a && (consultant ? !!asm!.frozen_at : released && role !== "COACH")],
    ["privacy", `${e}/privacy`, "lock", consultant || role === "CLIENT_ADMIN"],
    ["fielding", `${e}/fielding`, "ready", !!a && (consultant || role === "CLIENT_ADMIN") && asm!.status !== "DRAFT"],
    ["completion", `${e}/completion`, "ready", !!a && role === "CLIENT_ADMIN" && asm!.status === "LAUNCHED" && !asm!.frozen_at],
    ["measure", `${e}/measure`, "ready", !!a && (consultant ? !!asm!.frozen_at : released && ["CLIENT_ADMIN", "EXECUTIVE"].includes(role as string))],
  ];
  return { label: "Engagement", items: tabs.filter((t) => t[3]).map(([k, href, icon]) => ({ href, icon, label: LABEL[k], active: k === active })) };
}

const LABEL: Record<TabKey, string> = { overview: "Overview", org: "Organisation", setup: "Setup and launch", scorecard: "Scorecard", leaders: "Leadership 360", raters: "Rater proposals", "score-review": "Score review", findings: "Findings", playbook: "Playbook", segments: "Results by group", team: "My team", plan: "Action plan", measure: "Measure", privacy: "Privacy and data protection", completion: "Completion time", fielding: "Fielding" };
