// Session limits (lib/session-policy.ts): 7 days absolute, 8 hours idle. Run: node --experimental-strip-types scripts/check-session-policy.mts
import assert from "node:assert/strict";
import { sessionEnd } from "../apps/web/lib/session-policy.ts";
const jwt = (t: number) => "x." + Buffer.from(JSON.stringify({ amr: [{ method: "password", timestamp: t }] })).toString("base64url") + ".y";
const now = 2_000_000_000;
assert.equal(sessionEnd(jwt(now - 3600), undefined, now), null);
assert.equal(sessionEnd(jwt(now - 8 * 86400), undefined, now), "EXPIRED");
assert.equal(sessionEnd(jwt(now - 3600), String(now - 9 * 3600), now), "IDLE");
assert.equal(sessionEnd(jwt(now - 3600), String(now - 60), now), null);
assert.equal(sessionEnd("garbage", undefined, now), null);
console.log("session policy ok");
