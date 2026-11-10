import type { MetadataRoute } from "next";
import { ARTICLES } from "@/lib/insights";

const PAGES: [string, number, "weekly" | "monthly" | "yearly"][] = [
  ["", 1, "monthly"], ["/platform", 0.8, "monthly"], ["/methodology", 0.8, "monthly"], ["/solutions", 0.8, "monthly"],
  ["/insights", 0.7, "weekly"], ["/contact", 0.7, "yearly"], ["/about", 0.6, "yearly"], ["/security", 0.4, "yearly"],
  ["/what-is-cdp", 0.9, "monthly"], ["/privacy", 0.3, "yearly"], ["/terms", 0.3, "yearly"], ["/cookies", 0.3, "yearly"],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = ARTICLES.map((a) => ({ url: `https://cdp.pac.africa/insights/${a.slug}`, lastModified: a.updated, changeFrequency: "monthly" as const, priority: 0.7 }));
  return [...PAGES.map(([p, priority, changeFrequency]) => ({ url: `https://cdp.pac.africa${p}`, changeFrequency, priority })), ...posts];
}
