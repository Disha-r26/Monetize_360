# Monetize360 — Universal Dynamic Pricing Engine

AI-powered dynamic pricing engine for real-time, explainable, and rule-driven price optimization across industries.

Monetize360 is a domain-agnostic, deterministic dynamic pricing operations platform designed for revenue leaders across Hospitality, Travel, Banking, E-commerce, Ride-hailing, and on-demand ticketing/charging.

---

## Key Capabilities

1. **Domain-Agnostic Core Engine**: Zero hardcoded domain logic. All industry behaviors are 100% configuration-driven via declarative Domain Packs.
2. **Deterministic & Decimal-Accurate**: Floating-point drift eliminated. Every evaluation produces exact mathematical decimals and reproducible decision hashes.
3. **AST-Based Safe Expressions**: Safe math and logical evaluations with no unsafe code execution (`eval()` / `exec()` prohibited).
4. **Waterfall & Trace Transparency**: "Why this price?" shows full trace journey: Base price → Adjustments → Guardrails → Rounding.
5. **Safe Lifecycle & Governance**: Draft → Validate (Linter) → Simulate (Regression & What-if) → Approve → Publish with one-click Rollback.
6. **Server-Side AI Copilot**: Powered by Google Gemini with automatic fallback to a deterministic offline engine when running without an API key.

---

## Monorepo Layout

```
.
├── apps/
│   ├── web/          # Next.js App Router (TypeScript, Tailwind, Radix, Recharts)
│   └── api/          # FastAPI REST backend (SQLAlchemy 2, Pydantic v2)
├── engine/           # Pure Python domain-agnostic dynamic pricing engine
├── data/
│   ├── domains/      # Seeded Domain Packs (Hospitality, Travel, Banking, E-commerce, Ride-hailing, Cinema)
│   ├── synthetic/    # Deterministic seeded synthetic data
│   └── tests/        # Golden test suites and conflict cases
├── docs/             # Specs, Architecture, ADRs, and Demo Guide
└── scripts/          # Performance benchmark and simulation feeds
```

---

## Quickstart

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Environment Setup
Copy the template and configure your local environment:
```bash
cp .env.example .env.local
```
To enable Google Gemini for natural-language rule generation, add your API key in `.env.local`:
```
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Note: If left empty, Monetize360 automatically operates using its built-in offline rule engine).*

### 2. Backend & Engine Setup
```bash
pip install -r requirements.txt
python -m uvicorn apps.api.main:app --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd apps/web
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Verification & Architecture Tests

Monetize360 includes automated architectural guards to ensure zero domain-specific branches or keywords contaminate the core engine:

```bash
# Run architecture guards
pytest tests/test_architecture_guards.py -v

# Run engine tests
pytest engine/tests -v
```

---

## License
Proprietary & Confidential — Hackathon Demo Application.
>>>>>>> 9be9089 (feat(phase-0): scaffold project structure, conventions, architecture guards, and specs)
