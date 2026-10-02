"""
Core deterministic pricing engine evaluator.
Pure Decimal arithmetic.
100% domain-agnostic.
Zero domain branches.
"""

import hashlib
import json
from decimal import Decimal
from typing import Any, Dict, List
from engine.models import (
    ActionType,
    ComparisonOperator,
    Condition,
    EvaluationTrace,
    PricingContext,
    Rule,
    StrategyConfig,
    TraceStep,
)
from engine.expressions import SafeExpressionEvaluator
from engine.guardrails import apply_guardrails
from engine.rounding import apply_rounding


class PricingEngine:
    """
    Deterministic domain-agnostic pricing engine.
    Executes ordered pipeline:
    Base Price -> Ordered Stage Rules -> Guardrails -> Rounding -> Waterfall Trace
    """

    def evaluate(self, context: PricingContext, strategy: StrategyConfig) -> EvaluationTrace:
        base_price = Decimal(str(context.item.base_price))
        current_price = base_price
        steps: List[TraceStep] = []
        step_counter = 1

        # Flatten context variables for expression evaluation
        eval_ctx: Dict[str, Any] = {
            "base_price": base_price,
            "current_price": current_price,
            **context.factors,
            **context.item.attributes,
        }

        # Initial base step
        steps.append(
            TraceStep(
                step_number=step_counter,
                stage="base",
                rule_id=None,
                rule_name="Base Price Reference",
                input_price=str(base_price),
                adjustment="0.00",
                output_price=str(base_price),
                reason=f"Initial item base price for {context.item.name}",
                matched=True,
            )
        )
        step_counter += 1

        # Determine stages order
        ordered_stages = strategy.stages if strategy.stages else ["demand", "customer", "time", "adjustments"]

        # Group rules by stage
        stage_rules: Dict[str, List[Rule]] = {s: [] for s in ordered_stages}
        other_rules: List[Rule] = []

        for rule in strategy.rules:
            if not rule.enabled:
                continue
            if rule.stage in stage_rules:
                stage_rules[rule.stage].append(rule)
            else:
                other_rules.append(rule)

        # Execute rules stage by stage
        stages_to_run = ordered_stages + (["other"] if other_rules else [])
        if "other" in stages_to_run:
            stage_rules["other"] = other_rules

        applied_rule_ids: List[str] = []

        for stage in stages_to_run:
            rules_in_stage = sorted(stage_rules.get(stage, []), key=lambda r: r.priority)

            for rule in rules_in_stage:
                eval_ctx["current_price"] = current_price
                if self._conditions_match(rule.conditions, eval_ctx):
                    prev_price = current_price
                    current_price, adj_val = self._apply_action(rule.action, current_price, base_price, eval_ctx)
                    applied_rule_ids.append(rule.id)

                    steps.append(
                        TraceStep(
                            step_number=step_counter,
                            stage=stage,
                            rule_id=rule.id,
                            rule_name=rule.name,
                            input_price=str(prev_price),
                            adjustment=str(adj_val),
                            output_price=str(current_price),
                            reason=rule.description or f"Applied rule {rule.name}",
                            matched=True,
                        )
                    )
                    step_counter += 1

        # Enforce Guardrails
        guarded_price, guardrail_triggers = apply_guardrails(
            current_price=current_price,
            base_price=base_price,
            guardrails=strategy.guardrails,
        )

        if guarded_price != current_price:
            steps.append(
                TraceStep(
                    step_number=step_counter,
                    stage="guardrails",
                    rule_id="GUARDRAILS",
                    rule_name="Guardrail Enforcement",
                    input_price=str(current_price),
                    adjustment=str(guarded_price - current_price),
                    output_price=str(guarded_price),
                    reason=f"Enforced guardrails: {', '.join(t.guardrail_name for t in guardrail_triggers)}",
                    matched=True,
                )
            )
            step_counter += 1
            current_price = guarded_price

        # Enforce Rounding
        final_price = apply_rounding(current_price, strategy.rounding)
        if final_price != current_price:
            steps.append(
                TraceStep(
                    step_number=step_counter,
                    stage="rounding",
                    rule_id="ROUNDING",
                    rule_name="Rounding Policy",
                    input_price=str(current_price),
                    adjustment=str(final_price - current_price),
                    output_price=str(final_price),
                    reason=f"Applied {strategy.rounding.method.value} rounding to {strategy.rounding.decimals} decimal places",
                    matched=True,
                )
            )

        # Compute Deterministic Decision Hash
        decision_payload = {
            "domain_id": strategy.domain_id,
            "version": strategy.version,
            "item_id": context.item.id,
            "base_price": str(base_price),
            "factors": {k: str(v) for k, v in sorted(context.factors.items())},
            "applied_rules": applied_rule_ids,
            "final_price": str(final_price),
        }
        hash_str = json.dumps(decision_payload, sort_keys=True)
        decision_hash = hashlib.sha256(hash_str.encode("utf-8")).hexdigest()

        return EvaluationTrace(
            base_price=str(base_price),
            final_price=str(final_price),
            total_adjustment=str(final_price - base_price),
            steps=steps,
            guardrails_triggered=guardrail_triggers,
            decision_hash=decision_hash,
            rounding_applied=strategy.rounding.method.value,
            unit=context.item.unit,
        )

    def _conditions_match(self, conditions: List[Condition], ctx: Dict[str, Any]) -> bool:
        if not conditions:
            return True

        for cond in conditions:
            field_val = ctx.get(cond.field)
            if field_val is None:
                return False

            target_val = cond.value
            # Convert numeric types (excluding bool) to Decimal for exact comparison
            if isinstance(field_val, bool) or isinstance(target_val, bool):
                pass
            elif isinstance(field_val, (int, float)):
                field_val = Decimal(str(field_val))
            elif isinstance(target_val, (int, float)):
                target_val = Decimal(str(target_val))

            op = cond.operator
            if op == ComparisonOperator.EQUALS:
                if field_val != target_val:
                    return False
            elif op == ComparisonOperator.NOT_EQUALS:
                if field_val == target_val:
                    return False
            elif op == ComparisonOperator.GREATER_THAN:
                if not (field_val > target_val):
                    return False
            elif op == ComparisonOperator.GREATER_THAN_OR_EQUAL:
                if not (field_val >= target_val):
                    return False
            elif op == ComparisonOperator.LESS_THAN:
                if not (field_val < target_val):
                    return False
            elif op == ComparisonOperator.LESS_THAN_OR_EQUAL:
                if not (field_val <= target_val):
                    return False
            elif op == ComparisonOperator.IN:
                if field_val not in target_val:
                    return False
            elif op == ComparisonOperator.NOT_IN:
                if field_val in target_val:
                    return False

        return True

    def _apply_action(
        self,
        action,
        current_price: Decimal,
        base_price: Decimal,
        ctx: Dict[str, Any]
    ) -> tuple[Decimal, Decimal]:
        act_type = action.type
        val_str = str(action.value)

        if act_type == ActionType.ADDITIVE:
            delta = Decimal(val_str)
            return current_price + delta, delta

        elif act_type == ActionType.MULTIPLICATIVE:
            multiplier = Decimal(val_str)
            new_price = current_price * multiplier
            return new_price, new_price - current_price

        elif act_type == ActionType.PERCENTAGE:
            pct = Decimal(val_str)
            delta = current_price * (pct / Decimal("100"))
            return current_price + delta, delta

        elif act_type == ActionType.FIXED:
            fixed_val = Decimal(val_str)
            return fixed_val, fixed_val - current_price

        elif act_type == ActionType.FORMULA:
            evaluator = SafeExpressionEvaluator(ctx)
            result = evaluator.evaluate(val_str)
            res_dec = Decimal(str(result))
            return res_dec, res_dec - current_price

        return current_price, Decimal("0.00")
