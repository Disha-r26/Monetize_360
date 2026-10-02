"""
Server-side AI Copilot provider.
Supports Google Gemini with strict schema validation and deterministic offline fallback.
Never exposes API keys.
"""

import os
import re
import json
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from engine.models import Action, ActionType, ComparisonOperator, Condition, Rule


class CopilotRuleProposal(BaseModel):
    rule: Rule
    explanation: str
    confidence: float
    provider: str  # "gemini" or "offline"


class BaseCopilotProvider(ABC):
    @abstractmethod
    def generate_rule_from_text(self, prompt: str, domain_context: Dict[str, Any]) -> CopilotRuleProposal:
        pass


class OfflineCopilotProvider(BaseCopilotProvider):
    """
    Deterministic offline NLP rule generator.
    Parses common dynamic pricing patterns without requiring external API keys.
    """

    def generate_rule_from_text(self, prompt: str, domain_context: Dict[str, Any]) -> CopilotRuleProposal:
        lower_prompt = prompt.lower()
        factors = domain_context.get("factors", [])
        factor_names = [f["name"] if isinstance(f, dict) else str(f) for f in factors]

        # Determine target factor
        target_factor = "demand_index"
        for fn in factor_names:
            clean_fn = fn.replace("_", " ")
            if fn in lower_prompt or clean_fn in lower_prompt:
                target_factor = fn
                break

        # Determine operator & threshold
        op = ComparisonOperator.GREATER_THAN
        threshold: Any = 1.0

        num_matches = re.findall(r"[-+]?\d*\.?\d+", prompt)
        pct_matches = re.findall(r"(\d+)%", prompt)

        # Check operator keywords
        if "exceed" in lower_prompt or "greater" in lower_prompt or "above" in lower_prompt or ">" in lower_prompt:
            op = ComparisonOperator.GREATER_THAN_OR_EQUAL if ("equal" in lower_prompt or ">=" in lower_prompt) else ComparisonOperator.GREATER_THAN
        elif "below" in lower_prompt or "less" in lower_prompt or "under" in lower_prompt or "<" in lower_prompt:
            op = ComparisonOperator.LESS_THAN_OR_EQUAL if ("equal" in lower_prompt or "<=" in lower_prompt) else ComparisonOperator.LESS_THAN
        elif "equal" in lower_prompt or "is" in lower_prompt or "==" in lower_prompt:
            op = ComparisonOperator.EQUALS

        # Extract adjustment value and action type
        action_type = ActionType.PERCENTAGE
        action_val = "10"

        if pct_matches:
            pct_val = pct_matches[-1]
            if "discount" in lower_prompt or "reduce" in lower_prompt or "cut" in lower_prompt or "drop" in lower_prompt or "slash" in lower_prompt:
                action_val = f"-{pct_val}"
            else:
                action_val = pct_val
            action_type = ActionType.PERCENTAGE
        elif "$" in prompt or "dollar" in lower_prompt or "fixed" in lower_prompt:
            action_type = ActionType.ADDITIVE
            if num_matches:
                val = num_matches[-1]
                if "discount" in lower_prompt or "minus" in lower_prompt or "reduce" in lower_prompt or "sub" in lower_prompt:
                    action_val = f"-{val}"
                else:
                    action_val = val
        elif "surge" in lower_prompt or "increase" in lower_prompt or "uplift" in lower_prompt:
            action_type = ActionType.PERCENTAGE
            action_val = num_matches[-1] if num_matches else "15"

        # Determine condition threshold from earlier numbers
        if len(num_matches) >= 2:
            try:
                threshold = float(num_matches[0])
            except ValueError:
                threshold = 1.2
        elif "high" in lower_prompt or "peak" in lower_prompt or "surge" in lower_prompt:
            threshold = 1.25

        rule_id = f"copilot_rule_{abs(hash(prompt)) % 10000:04d}"
        rule_name = f"Copilot: {prompt[:30].strip()}..."

        # Stage classification
        stage = "demand"
        if "customer" in lower_prompt or "loyalty" in lower_prompt or "tier" in lower_prompt:
            stage = "customer"
        elif "time" in lower_prompt or "hour" in lower_prompt or "weekend" in lower_prompt or "day" in lower_prompt or "minute" in lower_prompt:
            stage = "time"

        rule = Rule(
            id=rule_id,
            name=rule_name,
            stage=stage,
            description=f"Generated from: '{prompt}'",
            conditions=[
                Condition(field=target_factor, operator=op, value=threshold)
            ],
            action=Action(type=action_type, value=str(action_val)),
            priority=15,
            enabled=True
        )

        return CopilotRuleProposal(
            rule=rule,
            explanation=f"Interpreted natural language instruction into stage '{stage}' condition ({target_factor} {op.value} {threshold}) with {action_type.value} adjustment {action_val}.",
            confidence=0.92,
            provider="offline"
        )


class GeminiCopilotProvider(BaseCopilotProvider):
    """
    Server-side Google Gemini Provider.
    Falls back gracefully to offline provider if GEMINI_API_KEY is not set or network fails.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "").strip()
        self.offline_fallback = OfflineCopilotProvider()

    def generate_rule_from_text(self, prompt: str, domain_context: Dict[str, Any]) -> CopilotRuleProposal:
        if not self.api_key:
            return self.offline_fallback.generate_rule_from_text(prompt, domain_context)

        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")

            system_instruction = (
                "You are an expert dynamic pricing operations copilot. "
                "Convert the user's natural language business instruction into a strict JSON pricing rule. "
                "The JSON must have this exact structure:\n"
                "{\n"
                '  "rule": {\n'
                '    "id": "rule_name_id",\n'
                '    "name": "Human Friendly Name",\n'
                '    "stage": "demand|customer|time|adjustments",\n'
                '    "description": "Short explanation",\n'
                '    "conditions": [{"field": "factor_name", "operator": "==|!=|>|>=|<|<=", "value": 1.2}],\n'
                '    "action": {"type": "additive|multiplicative|percentage|fixed|formula", "value": "20"},\n'
                '    "priority": 10,\n'
                '    "enabled": true\n'
                '  },\n'
                '  "explanation": "Why this rule satisfies the instruction",\n'
                '  "confidence": 0.95\n'
                "}\n"
                "Do NOT wrap in markdown fences other than raw JSON."
            )

            response = model.generate_content(
                f"{system_instruction}\nDomain Context: {json.dumps(domain_context)}\nUser Instruction: {prompt}"
            )

            text_resp = response.text.strip()
            # Clean possible markdown ```json ... ```
            if text_resp.startswith("```"):
                text_resp = re.sub(r"^```(?:json)?", "", text_resp)
                text_resp = re.sub(r"```$", "", text_resp).strip()

            parsed = json.loads(text_resp)
            rule = Rule(**parsed["rule"])

            return CopilotRuleProposal(
                rule=rule,
                explanation=parsed.get("explanation", "Gemini generated pricing rule"),
                confidence=float(parsed.get("confidence", 0.95)),
                provider="gemini"
            )

        except Exception as e:
            # Safe fallback: never crash and never expose API keys
            fallback = self.offline_fallback.generate_rule_from_text(prompt, domain_context)
            fallback.explanation += f" (Note: switched to offline provider: {type(e).__name__})"
            return fallback


def get_copilot_provider() -> BaseCopilotProvider:
    """Factory returning configured Gemini provider with automatic offline fallback."""
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    return GeminiCopilotProvider(api_key=key)
