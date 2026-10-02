"""
Monetize360 Universal Dynamic Pricing Engine - REST API
Pure Decimal calculations, domain-agnostic engine, server-side Copilot,
governance, versioning, audit trail, and config linter.
"""

import os
import json
import random
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
    Rule,
    Guardrail,
    RoundingRule
)
from engine.evaluator import PricingEngine
from engine.trace import compute_factor_contributions, run_counterfactual
from engine.linter import StrategyLinter, LintIssue
from apps.api.copilot.provider import get_copilot_provider, CopilotRuleProposal
from apps.api.governance import governance_store, AuditEntry, VersionRecord

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
linter = StrategyLinter()


def load_domain_pack(domain_id: str) -> Dict[str, Any]:
    file_path = os.path.join(DOMAINS_DIR, f"{domain_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Domain pack '{domain_id}' not found")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_domain_pack(domain_id: str, data: Dict[str, Any]):
    file_path = os.path.join(DOMAINS_DIR, f"{domain_id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


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


class PublishRequest(BaseModel):
    domain_id: str
    author: str = "Pricing Manager"
    notes: Optional[str] = "Production yield strategy rollout"


class RollbackRequest(BaseModel):
    domain_id: str
    target_version: str
    author: str = "Pricing Manager"


class CreateItemRequest(BaseModel):
    id: str
    name: str
    base_price: str
    unit: str = "$"
    attributes: Dict[str, Any] = Field(default_factory=dict)


# --- Root & Health ---

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
        "copilot": "ready",
        "governance": "active"
    }


# --- Domains & Items Management ---

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
                        "active_version": data.get("strategy", {}).get("version", "1.0.0")
                    })
    return {"domains": domains}


@app.get("/api/domains/{domain_id}")
def get_domain(domain_id: str):
    return load_domain_pack(domain_id)


@app.post("/api/domains/{domain_id}/items")
def add_item(domain_id: str, req: CreateItemRequest):
    data = load_domain_pack(domain_id)
    # Check if item id already exists
    if any(it["id"] == req.id for it in data["items"]):
        raise HTTPException(status_code=400, detail=f"Item with ID '{req.id}' already exists")
    
    new_item = req.model_dump()
    data["items"].append(new_item)
    save_domain_pack(domain_id, data)

    governance_store.add_audit_entry(
        author="Pricing Manager",
        action="ITEM_CREATE",
        domain_id=domain_id,
        version=data.get("strategy", {}).get("version", "1.0.0"),
        details={"item_id": req.id, "name": req.name, "base_price": req.base_price}
    )
    return {"status": "created", "item": new_item}


@app.delete("/api/domains/{domain_id}/items/{item_id}")
def delete_item(domain_id: str, item_id: str):
    data = load_domain_pack(domain_id)
    orig_count = len(data["items"])
    data["items"] = [it for it in data["items"] if it["id"] != item_id]
    if len(data["items"]) == orig_count:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}' not found")
    save_domain_pack(domain_id, data)
    return {"status": "deleted", "item_id": item_id}


# --- Rules Management ---

@app.post("/api/domains/{domain_id}/rules")
def add_rule(domain_id: str, rule: Rule):
    data = load_domain_pack(domain_id)
    if "rules" not in data["strategy"]:
        data["strategy"]["rules"] = []
    
    # Overwrite if exists, else append
    data["strategy"]["rules"] = [r for r in data["strategy"]["rules"] if r["id"] != rule.id]
    data["strategy"]["rules"].append(rule.model_dump())
    save_domain_pack(domain_id, data)

    governance_store.add_audit_entry(
        author="Pricing Manager",
        action="RULE_CREATE",
        domain_id=domain_id,
        version=data["strategy"].get("version", "1.0.0"),
        details={"rule_id": rule.id, "name": rule.name, "stage": rule.stage}
    )
    return {"status": "saved", "rule": rule.model_dump()}


@app.delete("/api/domains/{domain_id}/rules/{rule_id}")
def delete_rule(domain_id: str, rule_id: str):
    data = load_domain_pack(domain_id)
    rules = data.get("strategy", {}).get("rules", [])
    data["strategy"]["rules"] = [r for r in rules if r["id"] != rule_id]
    save_domain_pack(domain_id, data)

    governance_store.add_audit_entry(
        author="Pricing Manager",
        action="RULE_DELETE",
        domain_id=domain_id,
        version=data["strategy"].get("version", "1.0.0"),
        details={"rule_id": rule_id}
    )
    return {"status": "deleted", "rule_id": rule_id}


@app.patch("/api/domains/{domain_id}/rules/{rule_id}/toggle")
def toggle_rule(domain_id: str, rule_id: str):
    data = load_domain_pack(domain_id)
    rules = data.get("strategy", {}).get("rules", [])
    matched = False
    for r in rules:
        if r["id"] == rule_id:
            r["enabled"] = not r.get("enabled", True)
            matched = True
            break
    if not matched:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found")
    save_domain_pack(domain_id, data)
    return {"status": "toggled", "rule_id": rule_id}


# --- Pricing Evaluation & Simulation ---

@app.post("/api/pricing/evaluate")
def evaluate_price(req: EvaluateRequest):
    data = load_domain_pack(req.domain_id)
    items_map = {item["id"]: item for item in data["items"]}

    if req.item_id not in items_map:
        raise HTTPException(status_code=404, detail=f"Item '{req.item_id}' not found in domain '{req.domain_id}'")

    item = Item(**items_map[req.item_id])

    factors = {f["name"]: f["default"] for f in data.get("factors", [])}
    factors.update(req.factors)

    context = PricingContext(item=item, factors=factors)
    strategy = StrategyConfig(**data["strategy"])

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


@app.get("/api/pricing/feed/{domain_id}")
def get_live_feed(domain_id: str):
    data = load_domain_pack(domain_id)
    strategy = StrategyConfig(**data["strategy"])
    feed_items = []

    random.seed(int(domain_id.encode().hex(), 16) % 1000)
    for it_data in data["items"][:2]:
        it = Item(**it_data)
        for tick in range(4):
            # Generate simulated factor jitter
            jitter_factors = {}
            for f in data.get("factors", []):
                if isinstance(f["default"], (int, float)):
                    jitter = (random.random() - 0.5) * 0.2
                    jitter_factors[f["name"]] = round(f["default"] + jitter, 2)
                else:
                    jitter_factors[f["name"]] = f["default"]

            context = PricingContext(item=it, factors=jitter_factors)
            trace = engine.evaluate(context, strategy)
            feed_items.append({
                "tick_id": f"tick_{random.randint(1000, 9999)}",
                "item_name": it.name,
                "base_price": str(trace.base_price),
                "evaluated_price": str(trace.final_price),
                "decision_hash": trace.decision_hash[:16] + "...",
                "factors": jitter_factors,
                "unit": it.unit,
                "timestamp": "Just now"
            })

    return {"feed": feed_items}


# --- Copilot ---

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


# --- Governance, Linter, Publishing & Audit ---

@app.post("/api/governance/lint")
def lint_strategy(strategy: StrategyConfig):
    available_factors = ["occupancy_rate", "load_factor", "stock_velocity", "surge_ratio", "seats_sold_pct", "credit_tier"]
    issues = linter.lint(strategy, available_factors)
    return {"issues": [issue.model_dump() for issue in issues]}


@app.get("/api/governance/versions/{domain_id}")
def get_versions(domain_id: str):
    data = load_domain_pack(domain_id)
    versions = governance_store.get_versions(domain_id)
    if not versions:
        # Create initial genesis version record
        init_v = governance_store.record_version(
            domain_id=domain_id,
            version=data.get("strategy", {}).get("version", "1.0.0"),
            status="published",
            author="System Initialization",
            strategy_snapshot=data.get("strategy", {})
        )
        versions = [init_v]
    return {"versions": [v.model_dump() for v in versions]}


@app.post("/api/governance/publish")
def publish_strategy(req: PublishRequest):
    data = load_domain_pack(req.domain_id)
    strategy = StrategyConfig(**data["strategy"])

    # 1. Run Linter
    issues = linter.lint(strategy)
    errors = [i for i in issues if i.severity == "error"]
    if errors:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish strategy with {len(errors)} lint errors: {errors[0].message}"
        )

    # 2. Bump Version (e.g. 1.0.0 -> 1.1.0)
    current_v = data["strategy"].get("version", "1.0.0")
    existing_versions = governance_store.get_versions(req.domain_id)
    if not existing_versions:
        governance_store.record_version(
            domain_id=req.domain_id,
            version=current_v,
            status="archived",
            author="System Baseline",
            strategy_snapshot=data["strategy"]
        )
    parts = current_v.split(".")
    if len(parts) == 3:
        new_v = f"{parts[0]}.{int(parts[1]) + 1}.0"
    else:
        new_v = "1.1.0"

    data["strategy"]["version"] = new_v
    save_domain_pack(req.domain_id, data)

    # 3. Store version record
    v_record = governance_store.record_version(
        domain_id=req.domain_id,
        version=new_v,
        status="published",
        author=req.author,
        strategy_snapshot=data["strategy"]
    )

    # 4. Append to Cryptographic Audit Log
    audit_entry = governance_store.add_audit_entry(
        author=req.author,
        action="PUBLISH",
        domain_id=req.domain_id,
        version=new_v,
        details={
            "rules_count": len(data["strategy"]["rules"]),
            "notes": req.notes,
            "lint_warnings_count": len(issues)
        }
    )

    return {
        "status": "published",
        "version": new_v,
        "record": v_record.model_dump(),
        "audit_entry": audit_entry.model_dump()
    }


@app.post("/api/governance/rollback")
def rollback_strategy(req: RollbackRequest):
    data = load_domain_pack(req.domain_id)
    versions = governance_store.get_versions(req.domain_id)
    target = next((v for v in versions if v.version == req.target_version), None)

    if not target:
        raise HTTPException(status_code=404, detail=f"Target version '{req.target_version}' not found")

    data["strategy"] = target.strategy_snapshot
    save_domain_pack(req.domain_id, data)

    audit_entry = governance_store.add_audit_entry(
        author=req.author,
        action="ROLLBACK",
        domain_id=req.domain_id,
        version=req.target_version,
        details={"reverted_to": req.target_version}
    )

    return {
        "status": "rolled_back",
        "current_version": req.target_version,
        "audit_entry": audit_entry.model_dump()
    }


@app.get("/api/governance/audit-trail")
def get_audit_trail(domain_id: Optional[str] = None):
    entries = governance_store.get_audit_trail(domain_id)
    return {"audit_trail": [e.model_dump() for e in entries]}


@app.get("/api/governance/verify-audit")
def verify_audit():
    return governance_store.verify_audit_chain()
