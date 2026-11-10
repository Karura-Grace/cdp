"""Stage 5 advisory engine (spec §5.5–§5.6): priority zero, selection, pathways, actions, workflow, RAG."""
from datetime import date, timedelta
from .num import D, q, dec, ORIENTATIONS
from . import config as cfg
from .scoring import priority_cap, ranked

NEIGHBOURS = {"ENGAGE": ("INNOVATE", "GOVERN"), "INNOVATE": ("ENGAGE", "PERFORM"),
              "PERFORM": ("INNOVATE", "GOVERN"), "GOVERN": ("ENGAGE", "PERFORM")}
DIAGONAL = {"ENGAGE": "PERFORM", "PERFORM": "ENGAGE", "INNOVATE": "GOVERN", "GOVERN": "INNOVATE"}
POLE = {frozenset(("ENGAGE", "INNOVATE")): "ADAPTIVE", frozenset(("PERFORM", "GOVERN")): "STRUCTURED",
        frozenset(("INNOVATE", "PERFORM")): "OUTWARD", frozenset(("GOVERN", "ENGAGE")): "INWARD"}
ADAPTIVE = {"ENGAGE", "INNOVATE"}

PATHWAYS = {
    ("PERFORM", "ENGAGE"): ("“We perform best when our people are at their best.”", "Coach-first leadership development; CDP-anchored 360; wellbeing investment; team-based recognition."),
    ("ENGAGE", "PERFORM"): ("“Delivering for our customers is how we secure each other’s future.”", "Commercial acumen; objective-setting rigour; performance-conversation skills; visible scoreboard."),
    ("GOVERN", "INNOVATE"): ("“Our discipline is what lets us experiment safely.”", "Innovation sprints; permission to fail; fewer approval layers; ring-fenced experimentation budget."),
    ("INNOVATE", "GOVERN"): ("“Good systems let our best ideas scale.”", "Process discipline; documentation; quality management system; governance training."),
    ("ENGAGE", "INNOVATE"): ("“Our trust is the safety net for bold ideas.”", "Idea forums; action learning; protected experimentation time."),
    ("INNOVATE", "ENGAGE"): ("“Great ideas need great teams.”", "Mentoring; team rituals; retention plans for creative talent."),
    ("ENGAGE", "GOVERN"): ("“Fairness and consistency are how we care at scale.”", "Role clarity; standardised people processes; documented decision rights."),
    ("GOVERN", "ENGAGE"): ("“Our standards exist to serve the people who deliver them.”", "Manager coaching capability; participative process design."),
    ("INNOVATE", "PERFORM"): ("“Ideas only count when customers pay for them.”", "Phase-gate discipline; commercial targets on the portfolio."),
    ("PERFORM", "INNOVATE"): ("“Tomorrow’s targets depend on today’s experiments.”", "Innovation objectives in scorecards; sandbox time; pilot funding."),
    ("PERFORM", "GOVERN"): ("“Reliability is how we keep winning.”", "Control framework; quality metrics beside delivery metrics."),
    ("GOVERN", "PERFORM"): ("“Our systems exist to deliver results, not to be admired.”", "Outcome measures; customer proximity; delegated decision rights."),
}

PLAYBOOK = {
    "ENGAGE": {"signal": "CEO publicly recognises a manager for developing talent at an all-staff forum.",
               "levers": [("PERFORMANCE_MANAGEMENT", "Add a people-development objective to every manager’s scorecard."),
                          ("PROMOTION", "Make a track record of developing others a promotion criterion."),
                          ("REWARD", "Recognise team outcomes, not only individual ones."),
                          ("ONBOARDING", "Assign a buddy and hold structured 30/60/90-day check-ins.")],
               "medium": "Coach-first leadership programme with a CDP-anchored 360 baseline and re-measure.",
               "watch": ["D2 S2", "D3 S2", "D4 S2", "D8", "eOS Q1", "eOS Q4", "eOS Q6", "eOS Q7"]},
    "INNOVATE": {"signal": "Publicly celebrate a well-run experiment that failed, and share what was learned.",
                 "levers": [("PERFORMANCE_MANAGEMENT", "Include an innovation or improvement objective in scorecards."),
                            ("PROMOTION", "Reward intelligent risk-taking and learning from failure."),
                            ("REWARD", "Fund an innovation budget or protected time; recognise experiments as well as successes."),
                            ("DECISION_RIGHTS", "Remove the full-business-case requirement before a pilot below a set value.")],
                 "medium": "Run three 90-day customer-journey innovation sprints with a ring-fenced budget.",
                 "watch": ["D1 S3", "D2 S1", "D5 S1", "D5 S3", "D7", "D8", "eOS Q3"]},
    "PERFORM": {"signal": "Publish a simple team scoreboard and publicly recognise a delivery win against it.",
                "levers": [("PERFORMANCE_MANAGEMENT", "Cascade clear targets with a quarterly review rhythm."),
                           ("PROMOTION", "Base promotion on delivered, measurable results."),
                           ("REWARD", "Link variable pay to a small number of measurable outcomes."),
                           ("ONBOARDING", "Set clear performance expectations in the first week.")],
                "medium": "Performance-conversation capability programme for all people managers.",
                "watch": ["D2 S1", "D2 S3", "D3 S3", "D5 S1", "D6 S1", "D6 S2", "D6 S3", "eOS Q8", "D8"]},
    "GOVERN": {"signal": "Fix one visible process bottleneck staff complain about, and communicate what changed.",
               "levers": [("PERFORMANCE_MANAGEMENT", "Clarify roles and include quality and compliance measures."),
                          ("PROMOTION", "Reward reliability, quality and sound judgement on risk."),
                          ("REWARD", "Recognise error reduction and process improvements."),
                          ("DECISION_RIGHTS", "Revise the delegation-of-authority matrix to remove redundant sign-offs.")],
               "medium": "Map the top five approval flows and remove at least two layers in each.",
               "watch": ["D1 S2", "D3 S1", "D5 S2", "D6 S3", "D9"]},
}

TIER = {
    "STRATEGIC_MISS": ("CEO+CHRO", 30, 5), "BEHAVIOUR_GAP": ("CHRO+PEOPLE_MANAGERS", 90, 4),
    "PROCESS_CONTRADICTION": ("CHRO+OD", 180, 3), "MODEL_READINESS": ("CEO+EXCO", 540, 2), "PRE_CONDITION": ("CEO+CHRO", 30, 5),
}

# ---------------------------------------------------------------- urgency (§5.5.3)

def urgency_tier(o, ev, target, classes):
    c1_miss = any(f["verdict"] == "MISS" and o in f["orientation"] for f in ev["c1"])
    c1_partial = any(f["verdict"] == "PARTIAL_HIT" and o in f["orientation"] for f in ev["c1"])
    c4 = ev["c4"]
    if c1_miss:
        return "STRATEGIC_MISS"
    if c4["verdict"] == "MISS" and o in c4["orientation"]:
        return "MODEL_READINESS"
    if o == target and ev["c2"]["verdict"] in ("MISS", "PARTIAL_HIT"):
        return "BEHAVIOUR_GAP"
    if c1_partial:
        return "STRATEGIC_MISS"
    if o in ev["c3"]["orientation"] or (classes[o] == "MODERATE"):
        return "PROCESS_CONTRADICTION"
    if c4["verdict"] == "PARTIAL_HIT" and o in c4["orientation"]:
        return "MODEL_READINESS"
    return "PROCESS_CONTRADICTION"


def linked_to_check(o, ev):
    if any(f["verdict"] != "HIT" and o in f["orientation"] for f in ev["c1"]):
        return True
    for k in ("c2", "c3", "c4"):
        if ev[k]["verdict"] != "HIT" and o in ev[k]["orientation"]:
            return True
    return False

# ---------------------------------------------------------------- pathways (§5.5.5)

def stepping_stone(origin, target, now):
    """The neighbour a diagonal shift is routed through (spec 6.5.1): of the two orientations that border both ends, the one already stronger in
    today's profile; on a tie, the one on the same adaptive or structured side as the target."""
    a, b = [n for n in NEIGHBOURS[origin] if n in NEIGHBOURS[target]]
    if now[a] != now[b]:
        return a if now[a] > now[b] else b
    return a if ((a in ADAPTIVE) == (target in ADAPTIVE)) else b


def pathway(origin, target, score):
    if origin == target:
        return None
    rel = "DIAGONAL" if DIAGONAL[origin] == target else "ADJACENT_" + POLE[frozenset((origin, target))]
    narrative, interventions = PATHWAYS[(origin, target)]
    out = {"from": origin, "to": target, "relationship": rel, "difficulty": "HIGH" if rel == "DIAGONAL" else "MODERATE",
           "narrative": narrative, "interventions": interventions, "stepping_stone": None}
    rd = score["readiness"]
    gate = cfg.get("gates.readiness_le")
    low = (rd["tps"] is not None and rd["tps"] < D("3.50")) or q(rd["d8"], 1) <= gate or q(rd["d9"], 1) <= gate
    if rel == "DIAGONAL" and low:
        stone = stepping_stone(origin, target, score["orientation_scores"]["now"])
        out["stepping_stone"] = stone
        out["stepping_narrative"] = PATHWAYS[(origin, stone)][0]
    return out

# ---------------------------------------------------------------- selection (§5.5.4)

def build_plan(score, ev, setup, start=None):
    start = start or date.today()
    classes, gap = score["classification"], score["orientation_scores"]["gap"]
    target = setup["leadership_target_orientation"]
    cand = [o for o in ORIENTATIONS if classes[o] == "BUILD"
            or (classes[o] == "STRENGTHEN" and linked_to_check(o, ev))
            or (classes[o] == "MODERATE" and gap[o] <= -cfg.get("scoring.gap.build"))]

    def key(o):
        c1c4 = any(f["verdict"] == "MISS" and o in f["orientation"] for f in ev["c1"]) or (ev["c4"]["verdict"] == "MISS" and o in ev["c4"]["orientation"])
        c2 = o == target and ev["c2"]["verdict"] == "MISS"
        c3 = ev["c3"]["verdict"] == "SYSTEMIC_MISS" and o in ev["c3"]["orientation"]
        return (not c1c4, not c2, not c3, -abs(gap[o]), ORIENTATIONS.index(o))
    cand.sort(key=key)
    cap = priority_cap(score["readiness"]["tps"])
    selected, deferred = cand[:cap], [{"orientation": o, "reason": "readiness cap", "gap": gap[o]} for o in cand[cap:]]
    origin = ranked(score["orientation_scores"]["now"])[0]
    negatives = sorted([o for o in ORIENTATIONS if gap[o] < 0], key=lambda o: gap[o])
    used, priorities = set(), []
    for i, o in enumerate(selected, start=1):
        tier = urgency_tier(o, ev, target, classes)
        owner, days, _ = TIER[tier]
        p = {"priority_id": f"pri_{i:02d}", "sequence": i, "orientation": o, "classification": classes[o], "gap": gap[o],
             "urgency_tier": tier, "owner_role": owner, "due": str(start + timedelta(days=days)),
             "linked_findings": [f["finding_id"] for f in ev["findings"] if f.get("orientation") and o in f["orientation"]],
             "trade_off_orientation": None, "pathway": None, "c3_levers": False}
        if classes[o] == "BUILD":
            free = [n for n in negatives if n not in used and n != o]
            p["trade_off_orientation"] = (free or [n for n in negatives if n != o])[0]
            used.add(p["trade_off_orientation"])
            p["pathway"] = pathway(origin, o, score)
        elif classes[o] == "STRENGTHEN":
            p["pathway"] = pathway(origin, o, score)
        else:
            p["pathway"] = {"relationship": "MODERATE_OVERPLAY", "narrative": "Moderate the overplay; keep what protects the organisation."}
        priorities.append(p)
    if ev["c3"]["verdict"] in ("PARTIAL_HIT", "SYSTEMIC_MISS"):
        for off in ev["c3"]["orientation"]:
            host = next((p for p in priorities if p["trade_off_orientation"] == off), None) or next((p for p in priorities if p["orientation"] == off), None)
            if host:
                host["c3_levers"] = True
    p0 = []
    groups = {}
    for f in ev["blocking"]:
        if f["type"] == "PERCEPTION_GAP":
            groups.setdefault("SHADOW_CULTURE", []).append(f)
        elif f["type"] == "ENGAGEMENT_MISS":
            groups.setdefault("EOS_NEGATIVE", []).append(f)
        elif f.get("signal") in ("D8_LE_3", "D9_LE_3", "D7_LE_3"):
            groups.setdefault(f["signal"], []).append(f)
    for gate in ("SHADOW_CULTURE", "EOS_NEGATIVE", "D8_LE_3", "D9_LE_3", "D7_LE_3"):
        fs = groups.get(gate)
        if not fs:
            continue
        if gate == "SHADOW_CULTURE":
            text = "Perception-gap workshop (" + " and ".join(f["orientation"][0] for f in fs) + " SHADOW CULTURE)"
        elif gate == "EOS_NEGATIVE":
            text = "Structured listening sessions on eOS " + " and ".join(f["category"] for f in fs) + " with the affected cohorts"
        elif gate == "D8_LE_3":
            text = "Launch the psychological-safety workstream (D8 ≤ 3.0)"
        elif gate == "D9_LE_3":
            text = "Build change infrastructure before content (D9 ≤ 3.0)"
        else:
            text = "Digital adoption plan and executive sponsor for technology-dependent priorities"
        p0.append({"item_id": f"p0_{len(p0)+1:02d}", "gate": gate, "item": text, "finding_ids": [f["finding_id"] for f in fs]})
    zero = {"priority_id": "pri_00", "sequence": 0, "urgency_tier": "PRE_CONDITION", "owner_role": "CEO+CHRO",
            "due": str(start + timedelta(days=cfg.get("plan.visible_signal_days"))), "items": p0} if p0 else None
    for p in priorities:
        p["actions"] = generate_actions(p, ev, setup, start)
    return {"priority_zero": zero, "priorities": priorities, "backlog": deferred, "cap": cap}


def blocked_by(priority, ev):
    """Open blocking findings that prevent publication of this priority's actions."""
    o = priority["orientation"]
    out = []
    for f in ev["blocking"]:
        b = f.get("blocks") or {}
        if b.get("orientation") == o:
            out.append(f["finding_id"])
        elif "orientations" in b and o in b["orientations"] and priority["classification"] == b.get("class"):
            out.append(f["finding_id"])
        elif b.get("cohort") == "ORGANISATION" or b.get("content"):
            out.append(f["finding_id"])
    return out

# ---------------------------------------------------------------- action generation and scoring (§5.5.6–5.5.7)

def impact_rating(p, ev, has_kpi):
    o = p["orientation"]
    c1c4_miss = any(f["verdict"] == "MISS" and o in f["orientation"] for f in ev["c1"]) or (ev["c4"]["verdict"] == "MISS" and o in ev["c4"]["orientation"])
    if c1c4_miss and p["classification"] == "BUILD" and has_kpi:
        base = D(5)
    elif c1c4_miss or (ev["c2"]["verdict"] == "MISS" and o in ev["c2"]["orientation"]) or (ev["c3"]["verdict"] == "SYSTEMIC_MISS" and p.get("c3_levers")):
        base = D(4)
    elif linked_to_check(o, ev) or abs(p["gap"]) >= 8:
        base = D(3)
    elif p["classification"] == "STRENGTHEN":
        base = D(2)
    else:
        base = D(1)
    if abs(p["gap"]) >= 12:
        base = min(D(5), base + D("0.5"))
    return base


def priority_score(impact, urgency, effort):
    return q(dec(impact) * dec(urgency) / dec(effort), 2)


def generate_actions(p, ev, setup, start):
    o = p["orientation"]
    pb = PLAYBOOK[o]
    kpi = setup.get("kpi_for", {}).get(o)
    urg = TIER[p["urgency_tier"]][2]
    imp = impact_rating(p, ev, kpi is not None)
    acts = []

    def add(objective, intervention, horizon, lever, effort, signal=False, days=None):
        n = len(acts) + 1
        end = start + timedelta(days=days or {"QUICK_WIN_0_3M": 90, "MEDIUM_3_12M": 365, "STRUCTURAL_12M_PLUS": 540}[horizon])
        a = {"action_id": f"act_{p['sequence']}{n:02d}", "level": "ORGANISATION", "priority_id": p["priority_id"],
             "linked_finding_id": (p["linked_findings"] or [None])[0], "orientation": o,
             "classification_at_creation": p["classification"], "objective": objective, "intervention": intervention,
             "horizon": horizon, "is_visible_signal": signal, "system_lever": lever, "owner": None, "sponsor": None,
             "start_date": str(start), "end_date": str(end), "status": "DRAFT", "generated_by": "RULES_ENGINE",
             "impact": imp, "urgency": urg, "effort": effort, "priority_score": priority_score(imp, urg, effort),
             "kpi": kpi["name"] if kpi else None, "baseline_value": kpi["baseline"] if kpi else None,
             "target_value": kpi["target"] if kpi else None, "watchlist": pb["watch"], "review_points": ["+30d", "+90d", "+180d"]}
        acts.append(a)
    verb = "Build" if p["classification"] in ("BUILD", "STRENGTHEN") else "Moderate"
    add(f"Make the {o} shift visible within 30 days", pb["signal"], "QUICK_WIN_0_3M", "RECOGNITION_RITUAL", 1, True,
        cfg.get("plan.visible_signal_days"))
    add(f"{verb} {o} capability where it matters for the strategy", pb["medium"], "MEDIUM_3_12M", pb["levers"][-1][0], 3)
    lever = pb["levers"][0]
    add(f"Change the system that sets {o} behaviour", lever[1], "STRUCTURAL_12M_PLUS", lever[0], 4)
    if p.get("trade_off_orientation"):
        t = p["trade_off_orientation"]
        add(f"Release {t} to make room for {o}", f"Name and reduce the {t} overplay that competes with {o}; agree what stops.",
            "MEDIUM_3_12M", "PERFORMANCE_MANAGEMENT", 2)
    if p.get("c3_levers"):
        add("Stop paying for the behaviour the organisation wants to stop",
            "HR systems redesign within 90 days: performance management, promotion criteria, incentives and onboarding.",
            "MEDIUM_3_12M", "REWARD", 4, days=90)
    sig = [a for a in acts if a["is_visible_signal"]]
    rest = sorted([a for a in acts if not a["is_visible_signal"]], key=lambda a: -a["priority_score"])
    return sig + rest[: cfg.get("plan.action_caps")[0] - 1]

# ---------------------------------------------------------------- workflow (§5.6)

TRANSITIONS = {
    ("DRAFT", "IN_REVIEW"): {"PAC_CONSULTANT"},
    ("DRAFT", "DISCARDED"): {"PAC_CONSULTANT"},
    ("IN_REVIEW", "IN_CO_DESIGN"): {"PAC_CONSULTANT"},
    ("IN_CO_DESIGN", "APPROVED"): {"EXECUTIVE", "PEOPLE_LEADER"},
    ("APPROVED", "PUBLISHED"): {"PAC_CONSULTANT"},
    ("PUBLISHED", "IN_PROGRESS"): {"PEOPLE_LEADER", "CLIENT_ADMIN", "EXECUTIVE"},
    ("IN_PROGRESS", "UNDER_REVIEW"): {"PEOPLE_LEADER", "CLIENT_ADMIN", "EXECUTIVE"},
    ("UNDER_REVIEW", "IN_PROGRESS"): {"EXECUTIVE", "PEOPLE_LEADER", "PAC_CONSULTANT"},
    ("UNDER_REVIEW", "CLOSED"): {"EXECUTIVE", "PEOPLE_LEADER"},
    ("UNDER_REVIEW", "RETIRED"): {"EXECUTIVE", "PEOPLE_LEADER", "PAC_CONSULTANT"},
}
# Rules 2.2 (owner ruling 22 Oct 2026, design docs/designs/J4b-client-owned-plan.md): the client owns the plan. The system proposes every action, the client accepts,
# publishes and may discard a draft; the consultant no longer moves actions (the review moves after publication stay). Plans on 2.0 and 2.1 keep TRANSITIONS.
TRANSITIONS_2_2 = {**{k: set(v) for k, v in TRANSITIONS.items()},
    ("DRAFT", "IN_REVIEW"): {"SYSTEM"}, ("DRAFT", "DISCARDED"): {"CLIENT_ADMIN", "EXECUTIVE"}, ("IN_REVIEW", "IN_CO_DESIGN"): {"SYSTEM"},
    ("IN_CO_DESIGN", "APPROVED"): {"CLIENT_ADMIN", "EXECUTIVE", "PEOPLE_LEADER"}, ("APPROVED", "PUBLISHED"): {"CLIENT_ADMIN", "EXECUTIVE"}}


def transitions_for(rules):
    return TRANSITIONS_2_2 if rules == "2.2" else TRANSITIONS


MANDATORY_FOR_APPROVAL = ("owner", "sponsor", "kpi", "baseline_value", "target_value", "start_date", "end_date")


class WorkflowError(Exception):
    def __init__(self, code, detail, status=409):
        self.code, self.detail, self.status = code, detail, status


def transition(action, to, role, open_gates=(), evidence_count=0, reason=None, rules=None):
    frm = action["status"]
    roles = transitions_for(rules).get((frm, to))
    if roles is None:
        raise WorkflowError("ILLEGAL_TRANSITION", f"{frm} → {to} is not allowed")
    if role not in roles:
        raise WorkflowError("FORBIDDEN", f"{role} cannot perform {frm} → {to}", 403)
    if to == "DISCARDED" and not reason:
        raise WorkflowError("VALIDATION_FAILED", "A discard needs a recorded reason", 422)
    if to == "APPROVED":
        missing = [k for k in MANDATORY_FOR_APPROVAL if action.get(k) in (None, "")]
        if action["horizon"] == "STRUCTURAL_12M_PLUS" and not action.get("budget_amount"):
            missing.append("budget_amount")
        if missing:
            raise WorkflowError("VALIDATION_FAILED", "Missing mandatory fields: " + ", ".join(missing), 422)
    if to == "PUBLISHED" and open_gates:
        raise WorkflowError("BLOCKING_GATE_OPEN", "Pre-condition open: " + ", ".join(open_gates))
    if to == "CLOSED" and evidence_count == 0:
        raise WorkflowError("EVIDENCE_REQUIRED", "Upload evidence before closing (document, minutes or KPI report)")
    action = dict(action)
    action["status"] = to
    return action


def rag(action, today, milestones=(), readings=(), review_points_missed=0, at_90_review=False):
    over = [(today - m["due"]).days for m in milestones if m["status"] != "DONE" and m["due"] < today]
    prog = None
    if readings and action.get("target_value") is not None and action.get("baseline_value") is not None:
        b, t, last = dec(action["baseline_value"]), dec(action["target_value"]), dec(readings[-1])
        if t != b:
            prog = (last - b) / (t - b)
    band = cfg.get("tracking.rag_flat_band")
    end = date.fromisoformat(action["end_date"]) if isinstance(action.get("end_date"), str) else action.get("end_date")
    if any(d > 14 for d in over) or (prog is not None and prog < -band) or (end and today > end and action["status"] not in ("CLOSED", "RETIRED")) or review_points_missed >= 2:
        return "RED"
    if over or (at_90_review and prog is not None and abs(prog) <= band) or review_points_missed == 1:
        return "AMBER"
    return "GREEN"


def escalation(days_overdue, red_weeks=0):
    d1, d2, d3, d4 = cfg.get("tracking.escalation_days")
    if red_weeks >= 4:
        return "EXCO_DECISION"
    if days_overdue > d3 or red_weeks >= 2:
        return "TIER_OWNER"
    if days_overdue >= d2:
        return "SPONSOR"
    if days_overdue > 0:
        return "OWNER_DAILY"
    return None
