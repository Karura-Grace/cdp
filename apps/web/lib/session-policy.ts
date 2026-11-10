// Session limits enforced by the app, because Supabase's own session limits need a paid plan.
//   * absolute: 7 days from sign-in (the JWT's amr timestamp), for every caller;
//   * idle: 8 hours without a page view, for browser sessions (an httpOnly cookie the middleware refreshes).
// The caller has already validated the user with auth.getUser(); this only reads the time claims.
export const IDLE_COOKIE = "cdp_seen";
const MAX_AGE_S = 7 * 24 * 3600;
const IDLE_S = 8 * 3600;

export function signedInAt(accessToken: string | undefined): number | null {
  try {
    const p = JSON.parse(Buffer.from(accessToken!.split(".")[1], "base64url").toString("utf8")) as { amr?: { timestamp?: number }[] };
    const t = p.amr?.map((a) => a.timestamp ?? 0).sort((a, b) => b - a)[0];
    return t ?? null;
  } catch { return null; }
}

/** Why a session must end now, or null if it may continue. `seen` is the idle cookie value (seconds) when there is one. */
export function sessionEnd(accessToken: string | undefined, seen: string | undefined, now = Math.floor(Date.now() / 1000)): "EXPIRED" | "IDLE" | null {
  const at = signedInAt(accessToken);
  if (at !== null && now - at > MAX_AGE_S) return "EXPIRED";
  const s = Number(seen);
  if (seen && Number.isFinite(s) && now - s > IDLE_S) return "IDLE";
  return null;
}
