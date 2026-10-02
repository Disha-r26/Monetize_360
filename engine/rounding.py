"""
Deterministic decimal rounding rules.
Pure Decimal arithmetic.
"""

from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_FLOOR, ROUND_CEILING
from engine.models import RoundingRule, RoundingMethod


def apply_rounding(value: Decimal, rule: RoundingRule) -> Decimal:
    """Applies the specified deterministic rounding strategy to a Decimal amount."""
    decimals = rule.decimals
    quantize_target = Decimal("10") ** -decimals

    if rule.method == RoundingMethod.HALF_UP:
        return value.quantize(quantize_target, rounding=ROUND_HALF_UP)
    elif rule.method == RoundingMethod.HALF_EVEN:
        return value.quantize(quantize_target, rounding=ROUND_HALF_EVEN)
    elif rule.method == RoundingMethod.FLOOR:
        return value.quantize(quantize_target, rounding=ROUND_FLOOR)
    elif rule.method == RoundingMethod.CEIL:
        return value.quantize(quantize_target, rounding=ROUND_CEILING)
    elif rule.method == RoundingMethod.NEAREST_POINT_99:
        # e.g., round to integer then subtract 0.01 (or set cents to .99)
        int_part = value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return int_part - Decimal("0.01")
    elif rule.method == RoundingMethod.NEAREST_0_05:
        # Nearest multiple of 0.05
        step = Decimal("0.05")
        return (value / step).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * step
    else:
        return value.quantize(quantize_target, rounding=ROUND_HALF_UP)
