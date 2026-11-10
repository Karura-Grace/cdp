"""Stage 4 rules engine: alignment checks, signals, severity and scenarios (spec §4.5)."""
from .num import D, q, mean, dec, ORIENTATIONS
from . import config as cfg
from .scoring import ranked, dominance, lowest, perception_flag, readiness_band_index

ORDER = {"MISS": 0, "SYSTEMIC_MISS": 0, "PARTIAL_HIT": 1, "HIT": 2}

# ---------------------------------------------------------------- requirements (§1.5)

def c1_requirements(priorities):
    """priorities: list of {"ref": "B3.1", "goal_type": "..."} → merged requirement list."""
    reqs = {}
    for p in priorities:
        typ, ors, th = cfg.GOAL_TYPES[p["goal_type"]]
        r = reqs.setdefault(p["goal_type"], {"requirement_id": f"req_{len(reqs)+1:02d}", "goal_type": p["goal_type"],
                                             "type": typ, "orientations": ors, "thresholds": th, "source_refs": []})
        r["source_refs"].append(p["ref"])
    return list(reqs.values())


def c4_requirement(model, planned=None, transition=False):
    if transition or (planned and planned != model):
        return {"type": "BALANCED", "orientations": list(ORIENTATIONS),
                "thresholds": {o: cfg.BALANCED_THRESHOLD for o in ORIENTATIONS}, "model": model, "model_transition": True}
    typ, ors = cfg.BUSINESS_MODELS[model]
    return {"type": typ, "orientations": ors, "thresholds": {o: cfg.SINGLE_THRESHOLD[o] for o in ors},
            "model": model, "model_transition": False}


def leadership_target(behaviour_tags, tie_break=None):
    counts = {o: behaviour_tags.count(o) for o in ORIENTATIONS}
    top = max(counts.values())
    winners = [o for o in ORIENTATIONS if counts[o] == top]
    if len(winners) > 1:
        if tie_break not in winners:
            raise ValueError("Tie in Section F tags must be resolved by the consultant")
        return tie_break
    return winners[0]

# ---------------------------------------------------------------- C1 / C4 (§4.5.1)

def _min(a, b):
    return a if ORDER[a] <= ORDER[b] else b


def alignment_verdict(req, now):
    R, T = req["orientations"], req["thresholds"]
    subs = {r: min(D(100), D(100) * dec(now[r]) / T[r]) for r in R}
    pct = q(mean(subs.values()), 1)
    hit, partial = cfg.get("checks.alignment_bands")
    verdict = "HIT" if pct >= hit else "PARTIAL_HIT" if pct >= partial else "MISS"
    overrides = []
    # Override 1: strict thresholds; not exceeding one caps the verdict (recorded when it changes the verdict)
    if any(dec(now[r]) <= T[r] for r in R):
        nv = _min(verdict, "PARTIAL_HIT")
        if nv != verdict:
            overrides.append("OVERRIDE_1_BELOW_THRESHOLD")
        verdict = nv
    # Override 2: a required orientation that is lowest forces MISS (never for BALANCED); always recorded
    if req["type"] != "BALANCED" and any(r in lowest(now) for r in R):
        overrides.append("OVERRIDE_2_LOWEST")
        verdict = "MISS"
    # Override 3: DOMINANT requirement also needs the highest NOW score
    if req["type"] == "DOMINANT" and R[0] not in dominance(now)["dominant"]:
        nv = _min(verdict, "PARTIAL_HIT")
        if nv != verdict:
            overrides.append("OVERRIDE_3_NOT_DOMINANT")
        verdict = nv
    return {"verdict": verdict, "alignment_pct": pct, "subs": {k: q(v, 1) for k, v in subs.items()}, "overrides": overrides}

# ---------------------------------------------------------------- C2 (§4.5.2)

def behaviour_gap(dim_now, target):
    prof = {o: q(mean([dim_now["D2"][o], dim_now["D3"][o]]), 2) for o in ORIENTATIONS}
    order = ranked(prof)
    rank = 1 + sum(1 for o in ORIENTATIONS if prof[o] > prof[target])
    gap = q(prof[order[0]] - prof[target], 2)
    if rank == 1:
        v = "HIT"
    elif rank == 2 and gap < cfg.get("scoring.dominance.shared_lt"):
        v = "HIT"
    elif rank == 2:
        v = "PARTIAL_HIT"
    else:
        v = "MISS"
    lo, hi = cfg.get("checks.c2_intensity")
    intensity = "MARGINAL" if gap < lo else "SUBSTANTIVE" if gap < hi else "ENTRENCHED"
    return {"verdict": v, "rank": rank, "behaviour_gap_points": gap, "intensity": intensity, "profile": prof,
            "shared_dominance": rank == 2 and gap < cfg.get("scoring.dominance.shared_lt")}

# ---------------------------------------------------------------- C3 (§4.5.3)

def stop_start(dim_now, classes):
    def is_mod(d):
        return any(classes[o] == "MODERATE" for o in dominance(dim_now[d])["dominant"])
    m = sum(1 for d in ("D4", "D6") if is_mod(d))
    verdict = {0: "HIT", 1: "PARTIAL_HIT", 2: "SYSTEMIC_MISS"}[m]
    offending = []
    for d in ("D4", "D6"):
        for o in dominance(dim_now[d])["dominant"]:
            if classes[o] == "MODERATE" and o not in offending:
                offending.append(o)
    return {"verdict": verdict, "moderate_count": m, "identity_risk": is_mod("D4"), "offending": offending}

# ---------------------------------------------------------------- severity (§4.5.6)

def severity_for(kind, verdict, extra=None):
    extra = extra or {}
    if kind in ("C1", "C4") and verdict == "MISS":
        return "CRITICAL"
    if kind in ("C1", "C4") and verdict == "PARTIAL_HIT":
        return "HIGH" if extra.get("significant_build") else "MEDIUM"
    if kind == "C2":
        return "HIGH" if verdict == "MISS" else "MEDIUM" if verdict == "PARTIAL_HIT" else "LOW"
    if kind == "C3":
        return "HIGH" if verdict == "SYSTEMIC_MISS" else "MEDIUM" if verdict == "PARTIAL_HIT" else "LOW"
    if kind == "PERCEPTION":
        return "CRITICAL" if verdict == "SHADOW_CULTURE" else "MEDIUM"
    if kind == "EOS":
        return "CRITICAL" if extra.get("organisation_wide") else "MEDIUM"
    if kind == "TPS":
        return "CRITICAL" if verdict == "HIGH_RISK" else "LOW"
    return "LOW"

# ---------------------------------------------------------------- scenario library (§4.5.5)

SCENARIOS = [
    ("SC-01", "Delivery without belonging", "HIGH",
     lambda c: c["dom"] == "PERFORM" and c["strength"] >= 5 and c["gap"]["ENGAGE"] >= 8 and (c["eos"]["Q6"] < 0 or c["eos"]["Q4"] < 0),
     "Results are funded from discretionary effort that is running out.",
     ["Attrition of key talent", "Burnout", "Service-quality decay", "Employer-brand damage"],
     ["Is the pace a deliberate strategic choice or an unmanaged default?", "Are managers rewarded for output only?",
      "Has headcount lagged volume growth?", "Is recognition exclusively individual and commercial?"]),
    ("SC-02", "Order without ideas", "HIGH",
     lambda c: c["dom"] == "GOVERN" and c["gap"]["INNOVATE"] >= 8 and c["d7"] <= D("3.0"),
     "Control has hardened into a brake.",
     ["Loss of relevance", "Slow product cycles", "Talent leaves for more latitude"],
     ["How many approval layers stand between an idea and a pilot?", "Is failure punished informally?",
      "Is there any unallocated experimentation budget?"]),
    ("SC-03", "Ideas without delivery", "HIGH",
     lambda c: c["dom"] == "INNOVATE" and (c["gap"]["GOVERN"] >= 8 or c["gap"]["PERFORM"] >= 8),
     "Creative energy scatters; few initiatives reach customers.",
     ["Cash burn without return", "Cynicism from unfinished initiatives", "Compliance exposure"],
     ["Is there a stop rule for initiatives?", "Who owns the portfolio?", "Are launches counted as success rather than adoption?"]),
    ("SC-04", "Care without accountability", "HIGH",
     lambda c: c["dom"] == "ENGAGE" and c["strength"] >= 10 and c["gap"]["PERFORM"] >= 8,
     "Cohesion is protected at the cost of performance conversations.",
     ["Targets missed", "Strong performers leave", "Decisions slow to consensus"],
     ["Are difficult conversations avoided?", "Do managers lack the skill or the will?", "Does reward differentiate at all?"]),
    ("SC-05", "Shadow culture", "CRITICAL",
     lambda c: c["pg"] is not None and any(v > 7 for v in c["pg"].values()),
     "Executives and staff describe two different organisations.",
     ["Interventions read as out of touch", "Communication increases cynicism", "Programme fails before content"],
     ["Which channels do executives rely on?", "Is there an unfiltered upward route?", "Do middle managers translate or buffer?"]),
    ("SC-09", "Low transformation readiness", "CRITICAL",
     lambda c: c["tps"] is not None and c["tps"] < D("2.50"),
     "The organisation cannot yet sustain the change it has named.",
     ["Public failure of a programme", "Loss of leadership credibility"],
     ["Is the constraint safety, capacity or leadership alignment?", "How did the last change programme end?"]),
    ("SC-10", "Systems fighting the strategy", "HIGH",
     lambda c: c["c3"] == "SYSTEMIC_MISS",
     "Reward and recognition pay for the behaviour the organisation wants to stop.",
     ["Change agenda disbelieved", "Compliant staff disadvantaged", "Entrenched cynicism"],
     ["What genuinely gets people promoted?", "What was last publicly celebrated?", "Does variable pay reward the moderated orientation?"]),
    ("SC-11", "Everything at once", "MEDIUM",
     lambda c: sum(1 for o in ORIENTATIONS if c["cls"][o] in ("BUILD", "STRENGTHEN")) >= 3,
     "No strategic choice has been made.",
     ["Resource dilution", "Plan collapses at first budget round"],
     ["Were Sections B–D completed against the approved strategy?", "Which single KPI matters most?"]),
    ("SC-12", "Aligned and under-recognised", "LOW",
     lambda c: c["all_hit"] and c["strength"] >= 10 and all(v >= 0 for v in c["eos"].values() if v is not None),
     "The culture serves the strategy; the risk is erosion.",
     ["Drift as the organisation grows", "Loss of the rituals that sustain the profile"],
     ["Which rituals carry the culture?", "What would break it at twice the headcount?"]),
]
SEV_RANK = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def match_scenarios(score, checks):
    eos = {k: v for k, v in score["eos"].items() if k.startswith("Q")}
    ctx = {"dom": score["dominance"]["dominant"][0], "strength": score["culture_strength"],
           "gap": score["orientation_scores"]["gap"], "eos": eos, "d7": q(score["readiness"]["d7"], 1),
           "pg": score.get("perception_gap"), "tps": score["readiness"]["tps"], "c3": checks["C3"]["verdict"],
           "cls": score["classification"],
           "all_hit": all(v == "HIT" for v in (checks["C1"]["verdict"], checks["C2"]["verdict"], checks["C3"]["verdict"], checks["C4"]["verdict"]))}
    out = []
    for sid, name, sev, fn, diag, risks, hyp in SCENARIOS:
        try:
            ok = fn(ctx)
        except (TypeError, KeyError):
            ok = False
        if ok:
            out.append({"scenario_id": sid, "name": name, "severity": sev, "diagnosis": diag, "risks": risks, "hypotheses": hyp})
    return sorted(out, key=lambda s: (SEV_RANK[s["severity"]], s["scenario_id"]))

# ---------------------------------------------------------------- evaluate

def evaluate(score, setup):
    now = score["orientation_scores"]["now"]
    classes = score["classification"]
    target = setup["leadership_target_orientation"]
    findings = []
    seq = [0]

    def add(**f):
        seq[0] += 1
        f.setdefault("blocking", False)
        f["finding_id"] = f"fnd_{seq[0]:04d}"
        findings.append(f)
        return f

    c1s = []
    for req in setup["c1_requirements"]:
        r = alignment_verdict(req, now)
        sigb = any(classes[o] == "BUILD" for o in req["orientations"])
        f = add(type="C1_PERFORMANCE_ALIGNMENT", orientation=req["orientations"], verdict=r["verdict"],
                severity=severity_for("C1", r["verdict"], {"significant_build": sigb}),
                metrics={"alignment_pct": r["alignment_pct"], "subs": r["subs"]},
                evidence={"requirement": req, "now": {o: now[o] for o in req["orientations"]}, "overrides": r["overrides"]})
        c1s.append(f)
    c1_head = min((f["verdict"] for f in c1s), key=lambda v: ORDER[v]) if c1s else "HIT"
    c4r = alignment_verdict(setup["c4_requirement"], now)
    c4 = add(type="C4_MODEL_READINESS", orientation=setup["c4_requirement"]["orientations"], verdict=c4r["verdict"],
             severity=severity_for("C4", c4r["verdict"], {"significant_build": any(classes[o] == "BUILD" for o in setup["c4_requirement"]["orientations"])}),
             metrics={"alignment_pct": c4r["alignment_pct"], "subs": c4r["subs"]},
             evidence={"requirement": setup["c4_requirement"], "overrides": c4r["overrides"]})
    c2r = behaviour_gap(score["dimension_now"], target)
    pf = score.get("perception_flags") or {}
    c2 = add(type="C2_BEHAVIOUR_GAP", orientation=[target], verdict=c2r["verdict"], severity=severity_for("C2", c2r["verdict"]),
             metrics={k: c2r[k] for k in ("rank", "behaviour_gap_points", "intensity", "shared_dominance")},
             evidence={"profile": c2r["profile"], "target": target},
             escalated_with="SHADOW_CULTURE" if c2r["verdict"] == "MISS" and pf.get(target) == "SHADOW_CULTURE" else None)
    c3r = stop_start(score["dimension_now"], classes)
    c3 = add(type="C3_STOP_START", orientation=c3r["offending"], verdict=c3r["verdict"], severity=severity_for("C3", c3r["verdict"]),
             metrics={"moderate_count": c3r["moderate_count"], "identity_risk": c3r["identity_risk"]}, evidence={"offending": c3r["offending"]})
    if score.get("perception_gap"):
        for o in ORIENTATIONS:
            fl = pf[o]
            if fl != "NONE":
                add(type="PERCEPTION_GAP", orientation=[o], verdict=fl, severity=severity_for("PERCEPTION", fl),
                    metrics={"perception_gap": score["perception_gap"][o]}, blocking=fl == "SHADOW_CULTURE",
                    blocks={"orientation": o} if fl == "SHADOW_CULTURE" else None)
    for k, v in score["eos"].items():
        if k.startswith("Q") and v is not None and v < 0:
            add(type="ENGAGEMENT_MISS", category=k, verdict="FLAG", severity=severity_for("EOS", "FLAG", {"organisation_wide": True}),
                metrics={"score": v}, blocking=True, blocks={"cohort": "ORGANISATION", "category": k})
    rd = score["readiness"]
    if rd["tps"] is not None:
        add(type="READINESS_SIGNAL", signal="TPS_BAND", verdict="FLAG", severity=severity_for("TPS", rd["tps_band"]),
            metrics={"value": rd["tps"], "band": rd["tps_band"], "provisional": rd["provisional"], "coverage": rd["coverage"]})
    gate = cfg.get("gates.readiness_le")
    for dim, scope in (("d8", {"orientations": ["ENGAGE", "INNOVATE"], "class": "BUILD"}), ("d9", {"content": True}), ("d7", {"technology": True})):
        if rd[dim] is not None and q(rd[dim], 1) <= gate:
            add(type="READINESS_SIGNAL", signal=f"{dim.upper()}_LE_3", verdict="FLAG", severity="HIGH",
                metrics={"value": q(rd[dim], 1)}, blocking=True, blocks=scope)
    checks = {"C1": {"verdict": c1_head, "findings": [f["finding_id"] for f in c1s]}, "C2": c2, "C3": c3, "C4": c4}
    scen = match_scenarios(score, checks)
    return {"findings": findings, "checks": {"C1": c1_head, "C2": c2["verdict"], "C3": c3["verdict"], "C4": c4["verdict"]},
            "c1": c1s, "c2": c2, "c3": c3, "c4": c4, "scenarios": scen,
            "blocking": [f for f in findings if f.get("blocking")]}
