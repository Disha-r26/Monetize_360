"""
Trace analysis, factor contribution attribution, and counterfactuals.
Strictly domain-agnostic.
"""

from decimal import Decimal
from typing import Any, Dict, List
from engine.models import EvaluationTrace, PricingContext, StrategyConfig


def compute_factor_contributions(trace: EvaluationTrace) -> List[Dict[str, Any]]:
    """
    Computes percentage and absolute contribution for each rule in the waterfall.
    """
    total_adj = abs(Decimal(trace.total_adjustment))
    contributions = []

    for step in trace.steps:
        adj = Decimal(step.adjustment)
        if adj == Decimal("0"):
            continue

        pct = (abs(adj) / total_adj * Decimal("100")) if total_adj > Decimal("0") else Decimal("0")
        contributions.append({
            "stage": step.stage,
            "rule_id": step.rule_id,
            "rule_name": step.rule_name,
            "adjustment": step.adjustment,
            "contribution_pct": str(pct.quantize(Decimal("0.1"))),
            "reason": step.reason
        })

    return contributions


def run_counterfactual(
    base_context: PricingContext,
    modified_factors: Dict[str, Any],
    strategy: StrategyConfig,
    engine_instance
) -> Dict[str, Any]:
    """
    Evaluates pricing with modified factors to compare counterfactual outcomes.
    """
    # Create clone of context with modified factors
    alt_factors = {**base_context.factors, **modified_factors}
    alt_context = PricingContext(
        item=base_context.item,
        factors=alt_factors,
        timestamp=base_context.timestamp
    )

    orig_trace = engine_instance.evaluate(base_context, strategy)
    alt_trace = engine_instance.evaluate(alt_context, strategy)

    diff = Decimal(alt_trace.final_price) - Decimal(orig_trace.final_price)

    return {
        "original_price": orig_trace.final_price,
        "counterfactual_price": alt_trace.final_price,
        "delta": str(diff),
        "original_hash": orig_trace.decision_hash,
        "counterfactual_hash": alt_trace.decision_hash,
        "modified_factors": modified_factors
    }
