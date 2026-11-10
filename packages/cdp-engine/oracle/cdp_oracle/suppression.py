"""Anonymity floors and differencing protection (spec §3.5.12)."""
from . import config as cfg


class Suppressed(Exception):
    def __init__(self, rule, minimum, rollup=None):
        self.rule, self.minimum, self.rollup = rule, minimum, rollup


def check_floor(n, rule="PRIMARY_FLOOR", rollup=None):
    f = cfg.get("segments.floor")
    if n < f:
        raise Suppressed(rule, f, rollup)


def differencing_suppressed(parent_n, children):
    """children: {name: n}. Returns the set of child segments that must be suppressed."""
    f = cfg.get("segments.floor")
    out = {c for c, n in children.items() if n < f}
    if len(children) == 2 and out:
        out = set(children)          # publishing one complement discloses the other
    elif out:
        residual = parent_n - sum(n for c, n in children.items() if c not in out)
        if 0 < residual < f:
            out = set(children)
    return out
