// C4 default business model by sector and A5 maturity (V-30, DRAFT for faculty review, docs/designs/J2-respondent-360.md).
// It only prefills B6 on a section B that has none yet; the B6 choice always wins and scoring reads B6, never this table.
// null means no default: "Other" sectors, and turnaround or post merger, where the consultant records today's model and a planned model.
type Model = "PRODUCT_B2B" | "SERVICE_B2C" | "PLATFORM_DIGITAL" | "NGO_SOCIAL_IMPACT" | "REGULATED";
const EARLY: Record<string, Model | null> = {
  FINANCIAL_SERVICES: "REGULATED", NGO_SOCIAL_IMPACT: "NGO_SOCIAL_IMPACT", MANUFACTURING: "PRODUCT_B2B", TECHNOLOGY: "PLATFORM_DIGITAL",
  PUBLIC_SECTOR: "REGULATED", HEALTH: "REGULATED", RETAIL: "SERVICE_B2C", ENERGY_UTILITIES: "REGULATED", OTHER: null,
};
const MATURE: Record<string, Model | null> = { ...EARLY, TECHNOLOGY: "PRODUCT_B2B" };

export function c4Default(sector: string | null | undefined, maturity: unknown): Model | null {
  if (!sector) return null;
  if (maturity === "START_UP" || maturity === "GROWTH") return EARLY[sector] ?? null;
  if (maturity === "MATURE") return MATURE[sector] ?? null;
  return null;
}
