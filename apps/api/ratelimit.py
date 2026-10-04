"""
Production-Grade API Rate Limiting for Monetize360.

Features:
- Sliding-window algorithm with millisecond precision
- Endpoint-specific limits (strict limits for expensive Gemini/Copilot AI operations;
  interactive limits for dynamic pricing evaluations; security limits for governance/audit)
- Client identification via authenticated user ID headers, bearer token hashes, or client IP
- Zero secret logging
- SQLite sliding-window persistence for multi-process safety with high-speed in-memory cache
- Compliant with standard headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After)
- Pure pricing engine remains completely untouched and deterministic
"""

import os
import time
import math
import sqlite3
import hashlib
import tempfile
import threading
from typing import Dict, List, Optional, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class RateLimitRule:
    def __init__(self, name: str, max_requests: int, window_seconds: int = 60):
        self.name = name
        self.max_requests = max_requests
        self.window_seconds = window_seconds


# Production-appropriate endpoint rules
DEFAULT_RULES: Dict[str, RateLimitRule] = {
    "copilot": RateLimitRule(
        name="copilot",
        max_requests=int(os.environ.get("RATE_LIMIT_COPILOT_RPM", "10")),
        window_seconds=60,
    ),
    "pricing": RateLimitRule(
        name="pricing",
        max_requests=int(os.environ.get("RATE_LIMIT_PRICING_RPM", "60")),
        window_seconds=60,
    ),
    "governance_audit": RateLimitRule(
        name="governance_audit",
        max_requests=int(os.environ.get("RATE_LIMIT_AUDIT_RPM", "30")),
        window_seconds=60,
    ),
    "governance_mutate": RateLimitRule(
        name="governance_mutate",
        max_requests=int(os.environ.get("RATE_LIMIT_GOVERNANCE_RPM", "20")),
        window_seconds=60,
    ),
    "domains_mutate": RateLimitRule(
        name="domains_mutate",
        max_requests=int(os.environ.get("RATE_LIMIT_DOMAINS_RPM", "30")),
        window_seconds=60,
    ),
    "default": RateLimitRule(
        name="default",
        max_requests=int(os.environ.get("RATE_LIMIT_DEFAULT_RPM", "120")),
        window_seconds=60,
    ),
}

# Paths exempt from rate limits (health checks, root metadata, documentation)
EXEMPT_PATHS = {
    "/",
    "/api/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/favicon.ico",
}


class RateLimiterStorage:
    """
    Sliding window hit storage.
    Uses high-speed thread-safe in-memory cache, backed by SQLite for multi-process safety
    when writable filesystem is present.
    """

    def __init__(self, db_dir: Optional[str] = None):
        self._lock = threading.Lock()
        self._memory_cache: Dict[str, List[float]] = {}
        self.enabled = os.environ.get("RATE_LIMIT_ENABLED", "true").lower() in ("true", "1", "yes")

        # Configure persistent storage path with fallback to temp directory
        target_dir = db_dir or os.environ.get(
            "RATELIMIT_DATA_DIR",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "ratelimit")),
        )
        try:
            os.makedirs(target_dir, exist_ok=True)
            self.db_path = os.path.join(target_dir, "ratelimit.db")
            # Test write access
            test_file = os.path.join(target_dir, ".write_test")
            with open(test_file, "w", encoding="utf-8") as f:
                f.write("ok")
            os.remove(test_file)
            self._use_sqlite = True
        except OSError:
            try:
                temp_dir = os.path.join(tempfile.gettempdir(), "monetize_ratelimit")
                os.makedirs(temp_dir, exist_ok=True)
                self.db_path = os.path.join(temp_dir, "ratelimit.db")
                self._use_sqlite = True
            except Exception:
                self.db_path = ":memory:"
                self._use_sqlite = False

        if self._use_sqlite:
            self._init_sqlite()

    def _init_sqlite(self):
        try:
            with sqlite3.connect(self.db_path, timeout=5.0) as conn:
                conn.execute("PRAGMA journal_mode=WAL;")
                conn.execute("PRAGMA synchronous=NORMAL;")
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS api_hits (
                        key TEXT NOT NULL,
                        ts REAL NOT NULL
                    );
                """)
                conn.execute("CREATE INDEX IF NOT EXISTS idx_key_ts ON api_hits(key, ts);")
        except Exception:
            self._use_sqlite = False

    def is_allowed(
        self, key: str, max_requests: int, window_seconds: int
    ) -> Tuple[bool, int, int]:
        """
        Record and check request against sliding window.
        Returns:
            (is_allowed: bool, remaining: int, retry_after: int)
        """
        if not self.enabled:
            return True, max_requests, 0

        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            # 1. Memory check & prune
            timestamps = self._memory_cache.get(key, [])
            timestamps = [ts for ts in timestamps if ts > cutoff]

            # 2. SQLite integration if enabled
            if self._use_sqlite:
                try:
                    with sqlite3.connect(self.db_path, timeout=1.0) as conn:
                        # Clean up old records for this key
                        conn.execute("DELETE FROM api_hits WHERE key = ? AND ts <= ?", (key, cutoff))
                        cursor = conn.execute("SELECT ts FROM api_hits WHERE key = ? ORDER BY ts ASC", (key,))
                        db_timestamps = [row[0] for row in cursor.fetchall()]
                        if db_timestamps:
                            timestamps = db_timestamps
                except Exception:
                    pass  # Fall back gracefully to memory cache

            current_count = len(timestamps)

            if current_count >= max_requests:
                # Exceeded: compute retry_after based on earliest timestamp in window
                oldest = timestamps[0] if timestamps else cutoff
                retry_after = max(1, math.ceil(oldest + window_seconds - now))
                self._memory_cache[key] = timestamps
                return False, 0, retry_after

            # Allowed: record new hit
            timestamps.append(now)
            self._memory_cache[key] = timestamps

            if self._use_sqlite:
                try:
                    with sqlite3.connect(self.db_path, timeout=1.0) as conn:
                        conn.execute("INSERT INTO api_hits (key, ts) VALUES (?, ?)", (key, now))
                except Exception:
                    pass

            remaining = max(0, max_requests - len(timestamps))
            return True, remaining, 0

    def reset_for_test(self, key_prefix: Optional[str] = None):
        """Helper for test suites to cleanly clear rate limit data."""
        with self._lock:
            if key_prefix:
                self._memory_cache = {k: v for k, v in self._memory_cache.items() if not k.startswith(key_prefix)}
            else:
                self._memory_cache.clear()

            if self._use_sqlite:
                try:
                    with sqlite3.connect(self.db_path, timeout=2.0) as conn:
                        if key_prefix:
                            conn.execute("DELETE FROM api_hits WHERE key LIKE ?", (f"{key_prefix}%",))
                        else:
                            conn.execute("DELETE FROM api_hits")
                except Exception:
                    pass


# Global storage instance
rate_limiter_store = RateLimiterStorage()


def resolve_client_identifier(request: Request) -> str:
    """
    Extracts an authenticated user ID or client IP without logging sensitive data.
    Order of resolution:
    1. Authenticated header: x-user-id or x-actor-user-id
    2. Bearer authorization token: hashed with SHA-256 for identity without exposing secrets
    3. Proxy header: x-forwarded-for (first IP)
    4. Client host: request.client.host
    """
    # 1. Explicit user ID header if passed by frontend
    user_id = request.headers.get("x-user-id") or request.headers.get("x-actor-user-id")
    if user_id and user_id.strip():
        clean_id = user_id.strip()
        # Ensure identifier format is safe
        return f"usr:{clean_id[:64]}"

    # 2. Authorization header: hash the token to keep key secret-safe
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
            return f"tok:{token_hash}"

    # 3. Client IP resolution via proxy headers
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(",")[0].strip()
        if client_ip:
            return f"ip:{client_ip}"

    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip and x_real_ip.strip():
        return f"ip:{x_real_ip.strip()}"

    if request.client and request.client.host:
        return f"ip:{request.client.host}"

    return "ip:anonymous"


def get_rule_for_path(path: str, method: str) -> Optional[RateLimitRule]:
    """
    Matches the incoming path and HTTP method to the appropriate RateLimitRule.
    Returns None if the route is exempt.
    """
    clean_path = path.rstrip("/") or "/"

    if clean_path in EXEMPT_PATHS:
        return None

    # 1. Copilot AI generation (Strict limit: 10/min)
    if clean_path.startswith("/api/copilot"):
        return DEFAULT_RULES["copilot"]

    # 2. Dynamic Pricing calculation & simulation (Interactive limit: 60/min)
    if clean_path.startswith("/api/pricing"):
        return DEFAULT_RULES["pricing"]

    # 3. Governance audit logging (30/min)
    if clean_path == "/api/governance/audit-event":
        return DEFAULT_RULES["governance_audit"]

    # 4. Governance mutation actions (publish / rollback / lint: 20/min)
    if clean_path in ("/api/governance/publish", "/api/governance/rollback", "/api/governance/lint"):
        return DEFAULT_RULES["governance_mutate"]

    # 5. Domain / item / rule mutation
    if clean_path.startswith("/api/domains") and method in ("POST", "PUT", "DELETE", "PATCH"):
        return DEFAULT_RULES["domains_mutate"]

    # 6. Default API fallback (120/min)
    if clean_path.startswith("/api/"):
        return DEFAULT_RULES["default"]

    return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware applying sliding-window rate limits across external API routes.
    Emits standard rate-limiting headers and returns HTTP 429 when limits are exceeded.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        rule = get_rule_for_path(request.url.path, request.method)

        if rule is None or not rate_limiter_store.enabled:
            return await call_next(request)

        client_id = resolve_client_identifier(request)
        rate_key = f"{rule.name}:{client_id}"

        is_allowed, remaining, retry_after = rate_limiter_store.is_allowed(
            key=rate_key,
            max_requests=rule.max_requests,
            window_seconds=rule.window_seconds,
        )

        if not is_allowed:
            detail_msg = (
                f"Rate limit exceeded: {rule.max_requests} requests per {rule.window_seconds}s "
                f"for {rule.name} operations. Please retry in {retry_after} seconds."
            )
            response = JSONResponse(
                status_code=429,
                content={
                    "detail": detail_msg,
                    "error": "too_many_requests",
                    "category": rule.name,
                    "limit": rule.max_requests,
                    "window_seconds": rule.window_seconds,
                    "retry_after": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(rule.max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(retry_after),
                },
            )
            return response

        response = await call_next(request)

        # Append informational rate limit headers to successful responses
        response.headers["X-RateLimit-Limit"] = str(rule.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(rule.window_seconds)

        return response
