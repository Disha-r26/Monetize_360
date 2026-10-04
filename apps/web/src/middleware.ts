import { NextRequest, NextResponse } from "next/server";

/**
 * Production-grade API Rate Limiting Middleware for Monetize360.
 *
 * Guarantees:
 * - Matcher strictly targets '/api/:path*' ONLY.
 * - Explicit early return guard guarantees rate limiting NEVER runs on:
 *     * Root page ('/')
 *     * Next.js internal static assets ('/_next/*')
 *     * Page routes ('/login', '/signup', etc.)
 *     * Static assets, images, favicon, CSS, JS chunks (files with extensions)
 * - Rate limiting applies ONLY to intended /api/* endpoints:
 *     * Copilot AI operations: 10 requests / min
 *     * Dynamic Pricing calculations & simulations: 60 requests / min
 *     * Governance audit event logging: 30 requests / min
 *     * Governance mutations (publish / rollback / lint): 20 requests / min
 *     * Domain & inventory mutations: 30 requests / min
 *     * Default API routes: 120 requests / min
 *     * Exempt: /api/health
 * - Complies with standard HTTP headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After).
 * - Emits HTTP 429 Too Many Requests when limits are exceeded.
 * - 100% Edge-runtime compatible: zero Node-only package dependencies.
 * - Never returns 404 or rewrites/redirects for page routes.
 */

interface RateLimitRule {
  name: string;
  maxRequests: number;
  windowSeconds: number;
}

const RULES: Record<string, RateLimitRule> = {
  copilot: {
    name: "copilot",
    maxRequests: parseInt(process.env.RATE_LIMIT_COPILOT_RPM || "10", 10),
    windowSeconds: 60,
  },
  pricing: {
    name: "pricing",
    maxRequests: parseInt(process.env.RATE_LIMIT_PRICING_RPM || "60", 10),
    windowSeconds: 60,
  },
  governance_audit: {
    name: "governance_audit",
    maxRequests: parseInt(process.env.RATE_LIMIT_AUDIT_RPM || "30", 10),
    windowSeconds: 60,
  },
  governance_mutate: {
    name: "governance_mutate",
    maxRequests: parseInt(process.env.RATE_LIMIT_GOVERNANCE_RPM || "20", 10),
    windowSeconds: 60,
  },
  domains_mutate: {
    name: "domains_mutate",
    maxRequests: parseInt(process.env.RATE_LIMIT_DOMAINS_RPM || "30", 10),
    windowSeconds: 60,
  },
  default: {
    name: "default",
    maxRequests: parseInt(process.env.RATE_LIMIT_DEFAULT_RPM || "120", 10),
    windowSeconds: 60,
  },
};

const EXEMPT_PATHS = new Set(["/api/health", "/favicon.ico"]);

// High-performance in-memory sliding window hit tracker for Edge / Serverless runtime
const hitStore = new Map<string, number[]>();

function getRuleForPath(pathname: string, method: string): RateLimitRule | null {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  if (EXEMPT_PATHS.has(cleanPath)) {
    return null;
  }

  // 1. Copilot AI generation (Strict limit: 10/min)
  if (cleanPath.startsWith("/api/copilot")) {
    return RULES.copilot;
  }

  // 2. Dynamic Pricing calculation & simulation (Interactive limit: 60/min)
  if (cleanPath.startsWith("/api/pricing")) {
    return RULES.pricing;
  }

  // 3. Governance audit logging (30/min)
  if (cleanPath === "/api/governance/audit-event") {
    return RULES.governance_audit;
  }

  // 4. Governance mutation actions (publish / rollback / lint: 20/min)
  if (
    cleanPath === "/api/governance/publish" ||
    cleanPath === "/api/governance/rollback" ||
    cleanPath === "/api/governance/lint"
  ) {
    return RULES.governance_mutate;
  }

  // 5. Domain / item / rule mutation
  if (cleanPath.startsWith("/api/domains") && ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
    return RULES.domains_mutate;
  }

  // 6. Default API fallback (120/min)
  if (cleanPath.startsWith("/api/")) {
    return RULES.default;
  }

  return null;
}

function resolveClientIdentifier(req: NextRequest): string {
  // 1. Explicit user ID header if present
  const userId = req.headers.get("x-user-id") || req.headers.get("x-actor-user-id");
  if (userId && userId.trim()) {
    return `usr:${userId.trim().slice(0, 64)}`;
  }

  // 2. Authorization header: hash the token to keep key secret-safe
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      return `tok:${Math.abs(hash).toString(16)}`;
    }
  }

  // 3. Client IP from standard proxy headers
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ip = xForwardedFor.split(",")[0].trim();
    if (ip) return `ip:${ip}`;
  }

  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp && xRealIp.trim()) {
    return `ip:${xRealIp.trim()}`;
  }

  return "ip:anonymous";
}

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { isAllowed: boolean; remaining: number; retryAfter: number } {
  const isEnabled = (process.env.RATE_LIMIT_ENABLED || "true").toLowerCase() !== "false";
  if (!isEnabled) {
    return { isAllowed: true, remaining: maxRequests, retryAfter: 0 };
  }

  const now = Date.now();
  const cutoff = now - windowSeconds * 1000;

  let timestamps = hitStore.get(key) || [];
  // Prune expired timestamps
  timestamps = timestamps.filter((t) => t > cutoff);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] || cutoff;
    const retryAfter = Math.max(1, Math.ceil((oldest + windowSeconds * 1000 - now) / 1000));
    hitStore.set(key, timestamps.slice(-maxRequests));
    return { isAllowed: false, remaining: 0, retryAfter };
  }

  timestamps.push(now);
  hitStore.set(key, timestamps.slice(-maxRequests));

  // Periodically prune stale keys to prevent memory leak
  if (hitStore.size > 1000) {
    hitStore.forEach((tsList, k) => {
      const valid = tsList.filter((t) => t > cutoff);
      if (valid.length === 0) {
        hitStore.delete(k);
      } else {
        hitStore.set(k, valid);
      }
    });
  }

  const remaining = Math.max(0, maxRequests - timestamps.length);
  return { isAllowed: true, remaining, retryAfter: 0 };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. STRICT GUARD: Rate limiting applies ONLY to /api/* endpoints.
  // Immediately pass through for:
  // - Root page ('/')
  // - Next.js internal resources ('/_next/*')
  // - Non-API page routes ('/login', '/signup', etc.)
  // - Static assets, images, favicon, CSS, JS chunks (paths containing file extensions)
  if (
    !pathname.startsWith("/api/") ||
    pathname === "/" ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Health check exemption
  if (pathname === "/api/health" || pathname === "/api/health/") {
    return NextResponse.next();
  }

  const rule = getRuleForPath(pathname, request.method);
  if (!rule) {
    return NextResponse.next();
  }

  const clientId = resolveClientIdentifier(request);
  const rateKey = `${rule.name}:${clientId}`;

  const { isAllowed, remaining, retryAfter } = checkRateLimit(
    rateKey,
    rule.maxRequests,
    rule.windowSeconds
  );

  if (!isAllowed) {
    const detailMsg = `Rate limit exceeded: ${rule.maxRequests} requests per ${rule.windowSeconds}s for ${rule.name} operations. Please retry in ${retryAfter} seconds.`;

    return NextResponse.json(
      {
        detail: detailMsg,
        error: "too_many_requests",
        category: rule.name,
        limit: rule.maxRequests,
        window_seconds: rule.windowSeconds,
        retry_after: retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": rule.maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": retryAfter.toString(),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", rule.maxRequests.toString());
  response.headers.set("X-RateLimit-Remaining", remaining.toString());
  response.headers.set("X-RateLimit-Reset", rule.windowSeconds.toString());
  return response;
}

/**
 * Matcher configuration:
 * Strictest possible matcher applying ONLY to /api/* routes.
 * Guaranteed never to match /, /_next, favicon, public files, or main pages.
 */
export const config = {
  matcher: ["/api/:path*"],
};
