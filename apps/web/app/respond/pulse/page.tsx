import type { Metadata } from "next";
import Form from "./form";

// The pulse token lives in the URL hash, which browsers never send to a server, and the page is kept out of search indexes and referrer headers.
export const metadata: Metadata = {
  title: "Culture pulse | PAC Africa",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <Form />;
}
