import * as E from "@pac/cdp-engine";

const row = (o: E.Orientation, group: "profile" | "actions" | "metrics", start: string) => {
  const p = E.ORIENTATION_PLAYBOOK[o];
  if (group === "profile") return p.profile.find((r) => r.attribute.startsWith(start))?.specification ?? [];
  const r = p[group].rows.find((x) => x.label.startsWith(start));
  return r ? r.values.flat() : [];
};

export type ActionDepth = { why: string; how: string[]; signal: string | null; unlocks: string[]; watch: string[]; version: string; good: string[]; traps: string[] };

// The reasoning behind an action, from the orientation playbook (versioned reference data): why this orientation, how the system lever
// is pulled, the visible 30 day signal (only for an action that is the visible signal), and what it unlocks: the next measurement's
// watch list and the orientation it releases. Wording only; the plan itself (owner, dates, KPI) is the engine's.
export function actionDepth(a: { orientation: string; system_lever?: string | null; is_visible_signal: boolean }, releases: string | null): ActionDepth {
  const o = a.orientation as E.Orientation;
  if (!E.ORIENTATION_PLAYBOOK[o]) return { why: "", how: [], signal: null, unlocks: [], watch: [], version: E.PLAYBOOK_VERSION, good: [], traps: [] };
  const value = row(o, "profile", "How it creates value")[0] ?? "";
  const overplay = row(o, "profile", "Overplay risks");
  const lever = a.system_lever ? a.system_lever.replace(/_/g, " ").toLowerCase() : "";
  const levers = row(o, "actions", "HR and system levers");
  const howLever = lever ? levers.filter((l) => l.toLowerCase().startsWith(lever.split(" ")[0])) : [];
  const nurture = row(o, "metrics", "To achieve");
  return {
    why: `${value} ${overplay.length ? `Watch for the overplay: ${overplay[0].replace(/^Becomes a /i, "").replace(/\.$/, "")}.` : ""}`.trim(),
    how: [...howLever, ...row(o, "actions", "Actions individuals").slice(0, 3)],
    signal: a.is_visible_signal ? (row(o, "actions", "Visible signal")[0] ?? null) : null,
    unlocks: [...(releases ? [`Releases ${releases.charAt(0) + releases.slice(1).toLowerCase()} capacity by building this first.`] : []), ...nurture.slice(0, 4).map((n) => `Builds ${n.toLowerCase()}.`)],
    watch: row(o, "actions", "CDP re-measurement"),
    version: E.PLAYBOOK_VERSION,
    good: row(o, "profile", "Strengths").slice(0, 3),   // what good looks like
    traps: row(o, "profile", "Overplay risks").slice(0, 3),   // traps to avoid
  };
}
