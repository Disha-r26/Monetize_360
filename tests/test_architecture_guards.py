"""
Automated Architecture Guards for Monetize360.
Guarantees:
1. engine/ contains zero domain-specific branches or domain-specific terminology.
2. engine/ contains zero web framework or database imports.
"""

import os
import ast
import re
import pytest

FORBIDDEN_DOMAIN_KEYWORDS = [
    "hotel", "hospitality", "occupancy", "room_type", "nights", "revpar",
    "airline", "flight", "seat_class", "departure",
    "loan", "banking", "borrower", "credit_score", "mortgage", "apr",
    "ecommerce", "e-commerce", "shopping_cart", "cart_total",
    "ride_hailing", "ridehailing", "uber", "driver", "passenger", "pickup", "dropoff",
    "cinema", "movie", "theater", "screening",
    "ev_charging", "kwh", "charging_station"
]

FORBIDDEN_IMPORTS = [
    "fastapi", "flask", "django", "starlette",
    "sqlalchemy", "alembic", "sqlmodel", "tortoise",
    "httpx", "requests", "aiohttp", "urllib"
]

FORBIDDEN_BRANCH_PATTERNS = [
    r'if\s+.*domain\s*==',
    r'if\s+.*industry\s*==',
    r'if\s+.*domain\s+in\s+',
    r'match\s+.*domain:',
]

ENGINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "engine"))


def test_engine_has_no_web_or_db_imports():
    """Verify that engine/ never imports web or database libraries."""
    for root, _, files in os.walk(ENGINE_DIR):
        if "tests" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                tree = ast.parse(content, filename=file_path)
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            root_pkg = alias.name.split(".")[0]
                            assert root_pkg not in FORBIDDEN_IMPORTS, (
                                f"Forbidden web/db import '{root_pkg}' found in {file_path}"
                            )
                    elif isinstance(node, ast.ImportFrom):
                        if node.module:
                            root_pkg = node.module.split(".")[0]
                            assert root_pkg not in FORBIDDEN_IMPORTS, (
                                f"Forbidden web/db import '{root_pkg}' found in {file_path}"
                            )


def test_engine_has_no_domain_specific_branches():
    """Verify that engine/ contains no domain-specific conditional branches."""
    for root, _, files in os.walk(ENGINE_DIR):
        if "tests" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()

                for line_idx, line in enumerate(lines, 1):
                    # Ignore pure comment lines
                    stripped = line.strip()
                    if stripped.startswith("#"):
                        continue

                    for pattern in FORBIDDEN_BRANCH_PATTERNS:
                        assert not re.search(pattern, line, re.IGNORECASE), (
                            f"Domain-specific branch detected at {file_path}:{line_idx}: {line.strip()}"
                        )


def test_engine_has_no_domain_specific_keywords_in_logic():
    """Verify that engine/ logic does not mention industry specific terminology."""
    for root, _, files in os.walk(ENGINE_DIR):
        if "tests" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()

                for line_idx, line in enumerate(lines, 1):
                    # Ignore comment lines and docstrings markers
                    stripped = line.strip()
                    if stripped.startswith("#") or stripped.startswith('"""') or stripped.startswith("'''"):
                        continue

                    for kw in FORBIDDEN_DOMAIN_KEYWORDS:
                        # Match whole word
                        match = re.search(r'\b' + re.escape(kw) + r'\b', line, re.IGNORECASE)
                        assert not match, (
                            f"Domain keyword '{kw}' found in core engine logic at {file_path}:{line_idx}: {line.strip()}"
                        )


def test_load_and_price_all_domain_packs_without_engine_changes():
    """
    Verification requirement: Load arbitrary Domain Packs without changing engine code
    and successfully price them deterministically.
    """
    import json
    from engine.models import Item, PricingContext, StrategyConfig
    from engine.evaluator import PricingEngine

    domains_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "domains"))
    domain_files = [f for f in os.listdir(domains_dir) if f.endswith(".json")]
    assert len(domain_files) >= 5, "At least 5 domain packs must be seeded"

    engine = PricingEngine()

    for df in domain_files:
        path = os.path.join(domains_dir, df)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        strategy = StrategyConfig(**data["strategy"])
        factors = {fact["name"]: fact["default"] for fact in data["factors"]}

        for item_data in data["items"]:
            item = Item(**item_data)
            context = PricingContext(item=item, factors=factors)
            trace = engine.evaluate(context, strategy)

            assert trace.final_price is not None
            assert trace.decision_hash is not None
            assert len(trace.decision_hash) == 64
            assert len(trace.steps) >= 1

