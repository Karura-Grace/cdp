# Client owned action plan: design (for the owner to approve)

Status: BUILT 25 October 2026 (rules 2.2 published). Approved by the owner 24 Oct (Q-AP5 to Q-AP8). Tests: scripts/e2e-client-plan.mjs (56 checks). Not yet built: unit level actions (the engine emits organisation level actions only, so a People Leader acts on nothing until J5 adds them). It follows Erick Ngala comment 67 and the owner's answers Q-AP1 to Q-AP4 in `context-sessions/DECISIONS-LOG.md`. It changes a workflow the spec describes (section 5.6: the consultant moves actions through review and co design), so it needs your approval before any schema, role or engine change.

## What you decided
- When the report is released, the system puts every proposed action in front of the client. The client accepts or defers each one. The consultant no longer moves actions.
- Client Admin, Executives and People Leaders (for actions in their own unit) may rank and accept. A Coach views only.
- Ranking: the client drags the priorities into their own order and marks each action Now, Next or Later. The engine's order is the starting point; the client's order is kept beside it.
- The system keeps the cap on priorities and the blocking pre-conditions. The client ranks inside them and sees why a priority is held.

## How it works today (so you can see what changes)
Actions are created as DRAFT by the engine. The consultant moves Draft to In review to In co design. An Executive or People Leader approves (In co design to Approved), the consultant publishes (Approved to Published), then the client works it (In progress, Under review, Closed). Mandatory before approval: owner, sponsor, KPI, baseline, target, start date, end date (and a budget for structural actions). Only the consultant edits those fields. The database function `rpc_action_transition` checks the caller is on the engagement; the roles per move live in the engine's transition table (`rules-data.ts`, with an oracle copy).

## Proposed design

### 1. Who moves what (engine transition table, a new rules version 2.2 for new plans)
| Move | Today | New |
|---|---|---|
| Draft to In review, In review to In co design | PAC Consultant | The system, automatically when the report is released (one step, "proposed") |
| In co design to Approved | Executive, People Leader | Executive, People Leader, Client Admin (this is the client's "accept") |
| Approved to Published | PAC Consultant | Client Admin, Executive (the client publishes what it accepted); blocked while a pre-condition is open, as today |
| Discard with a reason | PAC Consultant | Client Admin, Executive (a deferral is not a discard, see 2) |
| All later moves | Client roles, consultant on review | Unchanged |

Plans already stored keep their rules version and work as before. The consultant keeps a read only view and can still add notes outside the plan.

### 2. Defer, Now, Next, Later, and the client's order (schema, needs approval)
- New insert only table `plan_client_view (assessment_id, score_version, priority_id, client_rank, set_by, set_at)`: the client's order of priorities. The engine's `sequence` is never changed.
- New columns on `action`, written through a function: `client_horizon` (NOW, NEXT, LATER, null) and `client_decision` (ACCEPTED, DEFERRED, null) with `decided_by` and `decided_at`. Deferring keeps the action alive and visible, it only parks it. Accepting is the move to Approved.
- Every change is audited and history is kept in `action_event`, as for status changes.

### 3. Fields the consultant used to fill in
Owner, sponsor, KPI, baseline, target and dates are now filled by the client. The system proposes defaults so the client is not starting empty: owner role from the priority, KPI from the playbook (the action's own KPI suggestion), dates from the plan start and the horizon. The client edits them before accepting. Mandatory fields still block acceptance.

### 4. Limits (kept by the system)
The cap on priorities, the pre-condition gates (P0) and the mandatory fields all stay in the engine. A held priority shows "held until: <pre-condition>". The client cannot reorder a held priority above the gate, and cannot publish an action under an open gate.

### 5. Who sees what, and when
Nothing about the plan reaches the client before release (already enforced by row level security). After release: Client Admin and Executives see and act on every action; a People Leader sees and acts on the actions of their own unit; the Coach sees only; the consultant sees everything and acts on nothing.

## Build slices (each pushed with tests)
1. Engine: transition table version 2.2, system step at release, tests in `src/` and `oracle/`, regenerate cases.
2. Schema: `plan_client_view`, action columns, writer functions, RLS tests per role.
3. Routes and rules: release triggers the proposed state; accept, defer, rank, publish for the client roles; unit scoping for People Leaders.
4. Screens: the client's plan page with ranking, Now, Next, Later, held reasons, and field defaults.
5. e2e: `e2e-plan` and `e2e-lifecycle` updated, a new client plan suite, conformance.

## Open points for you
1. A new rules version means the engine, the oracle and the stored version all change. Approve a version 2.2 for new plans only, as above?
2. "Defer" parks an action without a reason. Should a deferral need a short reason, as a discard does?
3. People Leaders accepting actions "in their own unit": the unit comes from the leader's team in the leaders file. Is that the right line?
4. The playbook suggests a KPI per action. Should the client be able to replace it with their own KPI from the scorecard (Setup C and D)?
