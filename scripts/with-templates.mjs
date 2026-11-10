// Runs a command with the staff message templates marked approved for the duration, then puts the owner's setting back.
//   node --env-file=apps/web/.env.local scripts/with-templates.mjs <script> [args...]
import { spawnSync } from "node:child_process";
import { approveTemplates } from "./lib/e2e.mjs";
const restore = await approveTemplates();
const r = spawnSync("node", ["--env-file=apps/web/.env.local", ...process.argv.slice(2)], { stdio: "inherit" });
await restore();
process.exit(r.status ?? 1);
