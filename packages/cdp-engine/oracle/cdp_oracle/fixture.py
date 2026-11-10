"""Reference fixture (spec §0.7) and a deterministic demo dataset that reproduces it.

The demo dataset is respondent-level: 441 complete responses (11 executive, 430 staff), 22 partial and
12 insufficient. Organisation NOW/PREFERRED profiles, every dimension profile, D7–D9 (to 1 dp), eOS
categories and the TPS reproduce the specification exactly.
"""
import random
from .num import D, ORIENTATIONS, DIMENSIONS_CS

DIM_NOW = {"D1": [20, 14, 30, 36], "D2": [18, 16, 38, 28], "D3": [22, 12, 30, 36],
           "D4": [26, 12, 34, 28], "D5": [22, 16, 34, 28], "D6": [24, 14, 38, 24]}
PREF = [31, 25, 28, 16]
EXEC_NOW = [30, 16, 32, 22]
EOS = [18, 9, -8, 6, 11, -14, 21, 14]
LIKERT_TOTAL = {"D7": 16935, "D8": 14818, "D9": 16406}   # Σ respondent item sums giving 3.2001 / 2.8001 / 3.1002
N_EXEC, N_STAFF, N_PARTIAL, N_INSUFF = 11, 430, 22, 12
DEPARTMENTS = [("dep_01", "Retail Banking", 140), ("dep_02", "Corporate Banking", 70), ("dep_03", "Digital Channels", 60),
               ("dep_04", "Operations", 95), ("dep_05", "Risk and Compliance", 40), ("dep_06", "Finance", 25)]

SETUP = {
    "priorities": [{"ref": "B3.1", "goal_type": "INNOVATION_NEW_MODELS", "text": "Grow digital channels"},
                   {"ref": "B3.2", "goal_type": "INNOVATION_NEW_MODELS", "text": "Differentiate on customer experience through new digital journeys"}],
    "business_model": "SERVICE_B2C", "planned_model": None,
    "f1_tags": ["ENGAGE", "ENGAGE", "ENGAGE", "PERFORM", "ENGAGE"],
    "kpi_for": {"INNOVATE": {"name": "Digital channel adoption (%)", "baseline": 28, "target": 45},
                "ENGAGE": {"name": "Voluntary attrition (%)", "baseline": 19, "target": 13},
                "GOVERN": {"name": "Approval cycle time (days)", "baseline": 21, "target": 7}},
}


def _distribute(totals, n, rng):
    """Integer rows of 4 summing to 100 whose column sums equal `totals` (which sum to 100n)."""
    base = [t // n for t in totals]
    rem = [t - b * n for t, b in zip(totals, base)]
    k = sum(rem) // n
    assert sum(base) + k == 100 and sum(rem) == k * n
    rows = [list(base) for _ in range(n)]
    tokens = [i for i, r in enumerate(rem) for _ in range(r)]
    for idx, o in enumerate(tokens):
        rows[idx % n][o] += 1
    order = list(range(n))
    rng.shuffle(order)
    rows = [rows[i] for i in order]
    for j in range(0, n - 1, 2):            # realism: opposite perturbations keep row and column sums
        a, b = rng.sample(range(4), 2)
        dlt = rng.randint(0, 6)
        if min(rows[j][b], rows[j + 1][a]) >= dlt:
            rows[j][a] += dlt; rows[j][b] -= dlt
            rows[j + 1][a] -= dlt; rows[j + 1][b] += dlt
    return rows


def _items(total, n, rng):
    """Per-respondent sums vary widely (between-person variance) while the grand total is exact."""
    per = [total // n + (1 if i < total % n else 0) for i in range(n)]
    for j in range(0, n - 1, 2):
        k = rng.randint(0, 9)
        if 12 <= per[j] - k and per[j + 1] + k <= 60:
            per[j] -= k; per[j + 1] += k
    rng.shuffle(per)
    out = []
    for s in per:
        v = [s // 12] * 12
        for i in range(s - sum(v)):
            v[i] += 1
        for _ in range(3):
            a, b = rng.sample(range(12), 2)
            if v[a] < 5 and v[b] > 1:
                v[a] += 1; v[b] -= 1
        if len(set(v)) == 1:
            if v[0] < 5:
                v[0] += 1; v[1] -= 1
            else:
                v[0] -= 1; v[1] += 1
        rng.shuffle(v)
        out.append(v)
    return out


def _eos_column(score, n, rng):
    diff = round(score * n / 100)
    while round(D(100) * D(diff) / D(n)) != score:
        diff += 1 if D(100) * D(diff) / D(n) < score else -1
    crit = 90 if score < 0 else 60
    adv = crit + diff
    neu = n - adv - crit
    vals = [rng.choice([9, 10]) for _ in range(adv)] + [rng.choice([7, 8]) for _ in range(neu)] + [rng.randint(0, 6) for _ in range(crit)]
    rng.shuffle(vals)
    return vals


def demo_responses(seed=2026):
    rng = random.Random(seed)
    n_all = N_EXEC + N_STAFF
    resp = [{"id": f"rsp_{i+1:04d}", "alloc": {"NOW": {}, "PREFERRED": {}}, "likert": {}, "eos": [],
             "duration": rng.randint(1900, 3100), "snapshot": {}} for i in range(n_all)]
    for i, r in enumerate(resp):
        r["snapshot"]["is_executive"] = i < N_EXEC
    # departments for staff (exec in an executive office unit)
    di = 0
    pool = [d for d, _, cnt in DEPARTMENTS for _ in range(cnt)]
    rng.shuffle(pool)
    for i, r in enumerate(resp):
        r["snapshot"]["department"] = "dep_00" if i < N_EXEC else pool[(i - N_EXEC) % len(pool)]
        r["snapshot"]["tenure_band"] = rng.choice(["<1y", "1-3y", "3-5y", "5y+"])
        r["snapshot"]["grade"] = "EXEC" if i < N_EXEC else rng.choice(["G1", "G2", "G3", "G4"])
    for d in DIMENSIONS_CS:
        for s in range(3):
            ex = [EXEC_NOW for _ in range(N_EXEC)]
            staff_tot = [n_all * DIM_NOW[d][k] - N_EXEC * EXEC_NOW[k] for k in range(4)]
            rows = [list(x) for x in ex] + _distribute(staff_tot, N_STAFF, rng)
            prow = _distribute([n_all * p for p in PREF], n_all, rng)
            for i, r in enumerate(resp):
                r["alloc"]["NOW"].setdefault(d, []).append(dict(zip(ORIENTATIONS, rows[i])))
                r["alloc"]["PREFERRED"].setdefault(d, []).append(dict(zip(ORIENTATIONS, prow[i])))
    for dim, tot in LIKERT_TOTAL.items():
        cols = _items(tot, n_all, rng)
        for i, r in enumerate(resp):
            r["likert"][dim] = cols[i]
    cols = [_eos_column(s, n_all, rng) for s in EOS]
    for i, r in enumerate(resp):
        r["eos"] = [cols[q][i] for q in range(8)]
    # partial responses: NOW exactly at the organisation dimension profile, no PREFERRED
    for j in range(N_PARTIAL):
        resp.append({"id": f"rsp_p{j+1:03d}", "duration": 1500, "snapshot": {"is_executive": False, "department": pool[j], "grade": "G2", "tenure_band": "1-3y"},
                     "alloc": {"NOW": {d: [dict(zip(ORIENTATIONS, DIM_NOW[d])) for _ in range(3)] for d in DIMENSIONS_CS}, "PREFERRED": {}},
                     "likert": {}, "eos": []})
    for j in range(N_INSUFF):
        resp.append({"id": f"rsp_x{j+1:03d}", "duration": 600, "snapshot": {"is_executive": False, "department": pool[j + 30], "grade": "G1", "tenure_band": "<1y"},
                     "alloc": {"NOW": {d: [dict(zip(ORIENTATIONS, DIM_NOW[d]))] * (2 if d in ("D1", "D2") else 0) for d in DIMENSIONS_CS}, "PREFERRED": {}},
                     "likert": {}, "eos": []})
    return resp


ILLUSTRATIVE_LEADER = {  # spec §3.5.10 worked example; other averages A–H
    "name": "Illustrative leader (Head of Retail Banking)",
    "self": {"A": 3.4, "B": 3.1, "C": 4.4, "D": 3.8, "E": 4.6, "F": 4.0, "G": 3.6, "H": 3.5},
    "other": {"A": 2.6, "B": 3.0, "C": 4.2, "D": 3.5, "E": 4.3, "F": 2.8, "G": 3.4, "H": 3.0},
}


def ratings_for(avgs, rng=None):
    """60 integer ratings whose section means equal `avgs` (10 items A–D, 5 items E–H)."""
    out = []
    for sec, n in zip("ABCDEFGH", [10] * 4 + [5] * 4):
        total = round(avgs[sec] * n)
        v = [total // n] * n
        for i in range(total - sum(v)):
            v[i] += 1
        out.extend(v)
    return out
