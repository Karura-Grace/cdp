import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IDLE_COOKIE, sessionEnd } from "./lib/session-policy";

// Refreshes the Supabase session cookie and keeps signed-out visitors off staff pages.
// /respond and /v1/survey are token-based and never pass through here (see matcher).
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();   // validates the JWT with Auth, unlike getSession()
  if (!data.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  const { data: s } = await supabase.auth.getSession();          // the JWT was validated by getUser() above
  const end = sessionEnd(s.session?.access_token, req.cookies.get(IDLE_COOKIE)?.value);
  if (end) {
    await supabase.auth.signOut();
    const out = NextResponse.redirect(new URL(`/login?expired=1&next=${encodeURIComponent(req.nextUrl.pathname)}`, req.url));
    res.cookies.getAll().forEach((c) => out.cookies.set(c));      // carries the cleared auth cookies
    out.cookies.delete(IDLE_COOKIE);
    return out;
  }
  res.cookies.set(IDLE_COOKIE, String(Math.floor(Date.now() / 1000)), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 8 * 3600 });
  return res;
}

// Node runtime: the Edge bundle of @supabase/ssr trips Edge's ban on eval() in production (every route returned 500).
export const config = { runtime: "nodejs", matcher: ["/dashboard/:path*", "/reports/:path*", "/users/:path*", "/engagements/:path*", "/organisations/:path*", "/templates/:path*", "/account/:path*", "/assessments/:path*", "/preview"] };
