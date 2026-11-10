// RFC 7807 responses with the Appendix J codes. Engine `Problem` objects pass straight through.
export interface Problem { code: string; status: number; title: string; [k: string]: unknown }

export function problem(p: Problem): Response {
  return new Response(JSON.stringify({ type: `about:blank#${p.code}`, ...p }), {
    status: p.status,
    headers: { "content-type": "application/problem+json", "cache-control": "no-store" },
  });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Exception messages raised by the capture functions (migration 3) -> Appendix J.
// Token failures share one neutral 410 so a link cannot be probed (CLAUDE.md §4).
const DB_CODES: Record<string, Problem> = {
  TOKEN_INVALID: { code: "TOKEN_INVALID", status: 410, title: "This link is no longer valid." },
  ALREADY_SUBMITTED: { code: "TOKEN_INVALID", status: 410, title: "This link is no longer valid." },
  CONSTANT_SUM_VIOLATION: { code: "CONSTANT_SUM_VIOLATION", status: 422, title: "Allocations must total exactly 100." },
  SCALE_OUT_OF_RANGE: { code: "SCALE_OUT_OF_RANGE", status: 422, title: "A value is outside its scale." },
  VALIDATION_FAILED: { code: "VALIDATION_FAILED", status: 422, title: "The submission is not valid." },
  DATA_NOT_FROZEN: { code: "DATA_NOT_FROZEN", status: 409, title: "The data set is not frozen." },
  USER_NOT_FOUND: { code: "USER_NOT_FOUND", status: 404, title: "That user was not found." },
  PASSWORD_UNCHANGED: { code: "PASSWORD_UNCHANGED", status: 422, title: "Choose a new password first." },
  ALREADY_DECIDED: { code: "ILLEGAL_TRANSITION", status: 409, title: "That has already been decided." },
  ILLEGAL_TRANSITION: { code: "ILLEGAL_TRANSITION", status: 409, title: "That step is not allowed in the current state." },
  SETUP_TIE_UNRESOLVED: { code: "SETUP_TIE_UNRESOLVED", status: 422, title: "Section F has a tie among its tags that the consultant has not resolved." },
  SETUP_SEQUENCE_VIOLATION: { code: "SETUP_SEQUENCE_VIOLATION", status: 409, title: "That setup section comes later in the order. Agree the earlier sections first." },
  SETUP_LOCKED: { code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." },
  RESIDENCY_LOCKED: { code: "ILLEGAL_TRANSITION", status: 409, title: "Hosting region and privacy regime cannot change once an engagement has launched." },
  GRAPH_CHANGED: { code: "ILLEGAL_TRANSITION", status: 409, title: "The organisation graph or the window changed while launching. Check the launch checks again." },
  LEADER_NOT_TEAM: { code: "VALIDATION_FAILED", status: 422, title: "A leader can only be assigned to a team." },
  GRAPH_REFERENCE: { code: "VALIDATION_FAILED", status: 422, title: "The graph refers to a person, team or row that does not exist." },
  leader_assignment_one_per_team: { code: "VALIDATION_FAILED", status: 422, title: "A team has one accountable leader on any date; two assignments overlap." },
  grade_rank_unique: { code: "VALIDATION_FAILED", status: 422, title: "Two grades share a rank order." },
  CONSENT_REQUIRED: { code: "ILLEGAL_TRANSITION", status: 409, title: "Consent is needed before answers can be submitted." },
  CONSENT_TEXT_REQUIRED: { code: "ILLEGAL_TRANSITION", status: 409, title: "An approved consent text is needed before launch." },
  CONSENT_TEXT_LOCKED: { code: "ILLEGAL_TRANSITION", status: 409, title: "An approved consent text does not change." },
  TEXT_KEY_MISSING: { code: "UNAVAILABLE", status: 503, title: "Free-text answers cannot be saved right now. Clear them or try again later; your other answers are kept." },
  RELEASE_INCOMPLETE: { code: "RELEASE_INCOMPLETE", status: 422, title: "The report cannot be released yet." },
  ALREADY_INVITED: { code: "ILLEGAL_TRANSITION", status: 409, title: "This person already has a link for this assessment." },
  BLOCKING_GATE_OPEN: { code: "BLOCKING_GATE_OPEN", status: 409, title: "A pre-condition (P0) item must be completed before this action is published." },
  EVIDENCE_REQUIRED: { code: "EVIDENCE_REQUIRED", status: 409, title: "Add evidence before closing the action." },
  ACTION_LOCKED: { code: "ILLEGAL_TRANSITION", status: 409, title: "The plan fields are fixed once the action is approved." },
  PLAN_AGREED: { code: "ILLEGAL_TRANSITION", status: 409, title: "This development plan is agreed and no longer changes." },
  RESPONSES_EXIST: { code: "ILLEGAL_TRANSITION", status: 409, title: "A new version cannot replace an assessment that already has responses." },
  ASSESSMENT_NOT_LAUNCHED: { code: "ILLEGAL_TRANSITION", status: 409, title: "Only a launched assessment can have a new version." },
  FORBIDDEN: { code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." },
  REPORT_RELEASED: { code: "ILLEGAL_TRANSITION", status: 409, title: "A released report does not change." },
  BELOW_REPORTING_THRESHOLD: { code: "BELOW_REPORTING_THRESHOLD", status: 409, title: "Too few people answered for this to be shown." },
  SCORE_FROZEN: { code: "ILLEGAL_TRANSITION", status: 409, title: "A frozen score does not change." },
  ASSESSMENT_PINNED: { code: "ILLEGAL_TRANSITION", status: 409, title: "The window is fixed after launch; use an extension." },
};

export function fromDbError(message: string): Response {
  const hit = Object.keys(DB_CODES).find((k) => message.includes(k));
  return problem(hit ? DB_CODES[hit] : { code: "INTERNAL", status: 500, title: "Something went wrong." });
}
