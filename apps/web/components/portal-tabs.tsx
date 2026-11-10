"use client";

import { useEffect, useState } from "react";

// The report's tabs. Every pane is rendered on the server and tagged data-pane="overview culture ..."; this only chooses which are visible (CSS in portal.css), keeps the choice in the
// address bar hash, and shows everything under "Everything", so the long page is still one click away. Without script all panes show.
const TABS = [["overview", "Overview"], ["culture", "Culture now"], ["groups", "Groups"], ["readiness", "Readiness"], ["findings", "Findings"], ["plan", "Plan and KPIs"], ["all", "Everything"]] as const;

export default function PortalTabs({ children, only }: { children: React.ReactNode; only?: string[] }) {
  const tabs = TABS.filter(([k]) => !only || only.includes(k) || k === "all");
  const [active, setActive] = useState<string>("overview");
  useEffect(() => { const h = window.location.hash.slice(1); if (tabs.some(([k]) => k === h)) setActive(h); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (k: string) => { setActive(k); history.replaceState(null, "", `#${k}`); window.scrollTo({ top: 0 }); };
  return (
    <div className="pt-root" data-active={active}>
      <div className="pt-ptabs" role="tablist" aria-label="Report sections">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={active === k} onClick={() => pick(k)}>{l}</button>)}
      </div>
      {children}
    </div>
  );
}
