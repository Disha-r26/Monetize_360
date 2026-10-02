# Monetize360 Universal Dynamic Pricing Engine
## Master Specification & Project Brief

### 1. Executive Summary
Monetize360 is an enterprise-grade, domain-agnostic dynamic pricing operating system. It enables non-technical revenue and pricing managers to configure, simulate, test, govern, publish, and audit real-time pricing strategies across diverse industries—including Hospitality, Travel, Banking, E-commerce, Ride-hailing, and on-demand services (Cinema/EV Charging)—without writing custom code or domain-specific engine logic.

---

### 2. Core Architectural Principles & Invariants

1. **Domain-Agnostic Pricing Engine**:
   - The pricing engine (`engine/`) is a pure Python package with zero domain-specific branches (e.g., `if domain == "hotel"` is strictly forbidden and guarded by automated tests).
   - All industry logic resides exclusively in declarative Domain Packs (`data/domains/`).
   - The engine has zero web framework and zero database dependencies.

2. **Strict Decimal Arithmetic**:
   - All monetary amounts, rates, adjustments, and percentages are computed exclusively using Python `Decimal` / precision-safe types. Floating-point arithmetic for money is prohibited.

3. **Deterministic & Reproducible Evaluation**:
   - Given identical inputs, factor signals, and configuration, the engine produces identical output and an identical decision hash (`sha256` or equivalent).
   - Synthetic data generation uses fixed, deterministic random seeds.

4. **Whitelisted Safe Expression Grammar**:
   - No dynamic code execution (`eval()` or `exec()`).
   - Expressions are parsed and evaluated via an AST-based safe expression evaluator supporting arithmetic, comparison, logical operators, math functions (`min`, `max`, `abs`, `round`), and factor lookups.

5. **ML as Context Signals Only**:
   - Machine learning models may supply context signals (e.g., predicted demand index, competitor trend, anomaly score) recorded in the trace, but ML models never directly make non-deterministic pricing decisions.

6. **Authentic Trace-Based Explanations**:
   - Explanations ("Why this price?") originate strictly from the actual evaluation execution trace (waterfall steps, rules triggered, conditions met, guardrails applied). No post-hoc fabricated numbers.

7. **Strict Safe Lifecycle & Governance**:
   - Workflow: `Draft → Validate (Linter & Schema) → Simulate (Regression & Impact) → Approve → Publish → Monitor (Rollback capability)`.
   - Draft configurations never affect live pricing until published.
   - Cryptographically linked or immutable audit logs track all changes and authorship.

8. **Secure Server-Side AI Copilot**:
   - Supports Google Gemini via `GEMINI_API_KEY` (configured locally in `.env.local` or environment).
   - Pure server-side integration; the browser never receives API keys.
   - Provider abstraction with deterministic offline fallback when no API key is provided.
   - Schema-constrained JSON outputs validated with Pydantic/Zod.
   - AI Copilot strictly proposes drafts; it cannot auto-publish or bypass approval.

---

### 3. System Architecture & Tech Stack

```
monetize360/
├── apps/
│   ├── web/                     # Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Recharts
│   └── api/                     # FastAPI, Python 3.11+, Pydantic v2, SQLAlchemy 2, Alembic
├── engine/                      # Domain-agnostic pure Python pricing engine (Decimal, AST evaluator)
├── data/
│   ├── domains/                 # Domain Packs (Hospitality, Travel, Banking, E-commerce, Ride-hailing, Cinema)
│   ├── synthetic/               # Seeded synthetic datasets & feed generators
│   └── tests/                   # Golden test cases, conflict cases, natural language / config pairs
├── docs/                        # Architecture, ADRs, Research, API, Demo, Progress, Decisions
├── scripts/                     # Load testing, feed simulators, verification scripts
├── docker-compose.yml
├── Makefile
├── .env.example
├── .gitignore
└── README.md
```

#### Frontend Stack
- **Framework**: Next.js 14+ (App Router), React 18+
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design tokens
- **Components**: Radix UI / shadcn/ui patterns, Lucide icons
- **Visualization**: Recharts (price waterfall, simulation curves, KPIs)
- **State & Data**: TanStack Query, React Hook Form, Zod
- **Typography**: IBM Plex Sans (UI) & IBM Plex Mono (Formulas, IDs, JSON)

#### Backend Stack
- **Framework**: FastAPI (Python 3.11+)
- **Validation**: Pydantic v2
- **Persistence**: SQLAlchemy 2 + Alembic (SQLite default, PostgreSQL ready via docker-compose)
- **Engine Binding**: Direct in-process import of `engine/` package

---

### 4. Design System Tokens & Visual Signature

| Token | Hex Code | Semantic Role |
| :--- | :--- | :--- |
| **Ledger** | `#F2F4F1` | Background canvas, calm contrast |
| **Paper** | `#FFFFFF` | Card surfaces, modals, workbench panes |
| **Ink** | `#13202C` | Primary typography, crisp readability |
| **Marigold**| `#E59A00` | Warning, pending approval, highlight |
| **Lagoon**  | `#0E8F83` | Success, published active state, positive driver |
| **Cobalt**  | `#2F5BEA` | Primary actions, links, focus states |
| **Coral**   | `#D9453D` | Errors, guardrail triggers, negative driver |

- **Visual Signature**:
  - **Price Strip + Waterfall**: Every meaningful price presents the journey:
    `Base Price → Adjustments → Uplifts/Discounts → Guardrails (Floors/Ceilings) → Rounding → Final Price`.
  - Subtle recalculation animation (~600ms) with tabular numbers.
  - Sentence case UI, no generic SaaS purple gradients or decorative clutter.

---

### 5. Navigation & Information Architecture

Designed around the pricing manager forward workflow:

- **WORKSPACE**
  - **Home**: Domain overview, active version, setup/build/test/publish progress, KPI health snippet, recent decisions, primary contextual action.
- **1. SET UP**
  - **Items**: Item inventory, base rates, unit definitions.
  - **Factors**: Input signals, demand metrics, context definitions, competitor signals.
- **2. BUILD**
  - **Strategy**: Strategy Studio workbench:
    - Left: Stages (Base price, Demand, Customer, Time, Guardrails, Rounding).
    - Center: Rule builder (natural-language sentence structure, safe expression editor).
    - Right: Real-time price strip & waterfall preview.
    - Contextual Drawer: AI Copilot (Ctrl+K).
- **3. TEST**
  - **Simulation**: Single test (default), What-If analysis, Batch evaluation, Version comparison, Golden test suite.
- **4. GO LIVE**
  - **Publish & Versions**: Validation checklist (Schema, Linter, Regression), Approval request, Version history, Rollback, Diff viewer.
- **5. MONITOR**
  - **Live Console**: Live pricing feed, real-time context signals, feed controls, embedded API playground.
- **UNDERSTAND**
  - **Explain**: Deep-dive trace inspector ("Why this price?"), counterfactual explorer, replay with hash verification.
  - **Audit**: Immutable change log, approval trail, tamper verification.

---

### 6. Domain Packs

All domain specifications are 100% configuration-driven:

1. **Hospitality**: Hotel rooms, occupancy surge, length-of-stay discount, seasonal uplift, cancellation flexibility.
2. **Travel**: Flight seats, departure lead-time curve, capacity tiers, route demand.
3. **Banking**: Personal/auto loan interest rates, risk tiers, LTV ratios, prime rate offset, monthly payment output.
4. **E-Commerce**: Retail goods, inventory velocity, competitor price match, cart value tier.
5. **Ride-Hailing**: Trips, base fare + distance + duration, real-time surge multiplier, driver supply ratio.
6. **Live Demo Domain (6th)**: Cinema tickets or EV charging station kW/h pricing loaded on-the-fly without engine changes.

---

### 7. Implementation Roadmap & Phases

- **Phase 0**: Scaffold and conventions, git setup, environment configs, base structure, dependencies.
- **Phase 1**: Core deterministic pricing engine (`engine/`), Decimal math, AST safe expression evaluator, rule pipeline, waterfall trace, unit tests.
- **Phase 2**: Configuration store, Domain Pack YAML/JSON schema, versioning, publish/rollback logic, SHA-256 audit chain, linter.
- **Phase 3**: FastAPI service (`apps/api`), REST endpoints for pricing, simulation, governance, live feed, context signals.
- **Phase 4**: Seed data for 5 domains + 6th demo domain, golden test suite, conflict scenarios, natural-language rule mappings.
- **Phase 5**: Frontend design system tokens, Tailwind setup, layout shell, sidebar navigation, responsive frame.
- **Phase 6**: Home screen, onboarding progress bar, New Industry Wizard.
- **Phase 7**: Strategy Studio (Build workbench, natural-language rule editor, live waterfall preview).
- **Phase 8**: Simulation Lab (Single, What-if sliders, Batch, Compare, Test suite runner).
- **Phase 9**: Live Console (Streaming price feed, context signals, simulator controls) & Explain modal/page ("Why this price?").
- **Phase 10**: Governance UI (Approval workflow, version history, visual diff, instant rollback, audit chain inspector).
- **Phase 11**: AI Copilot (Gemini API server-side provider + offline fallback, natural-language to rule parser).
- **Phase 12**: Performance optimizations, KPI scorecard (revenue lift, margin, volume), load test suite (<10ms target).
- **Phase 13**: 7-Minute demo script verification, documentation, final polish.
