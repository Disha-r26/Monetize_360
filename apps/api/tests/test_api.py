"""
Tests for Monetize360 REST API.
"""

from fastapi.testclient import TestClient
from apps.api.main import app

client = TestClient(app)


def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["engine"] == "ready"


def test_get_all_domains():
    res = client.get("/api/domains")
    assert res.status_code == 200
    data = res.json()
    assert "domains" in data
    assert len(data["domains"]) >= 5


def test_pricing_evaluate_hospitality():
    payload = {
        "domain_id": "hospitality",
        "item_id": "room_deluxe",
        "factors": {
            "occupancy_rate": 0.85,
            "loyalty_tier": "gold"
        }
    }
    res = client.post("/api/pricing/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "trace" in data
    assert "contributions" in data
    trace = data["trace"]
    assert float(trace["final_price"]) > 0
    assert len(trace["decision_hash"]) == 64


def test_pricing_simulate():
    payload = {
        "domain_id": "hospitality",
        "item_id": "room_deluxe",
        "sweep_factor": "occupancy_rate",
        "min_val": 0.5,
        "max_val": 0.95,
        "steps_count": 5
    }
    res = client.post("/api/pricing/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "points" in data
    assert len(data["points"]) == 5


def test_copilot_generate_rule_offline():
    payload = {
        "domain_id": "hospitality",
        "prompt": "If occupancy exceeds 85%, apply 20% surge uplift"
    }
    res = client.post("/api/copilot/generate-rule", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "rule" in data
    assert "explanation" in data
    assert data["provider"] in ["offline", "gemini"]
    rule = data["rule"]
    assert rule["stage"] in ["demand", "customer", "time", "adjustments"]
    assert len(rule["conditions"]) >= 1
