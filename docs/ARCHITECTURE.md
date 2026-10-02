# Monetize360 System Architecture & Implementation Plan

## 1. System Overview & Monorepo Structure

```
.
├── apps/
│   ├── web/                     # Next.js App Router (14+), React, Tailwind, Lucide, Recharts
│   └── api/                     # FastAPI backend, SQLAlchemy 2, Pydantic v2
├── engine/                      # Standalone domain-agnostic pricing package
│   ├── __init__.py
│   ├── models.py                # Abstract pricing schemas (Item, Factor, Rule, Stage, Trace)
│   ├── evaluator.py             # Deterministic pipeline evaluator with Decimal arithmetic
│   ├── expressions.py           # Whitelisted AST-based safe expression parser & evaluator
│   ├── guardrails.py            # Floor, ceiling, margin constraints
│   ├── rounding.py              # Currency/unit rounding strategies
│   └── trace.py                 # Structured execution waterfall & decision hash
├── data/
│   ├── domains/                 # Declarative Domain Packs (Hospitality, Travel, Banking, E-commerce, Ride-hailing, Cinema)
│   ├── synthetic/               # Fixed-seed synthetic data generators
│   └── tests/                   # Golden test cases, conflict scenarios, natural-language/config pairs
├── docs/                        # Architecture, ADRs, Research, API, Demo, Progress, Decisions
├── scripts/                     # Load test, simulation scripts, verification guards
├── docker-compose.yml           # Optional PostgreSQL and services
├── Makefile                     # Root workflow targets
├── .env.example                 # Template for environment configuration
├── .gitignore                   # Local ignores and secrets protection
└── README.md                    # Project documentation and quickstart
```

---

## 2. Phase-by-Phase Implementation Plan

### Phase 0: Scaffold and Conventions
- Directory tree initialization (`apps/web`, `apps/api`, `engine`, `data`, `docs`, `scripts`).
- Environment configuration: `.env.example`, `.env.local` with `GEMINI_API_KEY=`.
- `Makefile` and `docker-compose.yml`.
- Base dependencies specification (`pyproject.toml` or `requirements.txt` for Python; `package.json` for frontend).
- Automated architecture guard test stub (AST scanner for domain neutrality).
- Verification & git commit.

### Phase 1: Core Deterministic Pricing Engine & Tests
- `engine/models.py`: Domain-agnostic dataclasses/Pydantic models.
- `engine/expressions.py`: AST safe expression evaluator (no `eval()`/`exec()`).
- `engine/guardrails.py`: Hard/soft floors and ceilings, margin checks.
- `engine/rounding.py`: Precision rules (`ROUND_HALF_UP`, nearest 0.05, 0.99, etc.).
- `engine/evaluator.py`: Ordered pipeline execution:
  `Base Price → Adjustments (Additive/Multiplicative) → Guardrails → Rounding → Waterfall Trace`.
- `engine/trace.py`: Waterfall step logging and SHA-256 decision hash.
- Unit tests & domain neutrality guard tests.

### Phase 2: Configuration Store, Domain Packs, Versioning & Linter
- Domain pack schema (JSON/YAML) and validators.
- Config store with versioning (Draft → Validated → Approved → Published) and rollback.
- SHA-256 cryptographically linked audit chain.
- Config linter: Detecting unreachable rules, overlapping conditions, circular references, contradictory guardrails.

### Phase 3: Backend REST APIs (`apps/api`)
- FastAPI application scaffolding with CORS and error handling.
- Endpoints:
  - `/api/pricing/evaluate`: Real-time single price evaluation with waterfall trace.
  - `/api/pricing/simulate`: Batch & what-if scenario execution.
  - `/api/domains`: Domain packs CRUD & industry import/export.
  - `/api/rules` & `/api/strategies`: Strategy draft & stage configuration.
  - `/api/governance`: Approval submissions, publishing, rollback, audit logs.
  - `/api/feed`: Real-time pricing & factor signal stream.
- In-memory/SQLite persistence with SQLAlchemy models.

### Phase 4: Seed Data & Golden Test Suite
- Five full Domain Packs: Hospitality, Travel, Banking (loans/rates), E-commerce, Ride-hailing.
- Sixth domain prepared for live demo: Cinema ticketing.
- Golden test fixtures with exact expected outputs and fixed random seeds.
- Automated tests verifying all 6 domains evaluate without modifying engine code.

### Phase 5: Design System & Web Application Shell
- Next.js App Router setup with Tailwind CSS, custom design tokens (`#F2F4F1`, `#FFFFFF`, `#13202C`, `#E59A00`, `#0E8F83`, `#2F5BEA`, `#D9453D`).
- Typography: IBM Plex Sans and IBM Plex Mono.
- Compact sidebar navigation: Home, Set Up, Build, Test, Go Live, Monitor, Understand.
- Visual components: Price Strip, Waterfall component, Tabular figures, Status badges.

### Phase 6: Home & New Industry Wizard
- Home screen with domain selector, active version badge, workflow progress bar (`Set up → Build → Test → Go live`).
- Contextual primary action ("Continue strategy →").
- Quick KPI health widget and recent decisions log.
- New Industry Wizard to onboard a new domain declaratively.

### Phase 7: Strategy Studio (Build Workbench)
- Strategy Studio layout:
  - Left: Stages (Base price, Demand, Customer, Time, Guardrails, Rounding).
  - Center: Natural-language sentence rule builder.
  - Right: Real-time price strip & waterfall preview (~600ms subtle animation).
- Contextual AI Copilot drawer (Ctrl+K).
- In-editor linter warnings.

### Phase 8: Simulation Lab
- Dedicated testing tabs: Single | What-if | Batch | Compare | Test Suite.
- What-if interactive sliders (demand index, inventory, competitor price, time).
- Version comparison diff (Draft vs Published).
- Golden test suite runner with pass/fail badges.

### Phase 9: Live Console & Explain ("Why this price?")
- Live Console: Streaming simulated feed, context signal tickers, feed controls, embedded API playground drawer.
- Deep Explain view:
  - Complete waterfall trace breakdown.
  - Driver contribution percentages.
  - Rules considered vs applied.
  - Guardrail floor/ceiling alerts.
  - Counterfactual explorer ("What if demand was 0.8 instead?").
  - Exact decision hash and replay verification.

### Phase 10: Governance, Approvals & Audit UI
- Go Live deployment workflow:
  `Validate (Schema + Linter) → Simulate (Regression) → Request Approval → Publish`.
- Version history with visual rule diffing and one-click rollback.
- Audit log timeline showing who changed what, timestamp, and SHA-256 hash.

### Phase 11: AI Copilot & Natural Language Parsing
- Server-side Gemini provider abstraction with `.env.local` support.
- Deterministic offline rule parser when no API key is present.
- Safe structured output validation with Pydantic.
- Safety invariant: Copilot strictly proposes drafts; cannot auto-publish.

### Phase 12: Performance & KPI Scorecard
- KPI scorecard view: Revenue lift, margin improvement, decision latency, volume.
- Load testing script (`scripts/load_test.py`) targeting sub-10ms evaluation.
- Honest labeling of measured vs demo data.

### Phase 13: 7-Minute Demo Script & Final Polish
- End-to-end 20-step demo verification.
- Comprehensive documentation (`API.md`, `DEMO.md`, `README.md`).
- Final visual polish, loading states, empty states, and accessibility checks.
