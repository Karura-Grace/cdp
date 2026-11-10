/**
 * Canonical JSON and payload hashing (spec §3.4: payload_hash). Byte-compatible with the Python oracle:
 * keys sorted, separators "," and ":", Decimals as plain strings, non-ASCII escaped as \uXXXX.
 */
import { createHash } from "node:crypto";
import { decString, isDecimal } from "./num.js";

export function toJsonable(obj: unknown): unknown {
  if (isDecimal(obj)) return decString(obj);
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(toJsonable);
  if (obj instanceof Set) return [...obj].map(toJsonable);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj as object).sort()) out[k] = toJsonable((obj as Record<string, unknown>)[k]);
  return out;
}

function escapeString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (c < 0x20 || c > 0x7f) {
      if (c > 0xffff) {
        const v = c - 0x10000;
        out += "\\u" + (0xd800 + (v >> 10)).toString(16).padStart(4, "0") + "\\u" + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0");
      } else out += "\\u" + c.toString(16).padStart(4, "0");
    } else out += ch;
  }
  return out + '"';
}

/** Serialise an already-jsonable value exactly as Python json.dumps(sort_keys=True, separators=(",", ":")). */
export function canonicalJson(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new Error(`Binary float ${v} in canonical payload; use Decimal`);
    return String(v);
  }
  if (typeof v === "string") return escapeString(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map((k) => escapeString(k) + ":" + canonicalJson(o[k])).join(",") + "}";
}

export function payloadHash(jsonable: unknown): string {
  return "sha256:" + createHash("sha256").update(canonicalJson(jsonable), "utf8").digest("hex");
}
