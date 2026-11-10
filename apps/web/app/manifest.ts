import type { MetadataRoute } from "next";

// Web app manifest, served at /manifest.webmanifest. Colours are the site's orange and paper tones (cdp.css).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Culture Dynamics Profile (CDP)",
    short_name: "CDP",
    description: "A culture and strategy alignment platform from Priority Activator Consulting.",
    start_url: "/",
    display: "browser",
    background_color: "#FAF7F2",
    theme_color: "#EB5733",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
