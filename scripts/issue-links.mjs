// Prints N fresh single-use survey links for the newest "Live Demo Co" assessment.
//   node --env-file=.env.local scripts/issue-links.mjs [n=3] [base-url=http://localhost:3100]
import { createClient } from "@supabase/supabase-js";

const n = Number(process.argv[2] ?? 3), base = process.argv[3] ?? "http://localhost:3100";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: t } = await db.from("tenant").select("tenant_id").like("name", "Live Demo Co%").order("created_at", { ascending: false }).limit(1).single();
const { data: a } = await db.from("assessment").select("assessment_id").eq("tenant_id", t.tenant_id).single();
const { data, error } = await db.rpc("rpc_issue_invitations", { p_assessment_id: a.assessment_id, p_count: n });
if (error) throw new Error(error.message);
for (const tok of data) console.log(`${base}/respond#${tok}`);
