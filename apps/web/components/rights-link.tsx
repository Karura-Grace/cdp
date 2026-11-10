"use client";

/** Link to the data rights page (/respond/rights). The personal survey link keeps its token in the URL hash, which only the browser can see, so the link carries it over on click. */
export function RightsLink({ children = "Your data rights" }: { children?: React.ReactNode }) {
  return <a href="/respond/rights" onClick={(e) => { e.currentTarget.href = "/respond/rights" + window.location.hash; }} onFocus={(e) => { e.currentTarget.href = "/respond/rights" + window.location.hash; }}>{children}</a>;
}
