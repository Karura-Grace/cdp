/** Engine input and output shapes. Inputs are plain JSON (as produced by the capture layer); outputs carry Decimals. */
import type { Decimal, Orientation, Dimension, LikertDim, Profile } from "./num.js";

export type Allocation = Record<Orientation, number>;
export type Perspective = "NOW" | "PREFERRED";

/** One submitted culture response, already unlinked from any person (spec §2.4). */
export interface ResponseInput {
  id: string;
  duration?: number | null;                 // active seconds
  snapshot: Record<string, unknown> & { is_executive?: boolean };
  alloc: Partial<Record<Perspective, Partial<Record<Dimension, (Allocation | null)[]>>>>;
  likert?: Partial<Record<LikertDim, (number | null)[]>>;
  eos?: (number | null)[];
  voided?: boolean;
}

export type CompletionState = "COMPLETE" | "SUBSTANTIALLY_COMPLETE" | "PARTIAL_CULTURE" | "INSUFFICIENT" | "ABANDONED";
export type QualityFlag = "SPEEDING" | "STRAIGHT_LINING" | "UNIFORM_ALLOCATION" | "PERSPECTIVE_DUPLICATION";

export interface ScoredResponse extends ResponseInput {
  _state: CompletionState;
  _flags: QualityFlag[];
}

export interface Requirement {
  requirement_id?: string;
  goal_type?: string;
  type: "SINGLE" | "JOINT" | "PAIRED" | "DOMINANT" | "BALANCED";
  orientations: Orientation[];
  thresholds: Partial<Record<Orientation, Decimal>>;
  source_refs?: string[];
  model?: string;
  model_transition?: boolean;
}

export interface KpiRef { name: string; baseline: number | string; target: number | string }

/** Derived setup consumed by the engine (spec §1.7 outputs). */
export interface EngineSetup {
  leadership_target_orientation: Orientation;
  c1_requirements: Requirement[];
  c4_requirement: Requirement;
  kpi_for?: Partial<Record<Orientation, KpiRef>>;
}

/** Agreed setup fields the requirement derivation reads (Sections B and F). */
export interface SetupInput {
  priorities: { ref: string; goal_type: string; text?: string }[];
  business_model: string;
  planned_model?: string | null;
  f1_tags: Orientation[];
  tie_break?: Orientation | null;
  kpi_for?: Partial<Record<Orientation, KpiRef>>;
}

export type RaterGroup = "SUPERIOR" | "PEER" | "DIRECT_REPORT" | "OTHER";
export interface RaterInput { group: RaterGroup; ratings: (number | null)[] }
export interface LeaderInput {
  assignment_id: string;
  headcount_led: number;
  self: (number | null)[] | null;
  raters: RaterInput[];
}

export type { Profile };
