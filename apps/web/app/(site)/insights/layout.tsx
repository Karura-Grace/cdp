import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-seo";

export const metadata: Metadata = pageMeta("/insights", "Culture Insights and The Cultural Pulse Newsletter | CDP", "Monthly briefings on organisational culture, leadership and strategy execution from Priority Activator Consulting.");

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
