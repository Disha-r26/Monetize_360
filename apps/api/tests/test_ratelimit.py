"""
Focused test suite for API rate limiting.
Tests:
- Requests under limit succeed and receive X-RateLimit-* headers
- Requests exceeding limit return HTTP 429 Too Many Requests
- Returns clear JSON error structure and Retry-After header
- Stricter limits applied to expensive Copilot operations
- Interactive limits applied to pricing evaluations
- Client identification isolation by IP and authenticated user header
- Rate limit reset and test utility isolation
"""

import time
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.ratelimit import rate_limiter_store, DEFAULT_RULES, RateLimitRule

client = TestClient(app)


def setup_function():
    """Reset rate limiter state before each test."""
    rate_limiter_store.reset_for_test()


def teardown_function():
    """Clean up state after each test."""
    rate_limiter_store.reset_for_test()


def test_health_check_is_exempt():
    """Health check endpoint should never be rate limited."""
    for _ in range(30):
        res = client.get("/api/health")
        assert res.status_code == 200
        assert "X-RateLimit-Limit" not in res.headers


def test_pricing_evaluation_within_limit():
    """Pricing evaluation succeeds within the allowed threshold."""
    payload = {
        "domain_id": "hospitality",
        "item_id": "room_deluxe",
        "factors": {"occupancy_rate": 0.85},
    }
    res = client.post("/api/pricing/evaluate", json=payload, headers={"X-Forwarded-For": "198.51.100.1"})
    assert res.status_code == 200
    assert "X-RateLimit-Limit" in res.headers
    assert res.headers["X-RateLimit-Limit"] == str(DEFAULT_RULES["pricing"].max_requests)
    assert int(res.headers["X-RateLimit-Remaining"]) < DEFAULT_RULES["pricing"].max_requests


def test_copilot_stricter_limit_and_429_enforcement():
    """
    Copilot AI endpoint enforces stricter rate limits.
    Once exceeded, returns 429 with Retry-After and clear JSON detail.
    """
    # Temporarily set rule limit to 3 for fast, deterministic unit test
    original_rule = DEFAULT_RULES["copilot"]
    DEFAULT_RULES["copilot"] = RateLimitRule(name="copilot", max_requests=3, window_seconds=60)

    test_ip = "198.51.100.2"
    payload = {
        "domain_id": "hospitality",
        "prompt": "If occupancy > 80%, increase rate by 15%",
    }

    try:
        # 1. First 3 requests must succeed
        for i in range(3):
            res = client.post(
                "/api/copilot/generate-rule",
                json=payload,
                headers={"X-Forwarded-For": test_ip},
            )
            assert res.status_code == 200
            assert "rule" in res.json()
            assert res.headers["X-RateLimit-Remaining"] == str(2 - i)

        # 2. 4th request MUST return HTTP 429 Too Many Requests
        res_blocked = client.post(
            "/api/copilot/generate-rule",
            json=payload,
            headers={"X-Forwarded-For": test_ip},
        )
        assert res_blocked.status_code == 429
        assert "Retry-After" in res_blocked.headers
        assert int(res_blocked.headers["Retry-After"]) >= 1

        body = res_blocked.json()
        assert body["error"] == "too_many_requests"
        assert body["category"] == "copilot"
        assert body["limit"] == 3
        assert "Rate limit exceeded" in body["detail"]
        assert "retry in" in body["detail"]

    finally:
        DEFAULT_RULES["copilot"] = original_rule


def test_user_id_isolation():
    """
    Different authenticated users or client IPs do not consume each other's rate limit quotas.
    """
    original_rule = DEFAULT_RULES["pricing"]
    DEFAULT_RULES["pricing"] = RateLimitRule(name="pricing", max_requests=2, window_seconds=60)

    payload = {
        "domain_id": "hospitality",
        "item_id": "room_deluxe",
        "factors": {},
    }

    try:
        # User A exhausts their 2 requests
        client.post("/api/pricing/evaluate", json=payload, headers={"X-User-Id": "user_alpha"})
        client.post("/api/pricing/evaluate", json=payload, headers={"X-User-Id": "user_alpha"})

        # User A is blocked
        res_a = client.post("/api/pricing/evaluate", json=payload, headers={"X-User-Id": "user_alpha"})
        assert res_a.status_code == 429

        # User B has an independent quota and still succeeds
        res_b = client.post("/api/pricing/evaluate", json=payload, headers={"X-User-Id": "user_beta"})
        assert res_b.status_code == 200
        assert res_b.headers["X-RateLimit-Remaining"] == "1"

    finally:
        DEFAULT_RULES["pricing"] = original_rule


def test_governance_audit_endpoint_rate_limiting():
    """
    Audit logging endpoint is protected from flood attacks.
    """
    original_rule = DEFAULT_RULES["governance_audit"]
    DEFAULT_RULES["governance_audit"] = RateLimitRule(name="governance_audit", max_requests=2, window_seconds=60)

    audit_payload = {
        "domain_id": "hospitality",
        "event_type": "user_login",
        "actor_name": "Demo User",
        "details": {"action": "LOGIN"},
    }

    try:
        res1 = client.post("/api/governance/audit-event", json=audit_payload, headers={"X-Forwarded-For": "198.51.100.99"})
        assert res1.status_code == 200

        res2 = client.post("/api/governance/audit-event", json=audit_payload, headers={"X-Forwarded-For": "198.51.100.99"})
        assert res2.status_code == 200

        res3 = client.post("/api/governance/audit-event", json=audit_payload, headers={"X-Forwarded-For": "198.51.100.99"})
        assert res3.status_code == 429
        assert res3.json()["error"] == "too_many_requests"
        assert res3.json()["category"] == "governance_audit"

    finally:
        DEFAULT_RULES["governance_audit"] = original_rule
