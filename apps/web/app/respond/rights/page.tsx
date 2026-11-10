import type { Metadata } from "next";
import Rights from "./rights";

// Your data rights, by survey link. The token stays in the URL hash, which browsers never send to a server.
export const metadata: Metadata = { title: "Your data rights | PAC Africa", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page() { return <Rights />; }
