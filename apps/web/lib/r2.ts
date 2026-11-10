import "server-only";
import { AwsClient } from "aws4fetch";

// Cloudflare R2 through its S3 API. Every object is private: uploads and downloads use signed links that expire in 5 minutes.
// Configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET (a key scoped to that one bucket).
const TTL = 300;
const env = () => {
  const { R2_ACCOUNT_ID: acc, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket } = process.env;
  return acc && id && secret && bucket ? { acc, id, secret, bucket } : null;
};
export const r2Configured = () => env() !== null;

function client() {
  const e = env();
  if (!e) throw Object.assign(new Error("R2_NOT_CONFIGURED"), { code: "R2_NOT_CONFIGURED" });
  return { aws: new AwsClient({ accessKeyId: e.id, secretAccessKey: e.secret, service: "s3", region: "auto" }), base: `https://${e.acc}.r2.cloudflarestorage.com/${e.bucket}/` };
}
const url = (base: string, key: string, q: Record<string, string> = {}) => {
  const u = new URL(base + key.split("/").map(encodeURIComponent).join("/"));
  for (const [k, v] of Object.entries({ "X-Amz-Expires": String(TTL), ...q })) u.searchParams.set(k, v);
  return u;
};

/** A signed PUT the browser uses once; the content type is part of the signature. */
export async function signedPut(key: string, contentType: string) {
  const { aws, base } = client();
  const r = await aws.sign(url(base, key).toString(), { method: "PUT", headers: { "content-type": contentType }, aws: { signQuery: true, allHeaders: true } });
  return r.url;
}

/** A signed GET that downloads under the original file name. */
export async function signedGet(key: string, fileName: string) {
  const { aws, base } = client();
  const safe = fileName.replace(/[^\w.\- ]/g, "_");
  const r = await aws.sign(url(base, key, { "response-content-disposition": `attachment; filename="${safe}"` }).toString(), { method: "GET", aws: { signQuery: true } });
  return r.url;
}

/** Size and type of an uploaded object, or null when it does not exist. */
export async function head(key: string) {
  const { aws, base } = client();
  const r = await aws.fetch(base + key.split("/").map(encodeURIComponent).join("/"), { method: "HEAD" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`R2 HEAD ${r.status}`);
  return { size: Number(r.headers.get("content-length")), type: r.headers.get("content-type") ?? "" };
}

export async function remove(key: string) {
  const { aws, base } = client();
  await aws.fetch(base + key.split("/").map(encodeURIComponent).join("/"), { method: "DELETE" });
}
