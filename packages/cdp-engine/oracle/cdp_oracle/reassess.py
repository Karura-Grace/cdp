"""Stage 6 (spec §6.5): pulses, triggers, trade-off verification, adjust-or-retire."""
from .num import D, q, dec, ORIENTATIONS
from . import config as cfg

SHORT_FORMS = {"D7": [0, 2, 3, 7], "D8": [1, 2, 4, 10], "D9": [0, 4, 8, 9]}


def validate_pulse(items, watchlist):
    errs = []
    if len(items) > cfg.get("pulse.max_items"):
        errs.append("More than ten items")
    off = [i for i in items if i not in watchlist]
    if off:
        errs.append("Items outside the watch-list: " + ", ".join(off))
    return errs


def pulse_triggers(baseline, current):
    """baseline/current: {"likert": {"D8": mean}, "eos": {"Q6": score}, "scenario": {"D2 S2": alloc}}"""
    lik, eos, sc = cfg.get("pulse.triggers")
    out = []
    for k, v in current.get("likert", {}).items():
        if abs(q(v, 1) - q(baseline["likert"][k], 1)) >= lik:
            out.append({"type": "PULSE_MOVEMENT", "ref": k})
    for k, v in current.get("eos", {}).items():
        if abs(D(v) - D(baseline["eos"][k])) >= eos:
            out.append({"type": "PULSE_MOVEMENT", "ref": "eOS " + k})
    for k, v in current.get("scenario", {}).items():
        if abs(dec(v) - dec(baseline["scenario"][k])) >= sc:
            out.append({"type": "PULSE_MOVEMENT", "ref": k})
    return out


def trade_off_verification(base_now, cur_now, priorities, base_classes):
    out, unintended = [], []
    for p in priorities:
        if p.get("classification") != "BUILD" or not p.get("trade_off_orientation"):
            continue
        t, r = p["orientation"], p["trade_off_orientation"]
        rise = q(dec(cur_now[t]) - dec(base_now[t]), 2)
        falls = {o: max(D(0), dec(base_now[o]) - dec(cur_now[o])) for o in ORIENTATIONS if o != t}
        tot = sum(falls.values(), D(0))
        share = q(falls[r] / tot, 2) if tot else None
        if rise <= 0:
            v = "NO_MOVEMENT"
        elif share is not None and share >= D("0.50"):
            v = "INTENDED_RELEASE"
        else:
            v = "MIXED_RELEASE"
        out.append({"priority": p["priority_id"], "target": t, "trade_off": r, "rise": rise, "share_trade_off": share, "verdict": v})
    for o in ORIENTATIONS:
        if base_classes.get(o) == "KEEP_AND_PROTECT" and dec(base_now[o]) - dec(cur_now[o]) >= 4:
            unintended.append(o)
    return out, unintended


def adjust_or_retire(kpi_direction, milestones_on_track, precondition_open=False, finding_supported=True,
                     owner_present=True, consecutive_adjustments_without_movement=0):
    if precondition_open:
        return "RETIRE_AND_REINSTATE_PRECONDITION"
    if not finding_supported:
        return "RETIRE_SUPERSEDED"
    if not owner_present:
        return "REASSIGN_WITHIN_14_DAYS"
    if consecutive_adjustments_without_movement >= 2:
        return "RETIRE_NOT_ACHIEVED"
    if kpi_direction == "AWAY":
        return "SUSPEND_AND_REDIAGNOSE"
    if kpi_direction == "TOWARDS" and milestones_on_track:
        return "CONTINUE"
    if kpi_direction == "FLAT" and milestones_on_track:
        return "ADJUST_INTERVENTION"
    return "ADJUST_RESOURCING"


def comparability(base_version, cur_version):
    bm, cm = base_version.split(".")[0], cur_version.split(".")[0]
    if bm != cm:
        return "MAJOR"
    if {base_version, cur_version} <= {"1.0", "1.1"}:
        return "SAME"
    return "MINOR" if base_version != cur_version else "SAME"
