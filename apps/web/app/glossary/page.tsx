import type { Metadata } from "next";
import { StaffShell } from "@/components/staff-shell";
import { GLOSSARY_GROUPS } from "@/lib/glossary";
import { staffNav } from "@/lib/staff-nav";
import { staffGate } from "@/lib/session";
import { serverDb } from "@/lib/supabase/server";
import "../console.css";

export const metadata: Metadata = { title: "Glossary | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Every term used on the platform and in the reports, in plain words, grouped. One list (lib/glossary.ts) feeds this page and Appendix B of every report.
export default async function Page() {
  const db = await serverDb();
  const { user } = await staffGate(db, "/glossary");
  const { nav, roleLabel } = await staffNav(db, null);
  return (
    <StaffShell title="Glossary" subtitle="The terms used across the platform and the reports, in plain words." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      <div className="cds">
        {GLOSSARY_GROUPS.map((g) => (
          <section key={g.group} className="scard" aria-labelledby={`g-${g.group.replace(/\W+/g, "-")}`}>
            <div className="scard-head"><h2 id={`g-${g.group.replace(/\W+/g, "-")}`}>{g.group}</h2></div>
            <dl style={{ display: "grid", gap: 10, margin: 0 }}>
              {g.terms.map((t) => (
                <div key={t.term}><dt style={{ fontWeight: 700 }}>{t.term}</dt><dd className="ssmall" style={{ margin: "2px 0 0" }}>{t.def}</dd></div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </StaffShell>
  );
}
