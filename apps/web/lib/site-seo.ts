import type { Metadata } from "next";

// Per-page head for the public site: title, description and a canonical that points at the page itself (not "/").
// A page's openGraph replaces the layout's wholesale, so the shared card fields and the generated image (app/opengraph-image.tsx) are repeated here.
const IMAGE = [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Culture Dynamics Profile (CDP) by Priority Activator Consulting" }];

export function pageMeta(path: string, title: string, description: string): Metadata {
  return {
    title, description, alternates: { canonical: path },
    openGraph: { type: "website", siteName: "Culture Dynamics Profile (CDP)", locale: "en_GB", title, description, url: path, images: IMAGE },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
  };
}
