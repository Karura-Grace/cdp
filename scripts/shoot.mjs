// Screenshots of staff pages for visual review: signs in through the app like a browser does, drives headless Chrome over its debugging port and saves full page PNGs.
//   node --env-file=apps/web/.env.local scripts/shoot.mjs <email> <outdir> <width> <path> [<path> ...]
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { URL_, ANON, pwOf } from "./lib/e2e.mjs";

const [email, out, width = "1280", ...paths] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3100";
mkdirSync(out, { recursive: true });
const jar = new Map();
const sb = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
const { error } = await sb.auth.signInWithPassword({ email, password: pwOf(email) });
if (error) throw new Error(email + ": " + error.message);

const port = 9400 + Math.floor(Math.random() * 300);
const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/shoot-" + port, "about:blank"], { stdio: "ignore" });
const until = async (f, ms = 15000) => { const t = Date.now(); for (;;) { try { return await f(); } catch (e) { if (Date.now() - t > ms) throw e; await new Promise((r) => setTimeout(r, 250)); } } };
const targets = await until(async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()));
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const wait = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; wait.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Network.enable");
for (const [name, value] of jar) await send("Network.setCookie", { name, value, domain: "localhost", path: "/" });
await send("Emulation.setDeviceMetricsOverride", { width: Number(width), height: 900, deviceScaleFactor: 1, mobile: Number(width) < 600 });
for (const p of paths) {
  await send("Page.navigate", { url: base + p });
  await new Promise((r) => setTimeout(r, 3500));
  const h = (await send("Runtime.evaluate", { expression: "document.documentElement.scrollHeight", returnByValue: true })).result.result.value;
  await send("Emulation.setDeviceMetricsOverride", { width: Number(width), height: Math.min(h, 12000), deviceScaleFactor: 1, mobile: Number(width) < 600 });
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const name = p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
  writeFileSync(`${out}/${name}-${width}.png`, Buffer.from(shot.result.data, "base64"));
  console.log("saved", `${out}/${name}-${width}.png`, "height", h);
}
ws.close(); chrome.kill();
process.exit(0);
