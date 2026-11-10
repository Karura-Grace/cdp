"""Configuration registry (spec Appendix I). Code must read thresholds from here, never literals.

RULES_VERSION pins the full set; a change to any GLOBAL value ships as a new rules version.
"""
from contextlib import contextmanager
from copy import deepcopy
from .num import D

RULES_VERSION = "2.0"
INSTRUMENT_VERSION = "1.1"

GLOBAL = {
    "scoring.gap.build": D("8.00"),
    "scoring.gap.strengthen": D("4.00"),
    "scoring.dominance.shared_lt": D("1.00"),
    "scoring.strength.bands": (D(5), D(10), D(15)),
    "scoring.congruence.bands": (5, 3),
    "scoring.likert.min_answered": 9,
    "scoring.eos.advocate_min": 9,
    "scoring.eos.critic_max": 6,
    "scoring.tps.weights": (D("0.35"), D("0.30"), D("0.20"), D("0.15")),
    "scoring.tps.bands": (D("2.50"), D("3.50"), D("4.00")),
    "scoring.tps.provisional_coverage_lt": D("0.60"),
    "scoring.lri.weights": (D("0.35"), D("0.30"), D("0.20"), D("0.15")),
    "scoring.360.min_raters": 3,
    "scoring.360.min_observed": D("0.60"),
    "scoring.360.min_observed_items": None,      # 2.1: a count per section replaces the share
    "quality.exclusion_rule": "SPEEDING_PLUS_ONE",
    "scoring.360.flag.integrity_lt": D("4.00"),
    "scoring.360.flag.safety_lt": D("3.00"),
    "scoring.360.flag.change_lt": D("3.00"),
    "scoring.360.gap_tiers": (D("0.50"), D("1.00")),
    "scoring.360.default_shared_lt": D("0.10"),
    "scoring.360.range_lt": D("0.50"),
    "segments.floor": 5,
    "segments.qual_floor": 8,
    "segments.perception": (D("5.00"), D("7.00")),
    "segments.sdi_candidate": D("12.00"),
    "segments.single_divergence": D("8.00"),
    "segments.readiness_divergence": D("0.50"),
    "segments.significance_alpha": D("0.05"),
    "leaders.fit_bands": (D(85), D(70), D(55)),
    "leaders.carrier_margin": D("5.00"),
    "leaders.carrier_lri_min": D("3.50"),
    "scoring.readiness.band_edges": (D("2.0"), D("3.0"), D("3.5"), D("4.0")),
    "scoring.eos.band_edges": (0, 30, 50),
    "checks.alignment_bands": (D(80), D(60)),
    "checks.c2_intensity": (D("5.00"), D("15.00")),
    "gates.readiness_le": D("3.0"),
    "plan.priority_caps": (2, 3, 4),
    "plan.visible_signal_days": 30,
    "tracking.rag_flat_band": D("0.05"),
    "survey.min_window_working_days": 10,
    "setup.min_workshop_executives": 2,
    "survey.speeding_min_seconds": 480,
    "survey.speeding_median_fraction": D(1) / D(3),
    "pulse.max_items": 10,
    "pulse.triggers": (D("0.5"), D(15), D("8.0")),
    "quality.alpha_disclose_lt": D("0.70"),
    "quality.uniform_min": 12,
    "quality.duplicate_min": 16,
    # reading aids and indices from the PAC reference platform (CDP v6); see docs/REFERENCE_REVIEW_2026-10.md
    "analytics.gap_bands": (D(4), D(8), D(16)),
    "analytics.entropy_bands": (D(6), D(12), D(20)),
    "analytics.risk.weights": (D("0.40"), D("0.30"), D("0.30")),
    "analytics.risk.scale": (D(20), D(12), D(12)),
    "analytics.risk.bands": (D(35), D(60)),
    "analytics.risk.misalignment_default": D(5),
    "analytics.tension.factor": D("0.8"),
    "analytics.tension.bands": (D(4), D(7)),
    # PAC default targets for the risk dashboard in the full report: (measure, "lt" | "gte" | "gt", target)
    "analytics.targets": (("entropy", "lt", D(6)), ("risk_index", "lt", D(35)), ("d8", "gte", D("3.5")), ("d9", "gte", D("3.5")), ("eos_index", "gt", D(20)), ("perception_gap", "lt", D(5))),
}

TENANT_DEFAULTS = {
    "plan.action_caps": (6, 3, 3),
    "tracking.escalation_days": (7, 14, 21, 28),
    "retention.response_months": 24,
    "retention.aggregate_after_exit_months": 24,
    "ai.enabled": True,
}

# C1 requirement lookup (§1.5.1) and C4 business-model lookup (§1.5.2)
SINGLE_THRESHOLD = {"ENGAGE": D(30), "PERFORM": D(30), "INNOVATE": D(28), "GOVERN": D(28)}
GOAL_TYPES = {
    "RESULTS_GROWTH": ("SINGLE", ["PERFORM"], {"PERFORM": D(30)}),
    "INNOVATION_NEW_MODELS": ("SINGLE", ["INNOVATE"], {"INNOVATE": D(28)}),
    "PEOPLE_TALENT": ("SINGLE", ["ENGAGE"], {"ENGAGE": D(30)}),
    "COMPLIANCE_PROCESS": ("SINGLE", ["GOVERN"], {"GOVERN": D(28)}),
    "TRANSFORMATION": ("JOINT", ["ENGAGE", "INNOVATE"], {"ENGAGE": D(26), "INNOVATE": D(26)}),
}
BUSINESS_MODELS = {
    "PRODUCT_B2B": ("PAIRED", ["PERFORM", "INNOVATE"]),
    "SERVICE_B2C": ("PAIRED", ["ENGAGE", "PERFORM"]),
    "PLATFORM_DIGITAL": ("DOMINANT", ["INNOVATE"]),
    "NGO_SOCIAL_IMPACT": ("PAIRED", ["ENGAGE", "INNOVATE"]),
    "REGULATED": ("PAIRED", ["GOVERN", "PERFORM"]),
}
BALANCED_THRESHOLD = D(24)


# Rules version 2.1 (17 October 2026 spec, owner decisions V-02 and V-05): only the GLOBAL keys it changes.
RULES_2_1 = {
    "survey.speeding_median_fraction": D("0.40"),
    "quality.exclusion_rule": "ANY_TWO",
    "scoring.360.min_observed_items": 3,
}
_active_rules = [RULES_VERSION]


def rules_version():
    return _active_rules[-1]


@contextmanager
def with_rules(version):
    _active_rules.append(version)
    try:
        yield
    finally:
        _active_rules.pop()


def get(key, tenant_overrides=None):
    if _active_rules[-1] in ("2.1", "2.2") and key in RULES_2_1:   # 2.2 scores exactly as 2.1 (it only changes who moves an action)
        return RULES_2_1[key]
    if tenant_overrides and key in tenant_overrides:
        return tenant_overrides[key]
    if key in GLOBAL:
        return GLOBAL[key]
    return TENANT_DEFAULTS[key]


def registry():
    out = deepcopy(GLOBAL)
    out.update(TENANT_DEFAULTS)
    return out


def assert_weights():
    for k in ("scoring.tps.weights", "scoring.lri.weights"):
        if sum(GLOBAL[k]) != D("1.00"):
            raise ValueError(f"{k} must sum to 1.00")


assert_weights()
