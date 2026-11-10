// Browser calls to the /v1 API. Every state changing call carries x-cdp-csrf, which a foreign page cannot add (see lib/staff.ts).
export const api = (method: string, url: string, body?: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json", "x-cdp-csrf": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
