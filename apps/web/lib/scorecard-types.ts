// Types and enums shared by the scorecard server code and screen (no server imports, so the browser can load it).
export const UNITS = ["PERCENT", "COUNT", "CURRENCY", "RATIO", "DAYS", "SCORE", "OTHER"] as const;
export const DIRECTIONS = ["HIGHER_IS_BETTER", "LOWER_IS_BETTER"] as const;
export const ORIENTS = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"] as const;
/** A value of the KPI on a day. One per KPI per day: sending the same day again replaces it. */
export interface ReadingIn { read_on: string; value: number; note?: string | null }
export interface KpiIn {
  name: string; unit: string; currency_code?: string | null; direction: string; baseline_value: number; baseline_date: string;
  baseline_source: string; target_12m: number; target_3y?: number | null; orientation?: string | null; _row?: number;
  /** The id of this KPI in the client's own scorecard system. Import matches on it first. */
  external_ref?: string | null;
  /** Readings to add or replace. Absent means leave the stored readings alone. */
  readings?: ReadingIn[];
  /** Ids of existing culture actions to link to this KPI (additive). */
  linked_actions?: string[];
}
export interface ObjIn { title: string; priority_keys: string[]; kpis: KpiIn[]; _row?: number; external_ref?: string | null }
export interface LinkedAction { action_id: string; objective: string; status: string; level: string }
export interface KpiOut extends KpiIn { kpi_id: string; readings: ReadingIn[]; linked_actions: string[]; actions: LinkedAction[] }
export interface ObjOut { objective_id: string; title: string; priority_keys: string[]; external_ref: string | null; kpis: KpiOut[] }
