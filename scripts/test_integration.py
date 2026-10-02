"""
Monetize360 End-to-End Integration Verification Script.
Tests all application features through the single entry point (http://localhost:3000).
"""

import sys
import httpx

BASE_URL = "http://localhost:3000"


def test_integration():
    client = httpx.Client(base_url=BASE_URL, timeout=15.0)

    print("\n--- 1. Testing Frontend Entrypoint (GET /) ---")
    res = client.get("/")
    assert res.status_code == 200, f"Expected 200 but got {res.status_code}"
    print("[PASS] Frontend root returned HTTP 200 OK")

    print("\n--- 2. Testing Proxied Health (GET /api/health) ---")
    res = client.get("/api/health")
    assert res.status_code == 200, f"Expected 200 but got {res.status_code}"
    health = res.json()
    assert health["status"] == "healthy"
    print(f"[PASS] Health check verified: {health}")

    print("\n--- 3. Testing Domains (GET /api/domains) ---")
    res = client.get("/api/domains")
    assert res.status_code == 200
    domains_data = res.json()
    assert len(domains_data["domains"]) >= 5
    print(f"[PASS] Loaded {len(domains_data['domains'])} domains through port 3000")

    print("\n--- 4. Testing Pricing Evaluation (POST /api/pricing/evaluate) ---")
    eval_payload = {
        "domain_id": "hospitality",
        "item_id": "room_deluxe",
        "factors": {
            "occupancy_rate": 0.85,
            "loyalty_tier": "gold"
        }
    }
    res = client.post("/api/pricing/evaluate", json=eval_payload)
    assert res.status_code == 200, f"Evaluate failed: {res.text}"
    eval_data = res.json()
    trace = eval_data["trace"]
    print(f"[PASS] Evaluated Price: ${trace['final_price']} (Base: ${trace['base_price']})")
    print(f"[PASS] Decision Hash: {trace['decision_hash']}")
    print(f"[PASS] Waterfall Steps: {len(trace['steps'])} steps recorded")

    print("\n--- 5. Testing Simulation Curve (POST /api/pricing/simulate) ---")
    sim_payload = {
        "domain_id": "hospitality",
        "item_id": "room_deluxe",
        "sweep_factor": "occupancy_rate",
        "min_val": 0.6,
        "max_val": 0.95,
        "steps_count": 5
    }
    res = client.post("/api/pricing/simulate", json=sim_payload)
    assert res.status_code == 200
    sim_data = res.json()
    assert len(sim_data["points"]) == 5
    print(f"[PASS] Simulation generated {len(sim_data['points'])} curve points")

    print("\n--- 6. Testing Counterfactual Analysis (POST /api/pricing/counterfactual) ---")
    cf_payload = {
        "domain_id": "hospitality",
        "item_id": "room_deluxe",
        "base_factors": {"occupancy_rate": 0.85},
        "modified_factors": {"occupancy_rate": 0.50}
    }
    res = client.post("/api/pricing/counterfactual", json=cf_payload)
    assert res.status_code == 200
    cf_data = res.json()
    print(f"[PASS] Counterfactual delta: ${cf_data['delta']} (Original: ${cf_data['original_price']} -> Modified: ${cf_data['counterfactual_price']})")

    print("\n--- 7. Testing Copilot Rule Generation (POST /api/copilot/generate-rule) ---")
    copilot_payload = {
        "domain_id": "hospitality",
        "prompt": "If occupancy rate is above 0.80, surge room price by 25%"
    }
    res = client.post("/api/copilot/generate-rule", json=copilot_payload)
    assert res.status_code == 200
    copilot_data = res.json()
    assert "rule" in copilot_data
    rule = copilot_data["rule"]
    print(f"[PASS] Copilot ({copilot_data['provider']}) created rule: {rule['name']}")
    print(f"  Stage: {rule['stage']}, Action: {rule['action']['type']} ({rule['action']['value']})")

    print("\n" + "=" * 60)
    print("  ALL END-TO-END INTEGRATION TESTS PASSED (100%)")
    print("=" * 60)


if __name__ == "__main__":
    test_integration()
