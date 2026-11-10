"""Fixed-point decimal helpers. All scoring uses Decimal with ROUND_HALF_UP (spec §0.1)."""
from decimal import Decimal, ROUND_HALF_UP, getcontext

getcontext().prec = 34
D = Decimal
ORIENTATIONS = ("ENGAGE", "INNOVATE", "PERFORM", "GOVERN")
DIMENSIONS_CS = ("D1", "D2", "D3", "D4", "D5", "D6")
LIKERT_DIMS = ("D7", "D8", "D9")


def dec(x) -> Decimal:
    if isinstance(x, Decimal):
        return x
    if isinstance(x, float):
        return Decimal(repr(x))
    return Decimal(str(x))


def q(x, places: int) -> Decimal:
    """Round half-up to `places` decimal places."""
    r = dec(x).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
    return r.copy_abs() if r.is_zero() else r          # oracle patch P7: never present a signed zero


def mean(values):
    values = [dec(v) for v in values]
    if not values:
        return None
    return sum(values, Decimal(0)) / Decimal(len(values))


def to_jsonable(obj):
    """Canonical JSON form: Decimals become strings without exponent."""
    if isinstance(obj, Decimal):
        return format(obj, "f")
    if isinstance(obj, dict):
        return {str(k): to_jsonable(v) for k, v in sorted(obj.items(), key=lambda kv: str(kv[0]))}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    return obj
