"""
Domain-agnostic pricing configuration linter.
Validates strategy rules, guardrails, and formulas for structural integrity,
contradictions, unreachable logic, and syntax errors.
Zero domain-specific branches or keywords.
"""

from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from engine.models import (
    ComparisonOperator,
    GuardrailType,
    Rule,
    StrategyConfig,
)
from engine.expressions import SafeExpressionEvaluator, ExpressionSecurityError


class LintSeverity:
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class LintIssue(BaseModel):
    code: str
    severity: str  # "error", "warning", "info"
    target_type: str  # "rule", "guardrail", "strategy"
    target_id: Optional[str] = None
    message: str
    recommendation: str


class StrategyLinter:
    """
    Domain-agnostic static analyzer for pricing strategies.
    """

    def lint(self, strategy: StrategyConfig, available_factors: Optional[List[str]] = None) -> List[LintIssue]:
        issues: List[LintIssue] = []

        # 1. Validate Guardrails
        issues.extend(self._lint_guardrails(strategy))

        # 2. Validate Rules
        issues.extend(self._lint_rules(strategy, available_factors))

        return issues

    def _lint_guardrails(self, strategy: StrategyConfig) -> List[LintIssue]:
        issues: List[LintIssue] = []
        floor_val: Optional[Decimal] = None
        ceiling_val: Optional[Decimal] = None

        for g in strategy.guardrails:
            if not g.enabled:
                continue

            try:
                val = Decimal(str(g.value))
                if val < Decimal("0"):
                    issues.append(
                        LintIssue(
                            code="NEGATIVE_GUARDRAIL_BOUND",
                            severity=LintSeverity.WARNING,
                            target_type="guardrail",
                            target_id=g.id,
                            message=f"Guardrail '{g.name}' has negative bound {val}.",
                            recommendation="Verify whether negative price bounds are intentional.",
                        )
                    )

                if g.type == GuardrailType.FLOOR:
                    if floor_val is None or val > floor_val:
                        floor_val = val
                elif g.type == GuardrailType.CEILING:
                    if ceiling_val is None or val < ceiling_val:
                        ceiling_val = val

            except (InvalidOperation, ValueError):
                issues.append(
                    LintIssue(
                        code="INVALID_GUARDRAIL_VALUE",
                        severity=LintSeverity.ERROR,
                        target_type="guardrail",
                        target_id=g.id,
                        message=f"Guardrail '{g.name}' bound '{g.value}' is not a valid Decimal.",
                        recommendation="Set bound to a valid numeric Decimal string.",
                    )
                )

        if floor_val is not None and ceiling_val is not None:
            if floor_val > ceiling_val:
                issues.append(
                    LintIssue(
                        code="CONTRADICTORY_GUARDRAILS",
                        severity=LintSeverity.ERROR,
                        target_type="strategy",
                        target_id="guardrails",
                        message=f"Contradictory guardrail limits: floor ({floor_val}) exceeds ceiling ({ceiling_val}).",
                        recommendation="Ensure price floor is strictly less than price ceiling.",
                    )
                )

        return issues

    def _lint_rules(self, strategy: StrategyConfig, available_factors: Optional[List[str]]) -> List[LintIssue]:
        issues: List[LintIssue] = []
        rule_signatures: Dict[str, str] = {}

        for rule in strategy.rules:
            if not rule.enabled:
                continue

            # Check action value validity
            if rule.action.type.value == "formula":
                try:
                    evaluator = SafeExpressionEvaluator({"current_price": Decimal("100"), "base_price": Decimal("100")})
                    if available_factors:
                        for f in available_factors:
                            evaluator.context[f] = Decimal("1.0")
                    evaluator.evaluate(rule.action.value)
                except ExpressionSecurityError as e:
                    issues.append(
                        LintIssue(
                            code="UNSAFE_OR_INVALID_FORMULA",
                            severity=LintSeverity.ERROR,
                            target_type="rule",
                            target_id=rule.id,
                            message=f"Rule '{rule.name}' formula '{rule.action.value}' failed check: {e}",
                            recommendation="Use only safe arithmetic and whitelisted math functions.",
                        )
                    )
                except Exception:
                    pass
            else:
                try:
                    Decimal(str(rule.action.value))
                except (InvalidOperation, ValueError):
                    issues.append(
                        LintIssue(
                            code="INVALID_ACTION_VALUE",
                            severity=LintSeverity.ERROR,
                            target_type="rule",
                            target_id=rule.id,
                            message=f"Rule '{rule.name}' action value '{rule.action.value}' is not a valid Decimal.",
                            recommendation="Provide a valid numeric string for action value.",
                        )
                    )

            # Check contradictory conditions within single rule
            issues.extend(self._lint_condition_contradictions(rule))

            # Duplicate rule detection
            sig = f"{rule.stage}:" + ",".join(
                sorted(f"{c.field}{c.operator.value}{c.value}" for c in rule.conditions)
            )
            if sig in rule_signatures:
                prior_id = rule_signatures[sig]
                issues.append(
                    LintIssue(
                        code="POTENTIAL_REDUNDANT_RULE",
                        severity=LintSeverity.WARNING,
                        target_type="rule",
                        target_id=rule.id,
                        message=f"Rule '{rule.name}' shares identical conditions with '{prior_id}'.",
                        recommendation="Consolidate duplicate rules or adjust priority/conditions.",
                    )
                )
            else:
                rule_signatures[sig] = rule.id

        return issues

    def _lint_condition_contradictions(self, rule: Rule) -> List[LintIssue]:
        issues: List[LintIssue] = []
        gt_bounds: Dict[str, Decimal] = {}
        lt_bounds: Dict[str, Decimal] = {}

        for c in rule.conditions:
            if not isinstance(c.value, (int, float)) or isinstance(c.value, bool):
                continue
            val = Decimal(str(c.value))

            if c.operator in [ComparisonOperator.GREATER_THAN, ComparisonOperator.GREATER_THAN_OR_EQUAL]:
                if c.field not in gt_bounds or val > gt_bounds[c.field]:
                    gt_bounds[c.field] = val
            elif c.operator in [ComparisonOperator.LESS_THAN, ComparisonOperator.LESS_THAN_OR_EQUAL]:
                if c.field not in lt_bounds or val < lt_bounds[c.field]:
                    lt_bounds[c.field] = val

        for field in set(gt_bounds.keys()).intersection(lt_bounds.keys()):
            if gt_bounds[field] > lt_bounds[field]:
                issues.append(
                    LintIssue(
                        code="CONTRADICTORY_CONDITIONS",
                        severity=LintSeverity.ERROR,
                        target_type="rule",
                        target_id=rule.id,
                        message=f"Rule '{rule.name}' condition on '{field}' is impossible: field > {gt_bounds[field]} and field < {lt_bounds[field]}.",
                        recommendation="Correct condition boundaries so the range is satisfiable.",
                    )
                )

        return issues
