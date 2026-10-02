"""
Guardrail constraints enforcement.
Pure Decimal arithmetic.
Zero domain-specific branches.
"""

from decimal import Decimal
from typing import List, Tuple
from engine.models import Guardrail, GuardrailTrigger, GuardrailType


def apply_guardrails(
    current_price: Decimal,
    base_price: Decimal,
    guardrails: List[Guardrail]
) -> Tuple[Decimal, List[GuardrailTrigger]]:
    """
    Enforces floor, ceiling, and percentage limits on the evaluated price.
    """
    enforced = current_price
    triggers: List[GuardrailTrigger] = []

    for guardrail in guardrails:
        if not guardrail.enabled:
            continue

        bound_val = Decimal(guardrail.value)

        if guardrail.type == GuardrailType.FLOOR:
            if enforced < bound_val:
                triggers.append(
                    GuardrailTrigger(
                        guardrail_id=guardrail.id,
                        guardrail_name=guardrail.name,
                        type=guardrail.type,
                        bound_value=str(bound_val),
                        attempted_price=str(enforced),
                        enforced_price=str(bound_val)
                    )
                )
                enforced = bound_val

        elif guardrail.type == GuardrailType.CEILING:
            if enforced > bound_val:
                triggers.append(
                    GuardrailTrigger(
                        guardrail_id=guardrail.id,
                        guardrail_name=guardrail.name,
                        type=guardrail.type,
                        bound_value=str(bound_val),
                        attempted_price=str(enforced),
                        enforced_price=str(bound_val)
                    )
                )
                enforced = bound_val

        elif guardrail.type == GuardrailType.MAX_UPLIFT_PCT:
            max_allowed = base_price * (Decimal("1") + (bound_val / Decimal("100")))
            if enforced > max_allowed:
                triggers.append(
                    GuardrailTrigger(
                        guardrail_id=guardrail.id,
                        guardrail_name=guardrail.name,
                        type=guardrail.type,
                        bound_value=f"+{bound_val}% ({max_allowed})",
                        attempted_price=str(enforced),
                        enforced_price=str(max_allowed)
                    )
                )
                enforced = max_allowed

        elif guardrail.type == GuardrailType.MAX_DISCOUNT_PCT:
            min_allowed = base_price * (Decimal("1") - (bound_val / Decimal("100")))
            if enforced < min_allowed:
                triggers.append(
                    GuardrailTrigger(
                        guardrail_id=guardrail.id,
                        guardrail_name=guardrail.name,
                        type=guardrail.type,
                        bound_value=f"-{bound_val}% ({min_allowed})",
                        attempted_price=str(enforced),
                        enforced_price=str(min_allowed)
                    )
                )
                enforced = min_allowed

    return enforced, triggers
