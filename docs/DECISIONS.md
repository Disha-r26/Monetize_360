# Architectural Decision Records (ADRs) & Log

## Log of Implementation Decisions

### ADR-001: Monorepo Project Layout & Isolation
- **Context**: The application requires a full-stack demo with a pure domain-agnostic pricing engine, FastAPI backend, Next.js frontend, and declarative domain packs.
- **Decision**: Standardize on a clear root directory structure:
  - `apps/web`: Next.js 14+ App Router, Tailwind CSS, TypeScript
  - `apps/api`: FastAPI backend with SQLAlchemy and Pydantic v2
  - `engine`: Pure, isolated Python pricing package
  - `data/domains`: Declarative JSON/YAML domain packs
  - `docs`: Living documentation and specifications
  - `scripts`: Utilities for testing, simulation, and verification
- **Status**: Accepted

### ADR-002: Pure Python Engine with Zero Domain Logic
- **Context**: Rule #4 and Rule #5 require that the pricing engine remains 100% domain agnostic with no domain branches (`if domain == "hotel"` etc.) and zero web/db dependencies.
- **Decision**: The `engine/` package operates solely on generic abstractions: `Item`, `Factor`, `Stage`, `Rule`, `Condition`, `Action`, `Guardrail`, and `RoundingRule`. Automated architectural tests will scan `engine/` source code to guarantee zero domain keywords appear.
- **Status**: Accepted

### ADR-003: Safe Expression Evaluator via AST Parsing
- **Context**: Pricing adjustments require mathematical expressions and factor lookups, but `eval()` and `exec()` pose critical security risks and violate Rule #8.
- **Decision**: Implement a custom AST visitor (`engine/expressions.py`) that strictly permits a whitelist of AST nodes (`BinOp`, `UnaryOp`, `Compare`, `Name`, `Constant`, `Call` for whitelisted functions `min`, `max`, `abs`, `round`). Any syntax or function outside the whitelist raises `ExpressionSecurityError`.
- **Status**: Accepted

### ADR-004: Strict Decimal Arithmetic for Money & Rates
- **Context**: Floating point imprecision causes rounding drift and non-deterministic results in financial calculations (Rule #6 & Rule #7).
- **Decision**: All money, multipliers, percentages, and outputs in `engine/` and `apps/api` use Python's `Decimal` type. Final values are rounded according to domain pack rounding policies using explicit `ROUND_HALF_UP` / `ROUND_HALF_EVEN`.
- **Status**: Accepted

### ADR-005: Server-Side Gemini Provider with Deterministic Offline Fallback
- **Context**: The application needs Gemini AI copilot capabilities, but must remain fully functional offline without an API key, and must never expose keys to the frontend (Rule #14 & Copilot requirements).
- **Decision**: Implement a server-side `GeminiCopilotProvider` that checks `GEMINI_API_KEY`. If unset, it falls back to a deterministic rule-based NLP matcher (`OfflineCopilotProvider`). In either case, outputs are validated against strict Pydantic schemas before being returned as proposed drafts.
- **Status**: Accepted

### ADR-006: Local Git Setup & Airtight `.gitignore` in User Directory
- **Context**: The workspace root is the user profile directory (`C:\Users\Disha R`).
- **Decision**: Portable MinGit is configured locally. `.gitignore` strictly ignores all user profile directories and Windows junction points while tracking only the project code and documentation.
- **Status**: Accepted
