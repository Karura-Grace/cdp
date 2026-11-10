// Downloads the Savanna Ridge sample report set (full PDF, brief PDF, PPTX) as the demo viewer.
//   node --env-file=apps/web/.env.local scripts/export-savanna.mjs <out-dir> [base-url]
import { writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { URL_, ANON, pwOf } from "./lib/e2e.mjs";

const [out, base = "http://localhost:3100"] = process.argv.slice(2);
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: t } = await svc.from("tenant").select("tenant_id").eq("name", "Savanna Ridge Microfinance (demo)").single();
const { data: rep } = await svc.from("report").select("report_id").eq("tenant_id", t.tenant_id).eq("type", "ORGANISATIONAL").order("created_at", { ascending: false }).limit(1).single();
const jar = new Map();
const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
const em = "demo@cdp-demo.example";
const { error } = await c.auth.signInWithPassword({ email: em, password: pwOf(em) });
if (error) throw new Error(error.message);
const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
for (const [q, name] of [["format=pdf", "Savanna-Ridge-Full-Report.pdf"], ["format=pdf&brief=1", "Savanna-Ridge-Executive-Brief.pdf"], ["format=pptx", "Savanna-Ridge-Sample-Report.pptx"]]) {
  const r = await fetch(`${base}/v1/reports/${rep.report_id}/export?${q}`, { headers: { cookie } });
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  writeFileSync(`${out}/${name}`, Buffer.from(await r.arrayBuffer()));
  console.log("wrote", name);
}
