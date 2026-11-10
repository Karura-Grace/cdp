import type { Metadata } from "next";
import { Inter, Open_Sans, Poppins } from "next/font/google";
import "./reset.css";
import "./globals.css";

// Same families and weights as the live site, self-hosted so respondents' browsers never call Google.
const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

// Inter is the typeface of the new design; only the staff area uses it (.stf).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

// Everything outside the public site (login, dashboard, survey, staff screens) is noindex by default; the (site) layout switches indexing on.
export const metadata: Metadata = {
  metadataBase: new URL("https://cdp.pac.africa"),
  robots: { index: false, follow: false },
  title: "Culture Dynamics Profile | Priority Activator Consulting",
  description: "A culture and strategy alignment platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${openSans.variable} ${poppins.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
