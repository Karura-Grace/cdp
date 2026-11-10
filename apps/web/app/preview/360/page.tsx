import type { Metadata } from "next";
import Form from "@/app/respond360/form";
import { staffGate } from "@/lib/session";
import { serverDb } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Leadership 360 preview | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// Signed in staff see the 360 self assessment or rater form exactly as leaders and raters do. No token, nothing is stored.
export default async function Page({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  await staffGate(await serverDb(), `/preview/360?as=${as === "self" ? "self" : "rater"}`);
  return <Form preview={as === "self" ? "SELF" : "RATER"} />;
}
