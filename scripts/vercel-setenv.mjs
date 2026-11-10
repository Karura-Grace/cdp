// Sets one environment variable on the CDP Vercel project (production, sensitive), reading its value from an env file. Never prints the value.
//   node scripts/vercel-setenv.mjs <env-file> <NAME>
// The Vercel token is read from the Windows Desktop file. A new value applies only to new deployments (push, or redeploy).
import { readFileSync } from "node:fs";

const [envFile, name] = process.argv.slice(2);
if (!envFile || !name) { console.error("usage: node scripts/vercel-setenv.mjs <env-file> <NAME>"); process.exit(2); }
const value = new RegExp(`^${name}=(.*)$`, "m").exec(readFileSync(envFile, "utf8"))?.[1];
if (!value) { console.error(`${name} is not in ${envFile}`); process.exit(1); }
const token = readFileSync("/mnt/c/Users/PAC/Desktop/vercel-wsl-token.txt", "utf8").replace(/[\r\n]/g, "");
const PROJECT = "prj_lNnCHZwIsWpZUDRmIJtdZ1oGI3AN", TEAM = "team_Wyb4nKeQyz9YV3a57czqRYKf";
const api = (path, init = {}) => fetch(`https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM}`, { ...init, headers: { Authorization: "Bearer " + token, "content-type": "application/json" } });

const list = await (await api(`/v9/projects/${PROJECT}/env`)).json();
for (const e of (list.envs ?? []).filter((x) => x.key === name)) {
  const d = await api(`/v9/projects/${PROJECT}/env/${e.id}`, { method: "DELETE" });
  console.log("removed the old", name, "entry:", d.status);
}
const r = await api(`/v10/projects/${PROJECT}/env`, { method: "POST", body: JSON.stringify({ key: name, value, type: "sensitive", target: ["production"] }) });
console.log(name, "set on production (sensitive):", r.status, r.ok ? "" : (await r.text()).slice(0, 200));
process.exit(r.ok ? 0 : 1);
