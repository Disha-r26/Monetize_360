"""
Monetize360 Universal Dynamic Pricing Engine - REST API
Pure Decimal calculations, domain-agnostic engine, server-side Copilot.
"""

import os
import json
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine.models import (
    Item,
    PricingContext,
    StrategyConfig,
    EvaluationTrace,
    Rule
)
from engine.evaluator import PricingEngine
from engine.trace import compute_factor_contributions, run_counterfactual
from apps.api.copilot.provider import get_copilot_provider, CopilotRuleProposal

DOMAINS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "domains"))

app = FastAPI(
    title="Monetize360 Universal Dynamic Pricing API",
    description="Deterministic dynamic pricing operations engine API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = PricingEngine()


def load_domain_pack(domain_id: str) -> Dict[str, Any]:
    file_path = os.path.join(DOMAINS_DIR, f"{domain_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Domain pack '{domain_id}' not found")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


class EvaluateRequest(BaseModel):
    domain_id: str
    item_id: str
    factors: Dict[str, Any] = Field(default_factory=dict)
    custom_rules: Optional[List[Rule]] = None


class CounterfactualRequest(BaseModel):
    domain_id: str
    item_id: str
    base_factors: Dict[str, Any]
    modified_factors: Dict[str, Any]


class SimulateRequest(BaseModel):
    domain_id: str
    item_id: str
    sweep_factor: str
    min_val: float = 0.8
    max_val: float = 2.0
    steps_count: int = 7
    base_factors: Dict[str, Any] = Field(default_factory=dict)


class CopilotRequest(BaseModel):
    prompt: str
    domain_id: str


@app.get("/")
def root():
    return {
        "service": "Monetize360 Universal Dynamic Pricing Engine",
        "status": "online",
        "version": "1.0.0",
        "architecture": "domain-agnostic pure decimal engine"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "engine": "ready",
        "copilot": "ready"
    }


@app.get("/api/domains")
def get_all_domains():
    domains = []
    if os.path.exists(DOMAINS_DIR):
        for fname in os.listdir(DOMAINS_DIR):
            if fname.endswith(".json"):
                fpath = os.path.join(DOMAINS_DIR, fname)
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    domains.append({
                        "id": data["id"],
                        "name": data["name"],
                        "description": data["description"],
                        "unit": data.get("unit", "$"),
                        "items_count": len(data.get("items", [])),
                        "rules_count": len(data.get("strategy", {}).get("rules", [])),
                    })
    return {"domains": domains}


@app.get("/api/domains/{domain_id}")
def get_domain(domain_id: str):
    return load_domain_pack(domain_id)


@app.post("/api/pricing/evaluate")
def evaluate_price(req: EvaluateRequest):
    data = load_domain_pack(req.domain_id)
    items_map = {item["id"]: item for item in data["items"]}

    if req.item_id not in items_map:
        raise HTTPException(status_code=404, detail=f"Item '{req.item_id}' not found in domain '{req.domain_id}'")

    item = Item(**items_map[req.item_id])

    # Merge default factors with provided factors
    factors = {f["name"]: f["default"] for f in data.get("factors", [])}
    factors.update(req.factors)

    context = PricingContext(item=item, factors=factors)
    strategy = StrategyConfig(**data["strategy"])

    # If caller provided temporary custom rules (e.g. from Copilot or draft editor)
    if req.custom_rules:
        strategy.rules = strategy.rules + req.custom_rules

    trace = engine.evaluate(context, strategy)
    contributions = compute_factor_contributions(trace)

    return {
        "trace": trace.model_dump(),
        "contributions": contributions,
        "item": item.model_dump(),
        "factors_used": factors
    }


@app.post("/api/pricing/counterfactual")
def counterfactual(req: CounterfactualRequest):
    data = load_domain_pack(req.domain_id)
    items_map = {item["id"]: item for item in data["items"]}

    if req.item_id not in items_map:
        raise HTTPException(status_code=404, detail=f"Item '{req.item_id}' not found in domain '{req.domain_id}'")

    item = Item(**items_map[req.item_id])
    strategy = StrategyConfig(**data["strategy"])

    base_factors = {f["name"]: f["default"] for f in data.get("factors", [])}
    base_factors.update(req.base_factors)

    base_context = PricingContext(item=item, factors=base_factors)

    res = run_counterfactual(
        base_context=base_context,
        modified_factors=req.modified_factors,
        strategy=strategy,
        engine_instance=engine
    )

    return res


@app.post("/api/pricing/simulate")
def simulate_curve(req: SimulateRequest):
    data = load_domain_pack(req.domain_id)
    items_map = {item["id"]: item for item in data["items"]}

    if req.item_id not in items_map:
        raise HTTPException(status_code=404, detail=f"Item '{req.item_id}' not found in domain '{req.domain_id}'")

    item = Item(**items_map[req.item_id])
    strategy = StrategyConfig(**data["strategy"])

    default_factors = {f["name"]: f["default"] for f in data.get("factors", [])}
    default_factors.update(req.base_factors)

    step_size = (req.max_val - req.min_val) / max(1, req.steps_count - 1)
    points = []

    for i in range(req.steps_count):
        val = round(req.min_val + i * step_size, 3)
        factors = {**default_factors, req.sweep_factor: val}
        context = PricingContext(item=item, factors=factors)
        trace = engine.evaluate(context, strategy)
        points.append({
            "sweep_value": val,
            "final_price": float(trace.final_price),
            "base_price": float(trace.base_price),
            "decision_hash": trace.decision_hash
        })

    return {
        "sweep_factor": req.sweep_factor,
        "points": points,
        "unit": item.unit
    }


@app.post("/api/copilot/generate-rule")
def copilot_generate_rule(req: CopilotRequest):
    data = load_domain_pack(req.domain_id)
    provider = get_copilot_provider()

    proposal = provider.generate_rule_from_text(
        prompt=req.prompt,
        domain_context={
            "domain_id": data["id"],
            "name": data["name"],
            "factors": data.get("factors", []),
            "stages": data.get("strategy", {}).get("stages", [])
        }
    )

    return proposal.model_dump()
