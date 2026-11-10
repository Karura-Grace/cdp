// Tenant record fields (spec Table 15). Pure, so the organisations page and the routes share one list.
import { ISO_4217 } from "./iso4217";
export const SECTORS = ["FINANCIAL_SERVICES", "NGO_SOCIAL_IMPACT", "MANUFACTURING", "TECHNOLOGY", "PUBLIC_SECTOR", "HEALTH", "RETAIL", "ENERGY_UTILITIES", "OTHER"] as const;
export const REGIMES = ["KE_DPA_2019", "UG_DPPA_2019", "RW_DPP_2021", "TZ_PDPA_2022", "NG_NDPA_2023", "GH_DPA_2012", "OTHER"] as const;
export const REGIME_LABEL: Record<string, string> = {
  KE_DPA_2019: "Kenya Data Protection Act, 2019", UG_DPPA_2019: "Uganda Data Protection and Privacy Act, 2019", RW_DPP_2021: "Rwanda data protection law, 2021",
  TZ_PDPA_2022: "Tanzania Personal Data Protection Act, 2022", NG_NDPA_2023: "Nigeria Data Protection Act, 2023", GH_DPA_2012: "Ghana Data Protection Act, 2012", OTHER: "Other (name it)",
};
// The platform runs in one EU region (no African region exists, CLAUDE.md §2), so that is the only hosting region on offer.
export const RESIDENCY = ["eu-west-1"] as const;

export interface TenantInput {
  name: string; legal_name: string; sector: string; headcount: number; geographies: string[];
  privacy_regime: string; residency_region: string; timezone: string;
  /** Optional on the way in: left out keeps the stored colour, empty clears it. */
  cover_colour?: string | null;
  /** The client currency (ISO 4217): money KPIs use it (owner ruling 19 October 2026). Same in and out rules as cover_colour. */
  currency_code?: string | null;
}

export function cleanCurrency(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || (typeof v === "string" && !v.trim())) return null;
  return typeof v === "string" && ISO_4217.has(v.trim().toUpperCase()) ? v.trim().toUpperCase() : undefined;
}

/** The client cover colour: a six digit hex such as #1F7A5C (upper cased), empty for none. Null when it is not valid. */
export const COVER_COLOUR = /^#[0-9A-Fa-f]{6}$/;
export function cleanColour(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || (typeof v === "string" && !v.trim())) return null;
  return typeof v === "string" && COVER_COLOUR.test(v.trim()) ? v.trim().toUpperCase() : undefined;
}

const validZone = (z: string) => { try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; } };

/** Returns the cleaned record, or the list of problems. `regime_name` carries the free text when the regime is OTHER. */
export function checkTenant(b: Record<string, unknown>): { ok: TenantInput } | { errors: string[] } {
  const errors: string[] = [];
  const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const name = s("name"), legal = s("legal_name") || name;
  if (!name || name.length > 200) errors.push("Name is required (up to 200 characters).");
  if (legal.length > 200) errors.push("Legal name is at most 200 characters.");
  if (!(SECTORS as readonly string[]).includes(s("sector"))) errors.push("Choose a sector.");
  const hc = b.headcount;
  if (typeof hc !== "number" || !Number.isInteger(hc) || hc < 1 || hc > 1_000_000) errors.push("Headcount must be a whole number from 1 to 1,000,000.");
  const geo = Array.isArray(b.geographies) ? (b.geographies as unknown[]).map((g) => String(g).trim().toUpperCase()) : [];
  if (!geo.length || geo.length > 60 || geo.some((g) => !/^[A-Z]{2}$/.test(g))) errors.push("Give at least one country as a two-letter code (for example KE, UG).");
  let regime = s("privacy_regime");
  if (!(REGIMES as readonly string[]).includes(regime)) errors.push("Choose a privacy regime.");
  else if (regime === "OTHER") {
    const n = s("regime_name");
    if (!n || n.length > 100) errors.push("Name the privacy regime (up to 100 characters).");
    else regime = `OTHER:${n}`;
  }
  if (!(RESIDENCY as readonly string[]).includes(s("residency_region"))) errors.push("Choose the hosting region.");
  if (!validZone(s("timezone"))) errors.push("Time zone must be an IANA name, for example Africa/Nairobi.");
  if (b.cover_colour !== undefined && b.cover_colour !== null && b.cover_colour !== "" && cleanColour(b.cover_colour) === undefined) errors.push("The cover colour is a six digit hex such as #1F7A5C.");
  if (b.currency_code !== undefined && b.currency_code !== null && b.currency_code !== "" && cleanCurrency(b.currency_code) === undefined) errors.push("The currency is a three letter ISO 4217 code such as KES.");
  if (errors.length) return { errors };
  const cc = cleanColour(b.cover_colour), cur = cleanCurrency(b.currency_code);
  return { ok: { ...(cc !== undefined ? { cover_colour: cc } : {}), ...(cur !== undefined ? { currency_code: cur } : {}), name, legal_name: legal, sector: s("sector"), headcount: hc as number, geographies: [...new Set(geo)], privacy_regime: regime, residency_region: s("residency_region"), timezone: s("timezone") } };
}

/** A1 to A4 of Setup Section A (name, sector, headcount, geography): the part of the tenant record the Client Admin maintains (spec Table 16). */
export function checkSectionA(b: Record<string, unknown>): { ok: { name: string; sector: string; headcount: number; geographies: string[] } } | { errors: string[] } {
  const errors: string[] = [];
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 200) errors.push("Name is required (up to 200 characters).");
  const sector = typeof b.sector === "string" ? b.sector.trim() : "";
  if (!(SECTORS as readonly string[]).includes(sector)) errors.push("Choose a sector.");
  const hc = b.headcount;
  if (typeof hc !== "number" || !Number.isInteger(hc) || hc < 1 || hc > 1_000_000) errors.push("Headcount must be a whole number from 1 to 1,000,000.");
  const geo = Array.isArray(b.geographies) ? (b.geographies as unknown[]).map((g) => String(g).trim().toUpperCase()) : [];
  if (!geo.length || geo.length > 60 || geo.some((g) => !/^[A-Z]{2}$/.test(g))) errors.push("Give at least one country as a two-letter code (for example KE, UG).");
  return errors.length ? { errors } : { ok: { name, sector, headcount: hc as number, geographies: [...new Set(geo)] } };
}
