"""
Unit tests for the domain-agnostic pricing engine.
"""

from decimal import Decimal
import pytest
from engine.models import (
    Action,
    ActionType,
    ComparisonOperator,
    Condition,
    Guardrail,
    GuardrailType,
    Item,
    PricingContext,
    RoundingMethod,
    RoundingRule,
    Rule,
    StrategyConfig,
)
from engine.evaluator import PricingEngine
from engine.expressions import SafeExpressionEvaluator, ExpressionSecurityError
from engine.trace import compute_factor_contributions, run_counterfactual


def test_safe_expression_evaluator_basic_math():
    ctx = {"x": Decimal("10"), "y": Decimal("2.5")}
    evaluator = SafeExpressionEvaluator(ctx)
    res = evaluator.evaluate("x * 2 + y")
    assert res == Decimal("22.5")


def test_safe_expression_evaluator_blocks_unauthorized():
    evaluator = SafeExpressionEvaluator({})
    with pytest.raises(ExpressionSecurityError):
        evaluator.evaluate("__import__('os').system('ls')")


def test_pricing_engine_deterministic_evaluation():
    engine = PricingEngine()

    item = Item(id="item_001", name="Standard Unit", base_price="100.00", unit="$")
    context = PricingContext(item=item, factors={"demand_index": 1.4, "customer_tier": "gold"})

    strategy = StrategyConfig(
        domain_id="test_domain",
        version="1.0.0",
        stages=["demand", "customer"],
        rules=[
            Rule(
                id="rule_demand_surge",
                name="Demand Surge Rule",
                stage="demand",
                conditions=[
                    Condition(field="demand_index", operator=ComparisonOperator.GREATER_THAN, value=1.2)
                ],
                action=Action(type=ActionType.PERCENTAGE, value="20"),
                priority=10,
            ),
            Rule(
                id="rule_gold_discount",
                name="Gold Tier Loyalty Discount",
                stage="customer",
                conditions=[
                    Condition(field="customer_tier", operator=ComparisonOperator.EQUALS, value="gold")
                ],
                action=Action(type=ActionType.ADDITIVE, value="-10.00"),
                priority=20,
            ),
        ],
        guardrails=[
            Guardrail(id="floor_min", name="Floor Margin", type=GuardrailType.FLOOR, value="50.00")
        ],
        rounding=RoundingRule(method=RoundingMethod.HALF_UP, decimals=2),
    )

    # First run
    trace1 = engine.evaluate(context, strategy)
    # 100 + 20% = 120; 120 - 10 = 110.00
    assert Decimal(trace1.final_price) == Decimal("110.00")
    assert len(trace1.steps) == 3  # base, demand, customer

    # Second run with identical input must have IDENTICAL hash
    trace2 = engine.evaluate(context, strategy)
    assert trace1.decision_hash == trace2.decision_hash


def test_pricing_engine_guardrails():
    engine = PricingEngine()
    item = Item(id="item_002", name="Discounted Unit", base_price="100.00", unit="$")
    context = PricingContext(item=item, factors={"discount_trigger": True})

    strategy = StrategyConfig(
        domain_id="test_domain",
        version="1.0.0",
        stages=["adjustments"],
        rules=[
            Rule(
                id="deep_discount",
                name="Deep Slash",
                stage="adjustments",
                conditions=[
                    Condition(field="discount_trigger", operator=ComparisonOperator.EQUALS, value=True)
                ],
                action=Action(type=ActionType.FIXED, value="20.00"),
            )
        ],
        guardrails=[
            Guardrail(id="floor_limit", name="Minimum Price Floor", type=GuardrailType.FLOOR, value="45.00")
        ],
        rounding=RoundingRule(method=RoundingMethod.HALF_UP, decimals=2),
    )

    trace = engine.evaluate(context, strategy)
    assert Decimal(trace.final_price) == Decimal("45.00")
    assert len(trace.guardrails_triggered) == 1
    assert trace.guardrails_triggered[0].guardrail_id == "floor_limit"


def test_counterfactual_analysis():
    engine = PricingEngine()
    item = Item(id="item_003", name="Dynamic Asset", base_price="200.00", unit="$")
    base_context = PricingContext(item=item, factors={"demand_index": 1.5})

    strategy = StrategyConfig(
        domain_id="test_domain",
        version="1.0.0",
        stages=["demand"],
        rules=[
            Rule(
                id="surge",
                name="Surge Uplift",
                stage="demand",
                conditions=[
                    Condition(field="demand_index", operator=ComparisonOperator.GREATER_THAN, value=1.2)
                ],
                action=Action(type=ActionType.PERCENTAGE, value="25"),
            )
        ],
    )

    cf_result = run_counterfactual(
        base_context=base_context,
        modified_factors={"demand_index": 1.0},
        strategy=strategy,
        engine_instance=engine,
    )

    # 200 + 25% = 250 in orig; with demand 1.0 rule doesn't match so price is 200
    assert Decimal(cf_result["original_price"]) == Decimal("250.00")
    assert Decimal(cf_result["counterfactual_price"]) == Decimal("200.00")
    assert Decimal(cf_result["delta"]) == Decimal("-50.00")
    assert cf_result["original_hash"] != cf_result["counterfactual_hash"]
