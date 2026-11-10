import { NextResponse } from "next/server";
import { serverDb } from "@/lib/supabase/server";

export async function POST(req: Request) {
  await (await serverDb()).auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
