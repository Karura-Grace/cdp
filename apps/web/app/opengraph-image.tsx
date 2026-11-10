import { ImageResponse } from "next/og";

export const alt = "Culture Dynamics Profile (CDP) by Priority Activator Consulting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link preview for LinkedIn, WhatsApp and Slack. Text only, system fonts, so nothing is fetched at build time.
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FAF7F2", padding: 72, borderLeft: "24px solid #EB5733" }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: "#EB5733", letterSpacing: 2 }}>CULTURE DYNAMICS PROFILE (CDP)</div>
        <div style={{ fontSize: 76, fontWeight: 800, color: "#131313", lineHeight: 1.1, display: "flex", flexWrap: "wrap" }}>
          <span>Your strategy is written.&nbsp;</span>
          <span style={{ color: "#EB5733" }}>Is your culture able to deliver it?</span>
        </div>
        <div style={{ fontSize: 32, color: "#131313" }}>Priority Activator Consulting · cdp.pac.africa</div>
      </div>
    ),
    size,
  );
}
