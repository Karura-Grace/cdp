// Mints SCORING_KEY: a JWT whose role claim is scoring_reader, signed with the project's legacy HS256 JWT secret, and stores it in an env file.
//   node scripts/mint-scoring-key.mjs <project-ref> <token-file> <env-file> [days=365]
// The JWT secret is fetched through the Management API in memory, used once to sign, and dropped. It is never printed and never stored by the
// application. The key is written to the env file as SCORING_KEY and never printed. Re-run it (and update the Vercel variable) when the
// legacy JWT secret rotates or the key is about to expire.
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [ref, tokenFile, envFile, days = "365"] = process.argv.slice(2);
if (!ref || !tokenFile || !envFile) { console.error("usage: node scripts/mint-scoring-key.mjs <project-ref> <token-file> <env-file> [days]"); process.exit(2); }
const token = readFileSync(tokenFile, "utf8").replace(/[\r\n]/g, "");
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/postgrest`, { headers: { Authorization: "Bearer " + token } });
if (!r.ok) { console.error("could not read the project settings:", r.status); process.exit(1); }
const secret = (await r.json()).jwt_secret;
if (!secret) { console.error("no legacy JWT secret on this project; the fallback needs a separate decision"); process.exit(1); }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: "HS256", typ: "JWT" });
const body = b64({ iss: "supabase", ref, role: "scoring_reader", iat: now, exp: now + Number(days) * 86400 });
const jwt = `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;

let env = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
env = /^SCORING_KEY=.*$/m.test(env) ? env.replace(/^SCORING_KEY=.*$/m, "SCORING_KEY=" + jwt) : env.replace(/\n?$/, "\n") + "SCORING_KEY=" + jwt + "\n";
writeFileSync(envFile, env, { mode: 0o600 });
console.log(`SCORING_KEY written to ${envFile} (role scoring_reader, expires ${new Date((now + Number(days) * 86400) * 1000).toISOString().slice(0, 10)})`);
