import { serverDb } from "@/lib/supabase/server";

// Setup G5 stays locked after launch. What scoring adds to it (the orientations to keep and protect) is shown here, read only,
// with the score version it came from. RLS decides who reads it: the consultant and Super Admin, and the client roles that read setup.
export default async function G5Notes({ engagementId }: { engagementId: string }) {
  const db = await serverDb();
  const { data } = await db.from("setup_system_note").select("note_id, item, body, score_version").eq("engagement_id", engagementId).eq("section", "G").order("score_version", { ascending: false }).order("item");
  if (!data?.length) return null;
  const v = data[0].score_version, latest = data.filter((n) => n.score_version === v);
  return (
    <section className="cds-card" aria-labelledby="g5n">
      <h2 id="g5n" style={{ fontSize: 17, fontWeight: 700 }}>G5 Keep and protect: added by scoring</h2>
      <p className="cds-sub" style={{ marginTop: 2 }}>From score version {v}. These entries came from the results, not the workshop, and cannot be edited here.</p>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{latest.map((n) => <li key={n.note_id}>{n.body}</li>)}</ul>
    </section>
  );
}
