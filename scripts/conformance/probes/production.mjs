// Read only checks on the live site (default https://culture.pac.africa). Creates nothing, signs in as nobody.
//   node scripts/conformance/probes/production.mjs [base-url]
import { ok, done } from "../../lib/e2e.mjs";
const base = process.argv[2] ?? "https://culture.pac.africa";
const get = (p, init = {}) => fetch(base + p, { redirect: "manual", ...init });

let r = await get("/");
ok("[PROD-home] home page is up", r.status === 200, r.status);
const html = await r.text();
ok("[PROD-home] home page carries the ways in (survey, 360, sign in)", /Begin or resume/.test(html) && /Open the questionnaire/.test(html) && /href="\/login"/.test(html));

r = await get("/api/health");
const h = r.status === 200 ? await r.json() : {};
ok("[APPI-rules-version] live rules version is 2.0 and instrument 1.1", h.rules === "2.0" && h.instrument === "1.1", JSON.stringify(h));

r = await get("/dashboard");
ok("[0.5-auth] staff pages need sign in (redirect to /login)", r.status === 307 && (r.headers.get("location") ?? "").includes("/login"), r.status);
r = await get("/v1/assessments/asm_doesnotexist/score", { method: "POST" });
const pj = await r.json().catch(() => ({}));
ok("[APPJ-problem] API errors are RFC 7807 problem documents", (r.headers.get("content-type") ?? "").includes("application/problem+json") && typeof pj.code === "string", `${r.status} ${r.headers.get("content-type")}`);
ok("[0.5-auth] unauthenticated API call is refused", [401, 403].includes(r.status), r.status);

r = await get("/v1/survey", { headers: { "x-survey-token": "0".repeat(32) } });
const tj = await r.json().catch(() => ({}));
ok("[APPJ-TOKEN_INVALID] an unknown survey token gives 410 TOKEN_INVALID", r.status === 410 && tj.code === "TOKEN_INVALID", `${r.status} ${tj.code}`);
r = await get("/v1/l360", { headers: { "x-survey-token": "0".repeat(32) } });
ok("[APPJ-TOKEN_INVALID] an unknown 360 token gives 410", r.status === 410, r.status);

r = await get("/respond");
const rh = await r.text();
ok("[2.6-token] survey page asks robots not to index it", /noindex/.test(rh), "no noindex");
ok("[2.6-token] survey page sends no referrer (the token stays in the hash)", /no-referrer/.test(rh) || (r.headers.get("referrer-policy") ?? "").includes("no-referrer"), r.headers.get("referrer-policy"));

r = await get("/v1/reports/rep_doesnotexist/export?format=pdf");
ok("[APPJ-EXPORT] export without sign in is refused", [401, 403].includes(r.status), r.status);

const sec = (await get("/login")).headers;
ok("[0.4-security] HTTPS strict transport security header", !!sec.get("strict-transport-security"), "missing");
ok("[0.4-security] frames are refused (X-Frame-Options or frame-ancestors)", !!sec.get("x-frame-options") || /frame-ancestors/.test(sec.get("content-security-policy") ?? ""), "missing");
ok("[0.4-security] content type sniffing off", sec.get("x-content-type-options") === "nosniff", sec.get("x-content-type-options"));
done();
