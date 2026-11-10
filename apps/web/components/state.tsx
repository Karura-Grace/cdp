import type { ReactNode } from "react";
import { SIco, type SIC } from "./icons";

// The CDP design system's state pattern: an icon and words that say what happened, why, and the next step.
// Tones follow the design system's states: empty (dashed), info, warning, blocking, success (dark), locked, unavailable, suppressed (hatched).
export type StateTone = "empty" | "info" | "warning" | "blocking" | "success" | "locked" | "unavailable" | "suppressed";
const ICON: Record<StateTone, keyof typeof SIC> = { empty: "chartEmpty", info: "overview", warning: "warn", blocking: "blocked", success: "done", locked: "lock", unavailable: "fileX", suppressed: "userX" };

export function State({ tone = "empty", title, children, action, icon }: { tone?: StateTone; title: string; children?: ReactNode; action?: ReactNode; icon?: keyof typeof SIC }) {
  const live = tone === "blocking" || tone === "warning";
  return (
    <div className={"state state-" + tone} role={live ? "alert" : "status"}>
      <span className="state-ico"><SIco k={icon ?? ICON[tone]} /></span>
      <div className="state-body">
        <h2 className="state-title">{title}</h2>
        {children && <p className="state-text">{children}</p>}
        {action && <div className="state-act">{action}</div>}
      </div>
    </div>
  );
}
