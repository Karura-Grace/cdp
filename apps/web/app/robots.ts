import type { MetadataRoute } from "next";

const BOTS = ["Googlebot", "Bingbot", "OAI-SearchBot", "GPTBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Claude-User", "Google-Extended"];

// Owner Q-SEO-5: search and AI crawlers all welcome. Login and app screens are kept out by noindex (root layout), not by blocking here.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }, ...BOTS.map((userAgent) => ({ userAgent, allow: "/" }))],
    sitemap: "https://cdp.pac.africa/sitemap.xml",
  };
}
