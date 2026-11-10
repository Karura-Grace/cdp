import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-seo";

export const metadata: Metadata = pageMeta("/contact", "Book a CDP Briefing | Priority Activator Consulting", "Schedule a 15-minute briefing with a Priority Activator Consulting consultant to see how the Culture Dynamics Profile fits your organisation.");

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
