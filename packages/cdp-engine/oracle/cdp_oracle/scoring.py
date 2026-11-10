"""Stage 3 scoring (spec §3.5). Pure, deterministic, Decimal-only functions.

Response shape (engine-internal, produced by the capture layer):
{
  "id": "rsp_1", "duration": 1900, "snapshot": {"is_executive": False, "department": "dep_1", ...},
  "alloc": {"NOW": {"D1": [{"ENGAGE": 20, ...}, {...}, {...}], ...}, "PREFERRED": {...}},
  "likert": {"D7": [5, 4, None, ...12], "D8": [...], "D9": [...]},
  "eos": [9, 7, None, ...8],
}
"""
import hashlib
import json
from .num import D, q, mean, dec, ORIENTATIONS, DIMENSIONS_CS, LIKERT_DIMS, to_jsonable
from . import config as cfg

# ---------------------------------------------------------------- completion and quality (§2.6.3–2.6.4)

def _sets(resp, persp):
    a = resp.get("alloc", {}).get(persp, {})
    return sum(1 for d in DIMENSIONS_CS for s in (a.get(d) or []) if s is not None)


def completion_state(resp):
    now_sets, pref_sets = _sets(resp, "NOW"), _sets(resp, "PREFERRED")
    likert_all = all(v is not None for d in LIKERT_DIMS for v in resp.get("likert", {}).get(d, [None] * 12)) and \
        all(len(resp.get("likert", {}).get(d, [])) == 12 for d in LIKERT_DIMS)
    eos_all = len(resp.get("eos", [])) == 8 and all(v is not None for v in resp.get("eos", []))
    if now_sets < 18:
        return "INSUFFICIENT"
    if pref_sets < 18:
        return "PARTIAL_CULTURE"
    if likert_all and eos_all:
        return "COMPLETE"
    return "SUBSTANTIALLY_COMPLETE"


def quality_flags(resp, median_duration):
    flags = []
    thr = max(D(cfg.get("survey.speeding_min_seconds")), dec(median_duration or 0) * cfg.get("survey.speeding_median_fraction"))
    if resp.get("duration") is not None and D(resp["duration"]) < thr:
        flags.append("SPEEDING")
    vals = [v for d in LIKERT_DIMS for v in resp.get("likert", {}).get(d, []) if v is not None]
    if vals and len(set(vals)) == 1:
        flags.append("STRAIGHT_LINING")
    now = resp.get("alloc", {}).get("NOW", {})
    uniform = sum(1 for d in DIMENSIONS_CS for s in (now.get(d) or []) if s and all(s[o] == 25 for o in ORIENTATIONS))
    if uniform >= cfg.get("quality.uniform_min"):
        flags.append("UNIFORM_ALLOCATION")
    pref = resp.get("alloc", {}).get("PREFERRED", {})
    dup = sum(1 for d in DIMENSIONS_CS for i, s in enumerate(now.get(d) or [])
              if s and pref.get(d) and i < len(pref[d]) and pref[d][i] == s)
    if dup >= cfg.get("quality.duplicate_min"):
        flags.append("PERSPECTIVE_DUPLICATION")
    return flags


def classify_response(resp, median_duration):
    flags = quality_flags(resp, median_duration)
    state = completion_state(resp)
    any_two = cfg.get("quality.exclusion_rule") == "ANY_TWO"   # rules 2.1 (V-02); 2.0: SPEEDING plus one more (D-10)
    if len(flags) > 1 and (any_two or "SPEEDING" in flags):
        state = "INSUFFICIENT"
    return state, flags


def included(resp, purpose):
    st, fl = resp["_state"], resp["_flags"]
    if st == "INSUFFICIENT" or resp.get("voided"):
        return False
    if purpose == "NOW":
        return st in ("COMPLETE", "SUBSTANTIALLY_COMPLETE", "PARTIAL_CULTURE")
    if purpose == "PREFERRED":
        return st in ("COMPLETE", "SUBSTANTIALLY_COMPLETE")
    if purpose == "DOMINANCE":
        return st in ("COMPLETE", "SUBSTANTIALLY_COMPLETE", "PARTIAL_CULTURE") and "UNIFORM_ALLOCATION" not in fl
    if purpose == "LIKERT":
        return not ("STRAIGHT_LINING" in fl and "SPEEDING" in fl)
    return True

# ---------------------------------------------------------------- orientation scores (§3.5.2)

def orientation_profile(responses, persp, dims=DIMENSIONS_CS):
    """Mean allocation per orientation over the given dimensions and responses (2 dp)."""
    if not responses:
        return None
    totals = {o: D(0) for o in ORIENTATIONS}
    n_sets = 0
    for r in responses:
        a = r["alloc"][persp]
        for d in dims:
            for s in a[d]:
                for o in ORIENTATIONS:
                    totals[o] += D(s[o])
                n_sets += 1
    return {o: q(totals[o] / D(n_sets), 2) for o in ORIENTATIONS}


def respondent_score(r, o, persp="NOW"):
    a = r["alloc"][persp]
    return sum((D(s[o]) for d in DIMENSIONS_CS for s in a[d]), D(0)) / D(18)


def dimension_profiles(responses, persp):
    return {d: orientation_profile(responses, persp, (d,)) for d in DIMENSIONS_CS}

# ---------------------------------------------------------------- gap and classification (§3.5.3)

def gaps(now, pref):
    return {o: q(pref[o] - now[o], 2) for o in ORIENTATIONS}


def classify_gap(g):
    g = dec(g)
    if g >= cfg.get("scoring.gap.build"):
        return "BUILD"
    if g >= cfg.get("scoring.gap.strengthen"):
        return "STRENGTHEN"
    if g > -cfg.get("scoring.gap.strengthen"):
        return "KEEP_AND_PROTECT"
    return "MODERATE"


def significant(g):
    return abs(dec(g)) >= cfg.get("scoring.gap.build")

# ---------------------------------------------------------------- dominance, strength, congruence, lenses (§3.5.4–3.5.7)

def ranked(profile):
    """Orientations sorted high→low; deterministic tie-break on canonical order."""
    return sorted(ORIENTATIONS, key=lambda o: (-profile[o], ORIENTATIONS.index(o)))


def dominance(profile):
    r = ranked(profile)
    shared = (profile[r[0]] - profile[r[1]]) < cfg.get("scoring.dominance.shared_lt")
    return {"dominant": [r[0], r[1]] if shared else [r[0]], "secondary": r[1], "shared": shared}


def lowest(profile):
    m = min(profile.values())
    return [o for o in ORIENTATIONS if profile[o] - m < cfg.get("scoring.dominance.shared_lt")]


def culture_strength(profile):
    s = q(max(profile.values()) - D(25), 2)
    b1, b2, b3 = cfg.get("scoring.strength.bands")
    band = "DIFFUSE" if s < b1 else "MODERATE" if s < b2 else "STRONG" if s < b3 else "HIGHLY_CONCENTRATED"
    return s, band


LENSES = {"STRATEGY": ("D5", "D6"), "PRACTICE": ("D1", "D3", "D4"), "LEADERSHIP": ("D2",)}


def lens_profiles(dim_profiles):
    return {L: {o: q(mean(dim_profiles[d][o] for d in ds), 2) for o in ORIENTATIONS} for L, ds in LENSES.items()}


def congruence(org_profile, dim_profiles, lenses):
    org_dom = ranked(org_profile)[0]
    count = sum(1 for d in DIMENSIONS_CS if org_dom in dominance(dim_profiles[d])["dominant"])
    hi, mid = cfg.get("scoring.congruence.bands")
    band = "HIGHLY_CONGRUENT" if count >= hi else "MODERATELY_CONGRUENT" if count >= mid else "FRAGMENTED"
    lens_dom = {L: ranked(p)[0] for L, p in lenses.items()}
    agree = sum(1 for p in lenses.values() if org_dom in dominance(p)["dominant"])
    return {"dimension_count": count, "dimension_pct": q(D(count) / D(6) * 100, 1), "band": band,
            "lens": {**lens_dom, "agreement": agree}}

# ---------------------------------------------------------------- D7–D9 (§3.5.8)

READINESS_BANDS = {
    "D7": ["Digitally resistant", "Digitally cautious", "Moderately ready", "Digitally capable", "Digitally advanced"],
    "D8": ["Fear-based culture", "Cautious / selective candour", "Moderate safety", "Open culture", "Challenge culture: highly safe"],
    "D9": ["Critical resistance", "Significant barriers", "Moderate readiness", "Good readiness", "Strong readiness"],
}


def likert_dimension(responses, dim):
    per = []
    for r in responses:
        vals = [v for v in r.get("likert", {}).get(dim, []) if v is not None]
        if len(vals) >= cfg.get("scoring.likert.min_answered"):
            per.append(mean(vals))
    return q(mean(per), 4) if per else None


def readiness_band_index(value):
    v = q(value, 1)
    edges = cfg.get("scoring.readiness.band_edges")
    for i, e in enumerate(edges):
        if v <= e:
            return i
    return 4


def readiness_band(dim, value):
    return READINESS_BANDS[dim][readiness_band_index(value)]


def cronbach_alpha(responses, dim):
    rows = [r["likert"][dim] for r in responses if dim in r.get("likert", {}) and all(v is not None for v in r["likert"][dim])]
    if len(rows) < 3:
        return None
    k = len(rows[0])

    def var(xs):
        m = mean(xs)
        return sum(((dec(x) - m) ** 2 for x in xs), D(0)) / D(len(xs) - 1)
    item_var = sum((var([row[i] for row in rows]) for i in range(k)), D(0))
    total_var = var([sum(row) for row in rows])
    if total_var == 0:
        return None
    return q(D(k) / D(k - 1) * (1 - item_var / total_var), 2)

# ---------------------------------------------------------------- eOS (§3.5.9)

def eos_category(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    adv = sum(1 for v in vals if v >= cfg.get("scoring.eos.advocate_min"))
    crit = sum(1 for v in vals if v <= cfg.get("scoring.eos.critic_max"))
    return int(q(D(100) * D(adv - crit) / D(len(vals)), 0))


def eos_band(score):
    e0, e1, e2 = cfg.get("scoring.eos.band_edges")
    if score < e0:
        return "NEGATIVE"
    if score <= e1:
        return "ACCEPTABLE"
    if score <= e2:
        return "GOOD"
    return "EXCELLENT"


# Table 48. Q2's primary is the leadership target orientation, passed in.
EOS_ROUTING = {
    "Q1": ("ENGAGE", "ALL", "overall health"), "Q2": ("TARGET", "ENGAGE", "quality of leadership"),
    "Q3": ("INNOVATE", "ENGAGE", "safety"), "Q4": ("ENGAGE", "GOVERN", "fair processes"),
    "Q5": ("ENGAGE", "GOVERN", "transparency"), "Q6": ("ENGAGE", "PERFORM", "moderate pace"),
    "Q7": ("ENGAGE", "GOVERN", "consistent standards"), "Q8": ("PERFORM", "GOVERN", "role clarity"),
}


def eos_route(category, target):
    r = EOS_ROUTING.get(category)
    if r is None:
        return None
    return {"primary": target if r[0] == "TARGET" else r[0], "secondary": r[1], "why": r[2]}


def eos_scores(responses):
    cats = {}
    for i in range(8):
        cats[f"Q{i+1}"] = eos_category([r["eos"][i] for r in responses if len(r.get("eos", [])) > i])
    valid = [v for v in cats.values() if v is not None]
    return cats, (q(mean(valid), 1) if valid else None)

# ---------------------------------------------------------------- TPS (§3.5.11)

def la_instrument(d2_now_target, target):
    return D(1) + D(4) * min(D(1), dec(d2_now_target) / cfg.SINGLE_THRESHOLD[target])


def leadership_alignment(coverage, lri_weighted, la_instr):
    coverage = dec(coverage)
    if coverage == 0:
        return q(la_instr, 4)
    return q(coverage * dec(lri_weighted) + (1 - coverage) * la_instr, 4)


def tps(d7, d8, d9, la):
    w9, w8, wla, w7 = cfg.get("scoring.tps.weights")
    return w9 * dec(d9) + w8 * dec(d8) + wla * dec(la) + w7 * dec(d7)


def band_1_5(value_2dp):
    b1, b2, b3 = cfg.get("scoring.tps.bands")
    v = q(value_2dp, 2)
    if v < b1:
        return "HIGH_RISK"
    if v < b2:
        return "ENABLEMENT_REQUIRED"
    if v < b3:
        return "TARGETED_SUPPORT"
    return "STRONG_READINESS"


LRI_BANDS = {"HIGH_RISK": "HIGH_RISK", "ENABLEMENT_REQUIRED": "ENABLEMENT_REQUIRED",
             "TARGETED_SUPPORT": "READY_WITH_SUPPORT", "STRONG_READINESS": "STRONG"}


def priority_cap(tps_value):
    c1, c2, c3 = cfg.get("plan.priority_caps")
    b = band_1_5(tps_value)
    return c1 if b == "HIGH_RISK" else c2 if b == "ENABLEMENT_REQUIRED" else c3

# ---------------------------------------------------------------- segments (§3.5.12)

def perception_gap(exec_profile, staff_profile):
    return {o: q(abs(exec_profile[o] - staff_profile[o]), 2) for o in ORIENTATIONS}


def perception_flag(g):
    w, s = cfg.get("segments.perception")
    g = dec(g)
    return "SHADOW_CULTURE" if g > s else "WATCH" if g > w else "NONE"


def sdi(seg_profile, org_profile):
    return q(sum((abs(seg_profile[o] - org_profile[o]) for o in ORIENTATIONS), D(0)) / D(2), 2)


def welch_p(a, b):
    from scipy import stats
    if len(a) < 2 or len(b) < 2:
        return None
    t = stats.ttest_ind([float(x) for x in a], [float(x) for x in b], equal_var=False)
    return D(repr(float(t.pvalue)))


def subculture(seg_responses, rest_responses, seg_profile, org_profile, seg_d8=None, org_d8=None, seg_d9=None, org_d9=None):
    out = {"divergent": [], "sdi": sdi(seg_profile, org_profile)}
    for o in ORIENTATIONS:
        if abs(seg_profile[o] - org_profile[o]) >= cfg.get("segments.single_divergence"):
            out["divergent"].append(o)
    seg_dom, org_dom = dominance(seg_profile), dominance(org_profile)
    out["profile_divergence"] = out["sdi"] >= cfg.get("segments.sdi_candidate")
    out["dominance_divergence"] = (not seg_dom["shared"]) and seg_dom["dominant"][0] not in org_dom["dominant"]
    confirmed = False
    tested = out["divergent"] or ([seg_dom["dominant"][0]] if out["dominance_divergence"] else [])
    if len(seg_responses) >= cfg.get("segments.floor") and len(rest_responses) >= cfg.get("segments.floor"):
        for o in tested:
            p = welch_p([respondent_score(r, o) for r in seg_responses], [respondent_score(r, o) for r in rest_responses])
            if p is not None and p < cfg.get("segments.significance_alpha"):
                confirmed = True
    out["significance"] = "CONFIRMED" if confirmed else "INDICATIVE"
    out["is_subculture"] = (out["profile_divergence"] or out["dominance_divergence"]) and confirmed
    rd = cfg.get("segments.readiness_divergence")
    out["capacity_subculture"] = any(x is not None and y is not None and abs(x - y) >= rd for x, y in ((seg_d8, org_d8), (seg_d9, org_d9)))
    return out

# ---------------------------------------------------------------- Leadership 360 (§3.5.10)

SECTIONS = {"A": range(0, 10), "B": range(10, 20), "C": range(20, 30), "D": range(30, 40),
            "E": range(40, 45), "F": range(45, 50), "G": range(50, 55), "H": range(55, 60)}
SECTION_OF = {"ENGAGE": "A", "INNOVATE": "B", "PERFORM": "C", "GOVERN": "D"}
ORIENT_OF = {v: k for k, v in SECTION_OF.items()}


def section_avg(ratings, sec):
    idx = SECTIONS[sec]
    vals = [ratings[i] for i in idx if ratings[i] is not None]
    items = cfg.get("scoring.360.min_observed_items")   # rules 2.1: a count per section (V-05)
    if D(len(vals)) < (D(items) if items is not None else cfg.get("scoring.360.min_observed") * D(len(idx))):
        return None
    return mean(vals)


def score_leader(self_ratings, raters, target):
    """raters: list of {"group": SUPERIOR|PEER|DIRECT_REPORT|OTHER, "ratings": [60 values or None]}"""
    mr = cfg.get("scoring.360.min_raters")
    result = {"valid": len(raters) >= mr and self_ratings is not None, "rater_count": len(raters)}
    if not result["valid"]:
        return result
    groups = {}
    for r in raters:
        groups.setdefault(r["group"], []).append(r)
    published, merged = {}, []
    for g, rs in groups.items():
        if g != "SUPERIOR" and len(rs) >= mr:
            published[g] = rs
        else:
            merged.extend(rs)
    if merged:
        if len(merged) >= mr:
            published["ALL_OTHERS"] = merged
        else:
            published.setdefault("_FOLDED", []).extend(merged)
    group_avg = {}
    for g, rs in published.items():
        group_avg[g] = {}
        for sec in SECTIONS:
            vals = [v for v in (section_avg(r["ratings"], sec) for r in rs) if v is not None]
            group_avg[g][sec] = mean(vals) if vals else None
    other = {}
    for sec in SECTIONS:
        vals = [group_avg[g][sec] for g in group_avg if group_avg[g][sec] is not None]
        other[sec] = q(mean(vals), 4) if vals else None
    selfavg = {sec: q(mean([self_ratings[i] for i in SECTIONS[sec]]), 4) for sec in SECTIONS}
    result.update(compute_leader_readings(selfavg, other, target))
    result["groups_published"] = sorted(g for g in group_avg if g != "_FOLDED")
    return result


def compute_leader_readings(selfavg, other, target):
    ad = {s: other[s] for s in "ABCD"}
    order = sorted("ABCD", key=lambda s: (-ad[s], "ABCD".index(s)))
    default = [ORIENT_OF[order[0]]]
    if ad[order[0]] - ad[order[1]] < cfg.get("scoring.360.default_shared_lt"):
        default.append(ORIENT_OF[order[1]])
    growth = ORIENT_OF[sorted("ABCD", key=lambda s: (ad[s], "ABCD".index(s)))[0]]
    rng = max(ad.values()) - min(ad.values()) < cfg.get("scoring.360.range_lt")
    flags = []
    if other["E"] < cfg.get("scoring.360.flag.integrity_lt"):
        flags.append("INTEGRITY")
    if other["F"] < cfg.get("scoring.360.flag.safety_lt"):
        flags.append("SAFETY")
    if other["H"] < cfg.get("scoring.360.flag.change_lt"):
        flags.append("CHANGE_CAPACITY")
    w, b = cfg.get("scoring.360.gap_tiers")
    gaps_ = {}
    for s in selfavg:
        if selfavg[s] is None or other[s] is None:
            continue
        g = q(selfavg[s] - other[s], 2)
        tier = "BLIND_SPOT" if abs(g) > b else "WATCH" if abs(g) > w else "ALIGNED"
        gaps_[s] = {"gap": g, "tier": tier}
    lw = cfg.get("scoring.lri.weights")
    lri = lw[0] * other["H"] + lw[1] * other["F"] + lw[2] * other[SECTION_OF[target]] + lw[3] * other["G"]
    lri = q(lri, 4)
    return {"self_avg": selfavg, "other_avg": other, "default": default, "growth": growth, "range": rng,
            "flags": flags, "self_other": gaps_, "lri": lri, "lri_band": LRI_BANDS[band_1_5(lri)]}

# ---------------------------------------------------------------- leader–culture link (§3.5.13)

def leader_profile(other):
    tot = sum((other[s] for s in "ABCD"), D(0))
    return {o: other[SECTION_OF[o]] / tot * D(100) for o in ORIENTATIONS}


def fit_index(lp, team_now):
    return q(D(100) - sum((abs(lp[o] - team_now[o]) for o in ORIENTATIONS), D(0)) / D(2), 2)


def fit_band(f):
    b1, b2, b3 = cfg.get("leaders.fit_bands")
    return "MIRRORED" if f >= b1 else "ALIGNED" if f >= b2 else "DIVERGENT" if f >= b3 else "COUNTER_CULTURAL"


def carrier_class(lead_target, org_target, flags, lri, default_orients, classes):
    m = cfg.get("leaders.carrier_margin")
    low = dec(lead_target) <= dec(org_target) - m
    high = dec(lead_target) >= dec(org_target) + m
    hard = any(f in flags for f in ("INTEGRITY", "SAFETY"))
    if low and (hard or band_1_5(lri) == "HIGH_RISK"):
        return "CRITICAL_BLOCKER"
    if low and any(classes.get(o) == "MODERATE" for o in default_orients):
        return "CULTURE_BLOCKER"
    if low:
        return "LAGGING"
    if high and not hard and q(lri, 2) >= cfg.get("leaders.carrier_lri_min"):
        return "CULTURE_CARRIER"
    if high:
        return "EMERGING_CARRIER"
    return "NEUTRAL"

# ---------------------------------------------------------------- full assessment

# ---------------------------------------------------------------- analytics from the PAC reference platform (CDP v6)
# Reading aids and indices beside the spec measures. Thresholds in config "analytics.*". Mirrors src/scoring.ts.

def gap_band(g):
    v = abs(dec(g))
    m, s, c = cfg.get("analytics.gap_bands")
    return "CRITICAL" if v >= c else "SIGNIFICANT" if v > s else "MODERATE" if v >= m else "LOW"


def entropy(gap):
    score = q(mean([abs(gap[o]) for o in ORIENTATIONS]), 2)
    m, h, c = cfg.get("analytics.entropy_bands")
    return {"score": score, "band": "CRITICAL" if score >= c else "HIGH" if score >= h else "MODERATE" if score >= m else "LOW"}


def _sample_sd(xs):
    m = mean(xs)
    return (sum(((x - m) * (x - m) for x in xs), D(0)) / D(len(xs) - 1)).sqrt()


def dispersion(responses):
    if len(responses) < 2:
        return None
    dims, avgs = {}, []
    for d in DIMENSIONS_CS:
        sds = [_sample_sd([mean([D(s[o]) for s in r["alloc"]["NOW"][d]]) for r in responses]) for o in ORIENTATIONS]
        avg = mean(sds)
        avgs.append(avg)
        dims[d] = {**{o: q(sds[i], 2) for i, o in enumerate(ORIENTATIONS)}, "avg": q(avg, 2)}
    raw = mean(avgs)
    return dims, q(raw, 2), raw


def tensions(gap):
    mod, high = cfg.get("analytics.tension.bands")

    def pair(a, b, name):
        ga, gb = gap[a], gap[b]
        raw = (abs(ga) + abs(gb)) / D(1 if (ga > 0) != (gb > 0) else 2) * cfg.get("analytics.tension.factor")
        score = q(min(max(raw, D(0)), D(10)), 1)
        return {"pair": name, "a": a, "b": b, "score": score, "band": "HIGH" if score >= high else "MODERATE" if score >= mod else "LOW"}
    return [pair("ENGAGE", "PERFORM", "ENGAGE_PERFORM"), pair("INNOVATE", "GOVERN", "INNOVATE_GOVERN")]


def culture_risk(gap, disp, perception):
    if disp is None:
        return None
    wg, wd, wm = cfg.get("analytics.risk.weights")
    sg, sd, sm = cfg.get("analytics.risk.scale")
    lo, mid = cfg.get("analytics.risk.bands")
    clamp = lambda x: min(max(x, D(0)), D(100))
    mis = mean([perception[o] for o in ORIENTATIONS]) if perception else cfg.get("analytics.risk.misalignment_default")
    g = clamp(mean([abs(gap[o]) for o in ORIENTATIONS]) / sg * 100)
    d = clamp(disp / sd * 100)
    m = clamp(mis / sm * 100)
    index = q(g * wg + d * wd + m * wm, 0)
    return {"index": index, "band": "LOW" if index < lo else "MEDIUM" if index < mid else "HIGH",
            "gap": q(g, 0), "dispersion": q(d, 0), "misalignment": q(m, 0),
            "misalignment_source": "PERCEPTION_GAP" if perception else "DEFAULT"}


def leader_highlights(self_ratings, raters, n=5):
    """Mirrors leaderHighlights in src/scoring.ts: items observed by at least the rater floor, ranked by rater mean."""
    mr = cfg.get("scoring.360.min_raters")
    if len(raters) < mr:
        return None
    items = []
    for i in range(60):
        vals = [r["ratings"][i] for r in raters if r["ratings"][i] is not None]
        if len(vals) >= mr:
            items.append({"item": i + 1, "others": q(mean(vals), 2), "observed": len(vals), "self": self_ratings[i] if self_ratings else None})
    return {"top": sorted(items, key=lambda x: (-x["others"], x["item"]))[:n], "bottom": sorted(items, key=lambda x: (x["others"], x["item"]))[:n]}


def values_reality(dims_now):
    """D1 (espoused) against the mean of D4 and D6 (lived), per orientation. Mirrors valuesReality in src/scoring.ts."""
    out = {}
    for o in ORIENTATIONS:
        esp, lived = dec(dims_now["D1"][o]), (dec(dims_now["D4"][o]) + dec(dims_now["D6"][o])) / 2
        out[o] = {"espoused": q(esp, 2), "lived": q(lived, 2), "delta": q(lived - esp, 2)}
    return out


def analytics(gap, responses_now, perception):
    disp = dispersion(responses_now)
    return {
        "gap_bands": {o: gap_band(gap[o]) for o in ORIENTATIONS},
        "entropy": entropy(gap), "tensions": tensions(gap),
        "dispersion": {**disp[0], "overall": disp[1]} if disp else None,
        "risk": culture_risk(gap, disp[2] if disp else None, perception),
    }


def eos_detail(responses):
    """Mirrors eosDetail in src/scoring.ts."""
    adv, crit = cfg.get("scoring.eos.advocate_min"), cfg.get("scoring.eos.critic_max")
    out = {}
    for i in range(8):
        vals = [r["eos"][i] for r in responses if r.get("eos") and len(r["eos"]) > i and r["eos"][i] is not None]
        p, d = sum(1 for v in vals if v >= adv), sum(1 for v in vals if v <= crit)
        out[f"Q{i + 1}"] = {"promoters": p, "passives": len(vals) - p - d, "detractors": d, "n": len(vals)}
    return out


def readiness_items(responses):
    """Mirrors readinessItems in src/scoring.ts."""
    floor = cfg.get("segments.floor")
    out = {}
    for d in LIKERT_DIMS:
        row = []
        for i in range(12):
            vals = [r["likert"][d][i] for r in responses if r.get("likert") and d in r["likert"] and len(r["likert"][d]) > i and r["likert"][d][i] is not None]
            row.append(q(mean(vals), 2) if len(vals) >= floor else None)
        out[d] = row
    return out


def score_assessment(responses, setup, leader_results=None, leaders_in_scope=None, with_analytics=True, version=3):
    """Compute the score object (§3.7). `setup` needs leadership_target_orientation.

    leader_results: list of dicts {"valid", "lri", "headcount_led"}; leaders_in_scope: list of {"headcount_led"}.
    """
    durations = sorted(r["duration"] for r in responses if r.get("duration") is not None and completion_state(r) == "COMPLETE")
    median = durations[len(durations) // 2] if durations else 0
    if durations and len(durations) % 2 == 0:
        median = (D(durations[len(durations) // 2 - 1]) + D(durations[len(durations) // 2])) / 2
    for r in responses:
        r["_state"], r["_flags"] = classify_response(r, median)
    R_now = [r for r in responses if included(r, "NOW")]
    R_pref = [r for r in responses if included(r, "PREFERRED")]
    R_dom = [r for r in responses if included(r, "DOMINANCE")]
    R_lik = [r for r in R_now if included(r, "LIKERT")]

    now = orientation_profile(R_now, "NOW")
    pref = orientation_profile(R_pref, "PREFERRED")
    g = gaps(orientation_profile(R_pref, "NOW"), pref)
    classes = {o: classify_gap(g[o]) for o in ORIENTATIONS}
    dims_now = dimension_profiles(R_now, "NOW")
    dom_profile = orientation_profile(R_dom, "NOW") or now
    dom = dominance(dom_profile)
    strength, sband = culture_strength(dom_profile)
    lenses = lens_profiles(dims_now)
    cong = congruence(dom_profile, dimension_profiles(R_dom, "NOW") if R_dom else dims_now, lenses)

    d = {k: likert_dimension(R_lik, k) for k in LIKERT_DIMS}
    target = setup["leadership_target_orientation"]
    leader_results = leader_results or []
    scope = leaders_in_scope or []
    tot = sum((D(l["headcount_led"]) for l in scope), D(0))
    valid = [l for l in leader_results if l.get("valid")]
    cov = (sum((D(l["headcount_led"]) for l in valid), D(0)) / tot) if tot else D(0)
    lri_w = (sum((dec(l["lri"]) * D(l["headcount_led"]) for l in valid), D(0)) /
             sum((D(l["headcount_led"]) for l in valid), D(0))) if valid else None
    la_i = la_instrument(dims_now["D2"][target], target)
    la = leadership_alignment(cov, lri_w, la_i)
    tps_raw = tps(d["D7"], d["D8"], d["D9"], la) if None not in d.values() else None

    eos, eos_idx = eos_scores([r for r in R_now if r.get("eos")])
    floor = cfg.get("segments.floor")
    execs = [r for r in R_now if r["snapshot"].get("is_executive")]
    staff = [r for r in R_now if not r["snapshot"].get("is_executive")]
    cohorts, pg, pg_reason = {}, None, None
    if len(execs) < floor:
        pg_reason = "EXECUTIVE_COHORT_BELOW_FLOOR"
    elif len(staff) < floor:
        pg_reason = "STAFF_COHORT_BELOW_FLOOR"
    if len(execs) >= floor and len(staff) >= floor:
        ep, sp = orientation_profile(execs, "NOW"), orientation_profile(staff, "NOW")
        cohorts = {"executive": {"n": len(execs), "now": ep}, "staff": {"n": len(staff), "now": sp}}
        pg = perception_gap(ep, sp)

    states = {}
    for r in responses:
        states[r["_state"]] = states.get(r["_state"], 0) + 1
    obj = {
        "instrument_version": cfg.INSTRUMENT_VERSION, "rules_version": cfg.rules_version(),
        "orientation_scores": {"now": now, "preferred": pref, "gap": g},
        "classification": classes, "significant": {o: significant(g[o]) for o in ORIENTATIONS},
        "dominance": dom, "culture_strength": strength, "strength_band": sband, "congruence": cong,
        "dimension_now": dims_now, "lenses_now": lenses,
        "readiness": {
            "d7": d["D7"], "d8": d["D8"], "d9": d["D9"],
            "d7_band": readiness_band("D7", d["D7"]) if d["D7"] else None,
            "d8_band": readiness_band("D8", d["D8"]) if d["D8"] else None,
            "d9_band": readiness_band("D9", d["D9"]) if d["D9"] else None,
            "coverage": q(cov, 4), "leadership_alignment": la,
            "leadership_alignment_source": "INSTRUMENT_TERM_ONLY" if cov == 0 else "BLENDED",
            "tps": q(tps_raw, 2) if tps_raw is not None else None,
            "tps_band": band_1_5(tps_raw) if tps_raw is not None else None,
            "provisional": cov < cfg.get("scoring.tps.provisional_coverage_lt"),
            "alpha": {k: cronbach_alpha(R_lik, k) for k in LIKERT_DIMS},
        },
        "eos": {**eos, "index": eos_idx},
        "cohorts": cohorts, "perception_gap": pg,
        "perception_flags": {o: perception_flag(pg[o]) for o in ORIENTATIONS} if pg else None,
        "perception_not_computed_reason": pg_reason,
        "leader_results": sorted(leader_results, key=lambda l: str(l.get("assignment_id", ""))),
        "quality": {"states": states, "median_duration": median,
                    "flags": {f: sum(1 for r in responses if f in r["_flags"]) for f in
                              ("SPEEDING", "STRAIGHT_LINING", "UNIFORM_ALLOCATION", "PERSPECTIVE_DUPLICATION")}},
        "counts": {"now": len(R_now), "preferred": len(R_pref)},
    }
    version = 1 if not with_analytics else version   # payload versions: see scoreAssessment in src/scoring.ts
    if version >= 2:
        obj["analytics"] = analytics(g, R_now, pg)
    if version >= 3:
        obj["dimension_preferred"] = dimension_profiles(R_pref, "PREFERRED")
        obj["eos_detail"] = eos_detail(R_now)
        obj["readiness_items"] = readiness_items(R_lik)
    payload = to_jsonable(obj)
    h = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return obj, payload, "sha256:" + h
