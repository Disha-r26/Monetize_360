"""
Domain-agnostic pricing models.
All monetary figures and adjustments use Decimal.
Zero domain-specific branches or keywords.
"""

from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ActionType(str, Enum):
    ADDITIVE = "additive"
    MULTIPLICATIVE = "multiplicative"
    PERCENTAGE = "percentage"
    FIXED = "fixed"
    FORMULA = "formula"


class ComparisonOperator(str, Enum):
    EQUALS = "=="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    GREATER_THAN_OR_EQUAL = ">="
    LESS_THAN = "<"
    LESS_THAN_OR_EQUAL = "<="
    IN = "in"
    NOT_IN = "not_in"


class Condition(BaseModel):
    field: str
    operator: ComparisonOperator
    value: Any


class Action(BaseModel):
    type: ActionType
    value: str  # String representation for exact Decimal or formula string


class Rule(BaseModel):
    id: str
    name: str
    stage: str
    description: str = ""
    conditions: List[Condition] = Field(default_factory=list)
    action: Action
    priority: int = 100
    enabled: bool = True


class GuardrailType(str, Enum):
    FLOOR = "floor"
    CEILING = "ceiling"
    MAX_UPLIFT_PCT = "max_uplift_pct"
    MAX_DISCOUNT_PCT = "max_discount_pct"


class Guardrail(BaseModel):
    id: str
    name: str
    type: GuardrailType
    value: str  # Decimal string representation
    hard: bool = True
    enabled: bool = True


class RoundingMethod(str, Enum):
    HALF_UP = "half_up"
    HALF_EVEN = "half_even"
    FLOOR = "floor"
    CEIL = "ceil"
    NEAREST_POINT_99 = "nearest_point_99"
    NEAREST_0_05 = "nearest_0_05"


class RoundingRule(BaseModel):
    method: RoundingMethod = RoundingMethod.HALF_UP
    decimals: int = 2


class Item(BaseModel):
    id: str
    name: str
    base_price: str  # Decimal string representation
    unit: str = "$"
    attributes: Dict[str, Any] = Field(default_factory=dict)


class PricingContext(BaseModel):
    item: Item
    factors: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[str] = None


class TraceStep(BaseModel):
    step_number: int
    stage: str
    rule_id: Optional[str] = None
    rule_name: Optional[str] = None
    input_price: str
    adjustment: str
    output_price: str
    reason: str
    matched: bool = True


class GuardrailTrigger(BaseModel):
    guardrail_id: str
    guardrail_name: str
    type: GuardrailType
    bound_value: str
    attempted_price: str
    enforced_price: str


class EvaluationTrace(BaseModel):
    base_price: str
    final_price: str
    total_adjustment: str
    steps: List[TraceStep] = Field(default_factory=list)
    guardrails_triggered: List[GuardrailTrigger] = Field(default_factory=list)
    decision_hash: str
    rounding_applied: str
    unit: str = "$"


class StrategyConfig(BaseModel):
    domain_id: str
    version: str = "1.0.0"
    stages: List[str] = Field(default_factory=list)
    rules: List[Rule] = Field(default_factory=list)
    guardrails: List[Guardrail] = Field(default_factory=list)
    rounding: RoundingRule = Field(default_factory=RoundingRule)
