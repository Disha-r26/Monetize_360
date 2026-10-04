"""
Tests for governance, linter, publishing, rollback, and audit log.
"""

from fastapi.testclient import TestClient
from apps.api.main import app

client = TestClient(app)


def test_linter_detects_contradictory_guardrails():
    payload = {
        "domain_id": "test_domain",
        "version": "1.0.0",
        "stages": ["guardrails"],
        "rules": [],
        "guardrails": [
            {"id": "floor_high", "name": "Floor 150", "type": "floor", "value": "150.00", "hard": True, "enabled": True},
            {"id": "ceil_low", "name": "Ceiling 100", "type": "ceiling", "value": "100.00", "hard": True, "enabled": True}
        ],
        "rounding": {"method": "half_up", "decimals": 2}
    }
    res = client.post("/api/governance/lint", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert any(i["code"] == "CONTRADICTORY_GUARDRAILS" for i in data["issues"])


def test_linter_detects_impossible_condition():
    payload = {
        "domain_id": "test_domain",
        "version": "1.0.0",
        "stages": ["demand"],
        "rules": [
            {
                "id": "impossible_rule",
                "name": "Impossible Condition Rule",
                "stage": "demand",
                "conditions": [
                    {"field": "occupancy_rate", "operator": ">", "value": 0.90},
                    {"field": "occupancy_rate", "operator": "<", "value": 0.50}
                ],
                "action": {"type": "percentage", "value": "10"},
                "priority": 10,
                "enabled": True
            }
        ],
        "guardrails": [],
        "rounding": {"method": "half_up", "decimals": 2}
    }
    res = client.post("/api/governance/lint", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert any(i["code"] == "CONTRADICTORY_CONDITIONS" for i in data["issues"])


def test_publish_and_rollback_workflow():
    domain_id = "hospitality"

    # 1. Fetch initial versions list
    v_init = client.get(f"/api/governance/versions/{domain_id}").json()["versions"]
    initial_version = v_init[-1]["version"]

    # 2. Publish new version
    pub_res = client.post("/api/governance/publish", json={"domain_id": domain_id, "author": "Test Officer"})
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["status"] == "published"
    new_version = pub_data["version"]

    # 3. Verify audit chain integrity
    verify_res = client.get("/api/governance/verify-audit")
    assert verify_res.status_code == 200
    assert verify_res.json()["valid"] is True

    # 4. Check versions list
    v_res = client.get(f"/api/governance/versions/{domain_id}")
    assert v_res.status_code == 200
    versions = v_res.json()["versions"]
    assert any(v["version"] == new_version for v in versions)

    # 5. Rollback to initial version
    roll_res = client.post("/api/governance/rollback", json={
        "domain_id": domain_id,
        "target_version": initial_version,
        "author": "Test Officer"
    })
    assert roll_res.status_code == 200
    assert roll_res.json()["status"] == "rolled_back"


def test_item_and_rule_lifecycle():
    domain_id = "hospitality"
    item_id = f"test_item_custom"

    # Add item
    add_it = client.post(f"/api/domains/{domain_id}/items", json={
        "id": item_id,
        "name": "Custom Penthouse",
        "base_price": "550.00",
        "unit": "$",
        "author": "Disha R"
    })
    assert add_it.status_code == 200

    # Edit item
    edit_it = client.put(f"/api/domains/{domain_id}/items/{item_id}", json={
        "name": "Luxury Penthouse Suite",
        "base_price": "595.00",
        "author": "Disha R"
    })
    assert edit_it.status_code == 200
    assert edit_it.json()["item"]["base_price"] == "595.00"
    assert edit_it.json()["item"]["name"] == "Luxury Penthouse Suite"

    # Verify audit trail contains ITEM_UPDATE with author
    trail_res = client.get(f"/api/governance/audit-trail?domain_id={domain_id}")
    assert trail_res.status_code == 200
    trail = trail_res.json()["audit_trail"]
    assert any(e["action"] == "ITEM_UPDATE" and e["author"] == "Disha R" for e in trail)

    # Delete item
    del_it = client.delete(f"/api/domains/{domain_id}/items/{item_id}?author=Disha%20R")
    assert del_it.status_code == 200


def test_live_feed_endpoint():
    res = client.get("/api/pricing/feed/hospitality")
    assert res.status_code == 200
    data = res.json()
    assert "feed" in data
    assert len(data["feed"]) > 0
    assert "evaluated_price" in data["feed"][0]
