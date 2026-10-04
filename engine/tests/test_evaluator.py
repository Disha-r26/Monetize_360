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


def test_numeric_and_string_type_coercion_in_conditions():
    engine = PricingEngine()
    item = Item(id="item_test", name="Test Asset", base_price="100.00", unit="$")

    strategy = StrategyConfig(
        domain_id="test_domain",
        version="1.0.0",
        stages=["time", "customer"],
        rules=[
            Rule(
                id="rule_time_window",
                name="Urgent Booking Discount",
                stage="time",
                conditions=[
                    Condition(field="lead_time_days", operator=ComparisonOperator.LESS_THAN_OR_EQUAL, value=2)
                ],
                action=Action(type=ActionType.PERCENTAGE, value="-10"),
            ),
            Rule(
                id="rule_membership",
                name="Elite Tier Privilege",
                stage="customer",
                conditions=[
                    Condition(field="tier", operator=ComparisonOperator.IN, value=["gold", "platinum"])
                ],
                action=Action(type=ActionType.ADDITIVE, value="-5.00"),
            ),
        ],
    )

    # 1. Test integer matching: lead_time_days = 2 -> 100 - 10% = 90
    trace_int = engine.evaluate(PricingContext(item=item, factors={"lead_time_days": 2, "tier": "silver"}), strategy)
    assert Decimal(trace_int.final_price) == Decimal("90.00")

    # 2. Test stringified number matching: lead_time_days = "2" -> 90 (no TypeError)
    trace_str = engine.evaluate(PricingContext(item=item, factors={"lead_time_days": "2", "tier": "silver"}), strategy)
    assert Decimal(trace_str.final_price) == Decimal("90.00")

    # 3. Test float matching: lead_time_days = 1.0 -> 90
    trace_float = engine.evaluate(PricingContext(item=item, factors={"lead_time_days": 1.0, "tier": "silver"}), strategy)
    assert Decimal(trace_float.final_price) == Decimal("90.00")

    # 4. Test above threshold: lead_time_days = 5 -> 100 (rule does not match)
    trace_above = engine.evaluate(PricingContext(item=item, factors={"lead_time_days": 5, "tier": "silver"}), strategy)
    assert Decimal(trace_above.final_price) == Decimal("100.00")

    # 5. Test case-insensitive membership: tier = "Gold" -> matches ["gold", "platinum"]
    trace_case = engine.evaluate(PricingContext(item=item, factors={"lead_time_days": 10, "tier": "Gold"}), strategy)
    assert Decimal(trace_case.final_price) == Decimal("95.00")


def test_hospitality_strategy_all_11_test_cases():
    """Verify all 11 explicit test cases required by the specification."""
    import json
    import os

    pkg_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "domains", "hospitality.json")
    with open(pkg_path, "r", encoding="utf-8") as f:
        d = json.load(f)

    item = Item(**d["items"][0])
    strategy = StrategyConfig(**d["strategy"])
    engine = PricingEngine()

    def run_case(factors):
        ctx = PricingContext(item=item, factors=factors)
        trace = engine.evaluate(ctx, strategy)
        applied = [s.rule_name for s in trace.steps if s.matched and s.stage != "base"]
        return trace.final_price, applied

    # TEST 1: competitor_price = 195 -> No competitor-price adjustment
    p1, a1 = run_case({"occupancy_rate": 0.50, "lead_days": 7, "loyalty_tier": "standard", "competitor_price": 195})
    assert "High Competitor Price" not in a1 and "Low Competitor Price" not in a1
    assert p1 == "180.00"

    # TEST 2: competitor_price = 251 -> High Competitor Price (+10%)
    p2, a2 = run_case({"occupancy_rate": 0.50, "lead_days": 7, "loyalty_tier": "standard", "competitor_price": 251})
    assert "High Competitor Price" in a2
    assert p2 == "198.00"

    # TEST 3: competitor_price = 149 -> Low Competitor Price (-5%)
    p3, a3 = run_case({"occupancy_rate": 0.50, "lead_days": 7, "loyalty_tier": "standard", "competitor_price": 149})
    assert "Low Competitor Price" in a3
    assert p3 == "171.00"

    # TEST 4: lead_days = 13 -> No advance-booking rule
    p4, a4 = run_case({"occupancy_rate": 0.50, "lead_days": 13, "loyalty_tier": "standard", "competitor_price": 195})
    assert "Early Booking Discount" not in a4 and "Advance Booking Discount" not in a4 and "Last Minute Booking Discount" not in a4
    assert p4 == "180.00"

    # TEST 5: lead_days = 14 -> Early Booking Discount (-3%)
    p5, a5 = run_case({"occupancy_rate": 0.50, "lead_days": 14, "loyalty_tier": "standard", "competitor_price": 195})
    assert "Early Booking Discount" in a5
    assert p5 == "174.60"

    # TEST 6: lead_days = 20 -> Early Booking Discount (-3%)
    p6, a6 = run_case({"occupancy_rate": 0.50, "lead_days": 20, "loyalty_tier": "standard", "competitor_price": 195})
    assert "Early Booking Discount" in a6
    assert p6 == "174.60"

    # TEST 7: lead_days = 21 -> Advance Booking Discount (-5%)
    p7, a7 = run_case({"occupancy_rate": 0.50, "lead_days": 21, "loyalty_tier": "standard", "competitor_price": 195})
    assert "Advance Booking Discount" in a7
    assert p7 == "171.00"

    # TEST 8: lead_days = 2, occupancy_rate = 0.50 -> Last Minute Booking Discount (-12%)
    p8, a8 = run_case({"occupancy_rate": 0.50, "lead_days": 2, "loyalty_tier": "standard", "competitor_price": 195})
    assert "Last Minute Booking Discount" in a8
    assert p8 == "158.40"

    # TEST 9: lead_days = 2, occupancy_rate = 0.75 -> Last Minute Booking Discount does NOT apply
    p9, a9 = run_case({"occupancy_rate": 0.75, "lead_days": 2, "loyalty_tier": "standard", "competitor_price": 195})
    assert "Last Minute Booking Discount" not in a9
    assert p9 == "198.00"

    # TEST 10: occupancy_rate = 0.85 -> High Occupancy Surge (+25%)
    p10, a10 = run_case({"occupancy_rate": 0.85, "lead_days": 7, "loyalty_tier": "standard", "competitor_price": 195})
    assert "High Occupancy Surge" in a10
    assert p10 == "225.00"

    # TEST 11: loyalty_tier = gold -> Gold Member Privilege (-$15.00)
    p11, a11 = run_case({"occupancy_rate": 0.50, "lead_days": 7, "loyalty_tier": "gold", "competitor_price": 195})
    assert "Gold Member Privilege" in a11
    assert p11 == "165.00"


def test_hospitality_strategy_realistic_combinations():
    """Verify combined pipeline execution order and compound semantics."""
    import json
    import os

    pkg_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "domains", "hospitality.json")
    with open(pkg_path, "r", encoding="utf-8") as f:
        d = json.load(f)

    item = Item(**d["items"][0])
    strategy = StrategyConfig(**d["strategy"])
    engine = PricingEngine()

    # Combination: competitor_price=300, lead_days=21, occupancy_rate=0.75, loyalty_tier=standard
    # 180 + 10% (moderate occupancy) = 198.00
    # 198 + 10% (high competitor price) = 217.80
    # 217.80 - 5% (advance booking discount) = 206.91
    ctx = PricingContext(item=item, factors={
        "competitor_price": 300,
        "lead_days": 21,
        "occupancy_rate": 0.75,
        "loyalty_tier": "standard"
    })
    trace = engine.evaluate(ctx, strategy)
    applied = [s.rule_name for s in trace.steps if s.matched and s.stage != "base"]
    assert applied == ["Moderate Occupancy Uplift", "High Competitor Price", "Advance Booking Discount"]
    assert trace.final_price == "206.91"


