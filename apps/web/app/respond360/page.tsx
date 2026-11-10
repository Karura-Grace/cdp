import type { Metadata } from "next";
import Form from "./form";

// The 360 token lives in the URL hash, which browsers never send to a server.
export const metadata: Metadata = {
  title: "Leadership 360 | PAC Africa",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <Form />;
}
