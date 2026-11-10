"""Generate oracle cases: inputs + Python-engine outputs, written as JSON for the TypeScript cross-check.

Run:  python3 oracle/dump.py   (from the package root; needs scipy)
"""
import json, random, sys, os
from datetime import date
sys.path.insert(0, os.path.dirname(__file__))
from cdp_oracle import scoring as S, checks as C, planning as P, config as cfg
from cdp_oracle.num import to_jsonable, ORIENTATIONS, DIMENSIONS_CS
from cdp_oracle.fixture import demo_responses, SETUP, ratings_for, ILLUSTRATIVE_LEADER

OUT = os.path.join(os.path.dirname(__file__), "cases")
START = date(2026, 11, 2)
GOALS = ["RESULTS_GROWTH", "INNOVATION_NEW_MODELS", "PEOPLE_TALENT", "COMPLIANCE_PROCESS", "TRANSFORMATION"]
MODELS = ["PRODUCT_B2B", "SERVICE_B2C", "PLATFORM_DIGITAL", "NGO_SOCIAL_IMPACT", "REGULATED"]


def run(responses, setup_in, leaders, scope, rules="2.0"):
    with cfg.with_rules(rules):
        return _run(responses, setup_in, leaders, scope)


def _run(responses, setup_in, leaders, scope):
    setup = {"leadership_target_orientation": C.leadership_target(setup_in["f1_tags"], setup_in.get("tie_break")),
             "c1_requirements": C.c1_requirements(setup_in["priorities"]),
             "c4_requirement": C.c4_requirement(setup_in["business_model"], setup_in.get("planned_model")),
             "kpi_for": setup_in.get("kpi_for", {})}
    target = setup["leadership_target_orientation"]
    results = []
    for l in leaders:
        r = S.score_leader(l["self"], l["raters"], target)
        r.update(assignment_id=l["assignment_id"], headcount_led=l["headcount_led"])
        results.append(r)
    resp = json.loads(json.dumps(responses))
    obj, payload, h = S.score_assessment(resp, setup, results, scope)
    ev = C.evaluate(obj, setup)
    plan = P.build_plan(obj, ev, setup, START)
    for p in plan["priorities"]:
        p["blocked_by"] = P.blocked_by(p, ev)
    return {"setup_derived": to_jsonable(setup), "score": payload, "hash": h,
            "evaluation": to_jsonable(ev), "plan": to_jsonable(plan)}


def rand_alloc(rng, style):
    if style == "uniform":
        return dict(zip(ORIENTATIONS, [25, 25, 25, 25]))
    cuts = sorted(rng.randint(0, 100) for _ in range(3))
    v = [cuts[0], cuts[1] - cuts[0], cuts[2] - cuts[1], 100 - cuts[2]]
    rng.shuffle(v)
    return dict(zip(ORIENTATIONS, v))


def rand_response(rng, i):
    style = rng.choices(["normal", "uniform", "dup", "partial", "insufficient", "speeder"], [70, 6, 6, 8, 5, 5])[0]
    now = {d: [rand_alloc(rng, "uniform" if style == "uniform" else "x") for _ in range(3)] for d in DIMENSIONS_CS}
    if style == "dup":
        pref = json.loads(json.dumps(now))
    else:
        pref = {d: [rand_alloc(rng, "x") for _ in range(3)] for d in DIMENSIONS_CS}
    if style == "partial":
        pref = {}
    if style == "insufficient":
        now = {d: (now[d] if d in ("D1", "D2") else []) for d in DIMENSIONS_CS}
        pref = {}
    likert = {}
    for d in ("D7", "D8", "D9"):
        if style == "speeder" and rng.random() < 0.5:
            likert[d] = [3] * 12
        else:
            likert[d] = [rng.choice([1, 2, 3, 3, 4, 4, 5]) if rng.random() > 0.08 else None for _ in range(12)]
    eos = [rng.randint(0, 10) if rng.random() > 0.05 else None for _ in range(8)]
    if rng.random() < 0.05:
        eos = []
    dur = rng.randint(300, 400) if style == "speeder" else rng.randint(1200, 3600)
    return {"id": f"rsp_{i:04d}", "duration": dur,
            "snapshot": {"is_executive": rng.random() < 0.25, "department": rng.choice(["dep_a", "dep_b", "dep_c"]),
                         "grade": rng.choice(["G1", "G2", "G3"]), "tenure_band": rng.choice(["<1y", "1-3y", "5y+"])},
            "alloc": {"NOW": now, "PREFERRED": pref}, "likert": likert, "eos": eos}


def rand_ratings(rng, n_none=0.1, required=False):
    return [rng.randint(1, 5) if (required or rng.random() > n_none) else None for _ in range(60)]


def rand_case(seed):
    rng = random.Random(seed)
    n = rng.randint(6, 60)
    responses = [rand_response(rng, i) for i in range(n)]
    for k in range(3):     # guarantee complete responses exist
        r = responses[k]
        r["alloc"]["PREFERRED"] = {d: [rand_alloc(rng, "x") for _ in range(3)] for d in DIMENSIONS_CS}
        r["alloc"]["NOW"] = {d: [rand_alloc(rng, "x") for _ in range(3)] for d in DIMENSIONS_CS}
        r["likert"] = {d: [rng.randint(1, 5) for _ in range(12)] for d in ("D7", "D8", "D9")}
        r["eos"] = [rng.randint(0, 10) for _ in range(8)]
        r["duration"] = rng.randint(1500, 3000)
    tags = [rng.choice(ORIENTATIONS) for _ in range(5)]
    counts = {o: tags.count(o) for o in ORIENTATIONS}
    top = max(counts.values()); winners = [o for o in ORIENTATIONS if counts[o] == top]
    planned = rng.choice(MODELS) if rng.random() < 0.2 else None
    setup = {"priorities": [{"ref": f"B3.{j+1}", "goal_type": rng.choice(GOALS)} for j in range(rng.randint(1, 3))],
             "business_model": rng.choice(MODELS), "planned_model": planned, "f1_tags": tags,
             "tie_break": rng.choice(winners) if len(winners) > 1 else None,
             "kpi_for": {o: {"name": f"KPI {o}", "baseline": rng.randint(10, 40), "target": rng.randint(41, 80)}
                         for o in ORIENTATIONS if rng.random() < 0.6}}
    leaders, scope = [], []
    for j in range(rng.randint(0, 4)):
        hc = rng.randint(3, 40)
        scope.append({"headcount_led": hc})
        if rng.random() < 0.8:
            raters = [{"group": rng.choice(["SUPERIOR", "PEER", "DIRECT_REPORT", "OTHER"]), "ratings": rand_ratings(rng, 0.2)}
                      for _ in range(rng.randint(1, 9))]
            leaders.append({"assignment_id": f"lda_{j:02d}", "headcount_led": hc,
                            "self": rand_ratings(rng, required=True) if rng.random() > 0.1 else None, "raters": raters})
    return {"responses": responses, "setup": setup, "leaders": leaders, "scope": scope}


def fixture_case(with_leader=False):
    setup = {"priorities": SETUP["priorities"], "business_model": "SERVICE_B2C", "planned_model": None,
             "f1_tags": SETUP["f1_tags"], "kpi_for": SETUP["kpi_for"]}
    leaders = []
    if with_leader:
        rat = ratings_for(ILLUSTRATIVE_LEADER["other"])
        leaders = [{"assignment_id": "lda_ill", "headcount_led": 140, "self": ratings_for(ILLUSTRATIVE_LEADER["self"]),
                    "raters": [{"group": "DIRECT_REPORT", "ratings": rat}] * 4 + [{"group": "PEER", "ratings": rat}] * 3 +
                              [{"group": "SUPERIOR", "ratings": rat}]}]
    return {"responses": demo_responses(), "setup": setup, "leaders": leaders, "scope": [{"headcount_led": 10}] * 63 + [{"headcount_led": 140}]}


def welch_cases():
    from scipy import stats
    rng = random.Random(7)
    out = []
    for _ in range(60):
        a = [round(rng.uniform(0, 60), 4) for _ in range(rng.randint(2, 40))]
        b = [round(rng.uniform(0, 60) + rng.choice([0, 3, 10]), 4) for _ in range(rng.randint(2, 40))]
        out.append({"a": a, "b": b, "p": round(float(stats.ttest_ind(a, b, equal_var=False).pvalue), 12)})
    return out


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    skipped = []
    cases = [("fixture", fixture_case()), ("fixture_leader", fixture_case(True))] + [(f"random_{s:03d}", rand_case(s)) for s in range(120)]
    # rules 2.1 (V-02, V-05): the fixtures and 40 random sets again under the new rules
    cases += [(f"{n}_r21", {**c, "rules": "2.1"}) for n, c in cases[:42]]
    manifest = []
    for name, inp in cases:
        try:
            out = run(inp["responses"], inp["setup"], inp["leaders"], inp["scope"], inp.get("rules", "2.0"))
        except Exception as e:      # the Python engine cannot score this input; recorded, not compared
            skipped.append({"case": name, "error": f"{type(e).__name__}: {e}"})
            continue
        with open(os.path.join(OUT, f"{name}.json"), "w") as f:
            json.dump({"name": name, "start": str(START), "input": inp, "expected": out}, f, separators=(",", ":"))
        manifest.append(name)
    with open(os.path.join(OUT, "welch.json"), "w") as f:
        json.dump(welch_cases(), f)
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump({"cases": manifest, "skipped": skipped}, f, indent=1)
    print(len(manifest), "cases;", len(skipped), "skipped")
    for s in skipped[:10]:
        print("  skip", s)
