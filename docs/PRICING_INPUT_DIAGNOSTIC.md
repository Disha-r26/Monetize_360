# Pricing Input Diagnostic

## Lead Days

- **frontend state**:
  - State variable: `factors["lead_days"]` inside the `factors` state dictionary (`Record<string, any>`).
  - Source file: `apps/web/src/app/page.tsx` (line 537).
  - Initialization: Populated on domain load from domain pack metadata (`data/domains/hospitality.json` line 38: `"default": 14`) inside `loadDomainDetail()` (`apps/web/src/app/page.tsx` line 614).

- **change handler**:
  - Component: HTML `<input type="range">` slider and preset buttons on the Home pricing workbench.
  - Source file: `apps/web/src/app/page.tsx` (lines 1403-1407 and 1424-1428).
  - Function: `onChange={(e) => { const updated = { ...factors, [f.name]: parseFloat(e.target.value) }; setFactors(updated); runEvaluation(updated, customRules); }}`.
  - When the slider is manipulated, the local `factors` state is updated and immediately passed to `runEvaluation(updated, customRules)`.

- **API request**:
  - Transport: HTTP `POST /api/pricing/evaluate`.
  - Next.js Proxy: Rewritten in `apps/web/next.config.js` from `http://localhost:3000/api/:path*` to `http://127.0.0.1:8000/api/:path*`.
  - Request Payload:
    ```json
    {
      "domain_id": "hospitality",
      "item_id": "room_deluxe",
      "factors": {
        "occupancy_rate": 0.75,
        "lead_days": 14,
        "loyalty_tier": "standard",
        "competitor_price": 195.0
      }
    }
    ```
  - State Inclusion: Confirmed. `lead_days` is serialized inside `factors` and transmitted across the wire on every input change.

- **backend field**:
  - Endpoint handler: `@app.post("/api/pricing/evaluate")` in `apps/api/main.py` (line 211).
  - Pydantic Request Model: `PricingEvaluationRequest` in `apps/api/main.py` (lines 46-50):
    ```python
    class PricingEvaluationRequest(BaseModel):
        domain_id: str
        item_id: str
        factors: Dict[str, Any] = Field(default_factory=dict)
        custom_rules: Optional[List[Rule]] = None
    ```
  - The value is received directly as `req.factors["lead_days"]`.

- **engine context**:
  - Context instantiation: `apps/api/main.py` (lines 226-231):
    ```python
    pricing_factors = dict(req.factors)
    context = PricingContext(item=item, factors=pricing_factors)
    ```
  - Engine evaluation: In `engine/evaluator.py` (lines 43-46), `PricingEngine.evaluate()` copies `context.factors` into `eval_ctx`.
  - Evaluator check: In `engine/evaluator.py` line 191 (`_conditions_match`), `field_val = ctx.get(cond.field)` resolves `field_val = ctx.get("lead_days")`.

- **active rules referencing it**:
  - Source file: `data/domains/hospitality.json` (lines 130-153).
  - Exactly **1** active rule references `lead_days`:
    - Rule ID: `hosp_last_minute`
    - Rule Name: `Last Minute Booking Discount`
    - Stage: `time`
    - Priority: `30`
    - Action: `type: "percentage", value: "-12"` (-12% discount)
    - Conditions (Compound):
      1. `{"field": "lead_days", "operator": "<=", "value": 2}`
      2. `{"field": "occupancy_rate", "operator": "<", "value": 0.6}`

- **controlled test results**:
  - Tested directly against the engine and API with `base_price = $180.00`:
    - Case 1: `occupancy_rate = 0.50`, `lead_days = 21` $\rightarrow$ Final Price: **$180.00** | Matched Rules: `[]` (Threshold `lead_days <= 2` not met)
    - Case 2: `occupancy_rate = 0.50`, `lead_days = 5`  $\rightarrow$ Final Price: **$180.00** | Matched Rules: `[]` (Threshold `lead_days <= 2` not met)
    - Case 3: `occupancy_rate = 0.50`, `lead_days = 2`  $\rightarrow$ Final Price: **$158.40** | Matched Rules: `['Last Minute Booking Discount']` (Discount: -$21.60)
    - Case 4: `occupancy_rate = 0.50`, `lead_days = 1`  $\rightarrow$ Final Price: **$158.40** | Matched Rules: `['Last Minute Booking Discount']` (Discount: -$21.60)
    - Case 5: `occupancy_rate = 0.75` (default), `lead_days = 1` $\rightarrow$ Final Price: **$198.00** | Matched Rules: `['Moderate Occupancy Uplift']` (Last minute discount does NOT apply because `occupancy_rate` 0.75 is not `< 0.6`)

- **root cause**:
  1. **UI Slider Minimum Range Defect**: In the original UI implementation, the slider minimum was computed as `min = Math.max(0, f.default * 0.5)`. Because `f.default = 14`, the minimum was clamped to `7`. The user was mathematically prevented by the UI slider from dragging `lead_days` below `7`, making it impossible to satisfy the rule condition `lead_days <= 2`.
  2. **Compound Condition Misunderstanding**: Even if `lead_days` was set to `1` or `2`, the rule requires both `lead_days <= 2` AND `occupancy_rate < 0.6`. With the default property occupancy rate at `0.75`, the second condition evaluated to `False`. Both conditions must be met for the price to drop.
  3. **Backend Coercion Defect**: In `engine/evaluator.py`, `_conditions_match()` previously had an `elif` structure that failed to convert `target_val` when `field_val` was numeric and threw `TypeError` when comparing stringified inputs to `Decimal`, causing silent 500 errors if string types were passed.

---

## Competitor Price

- **frontend state**:
  - State variable: `factors["competitor_price"]` inside the `factors` state dictionary.
  - Source file: `apps/web/src/app/page.tsx` (line 537).
  - Initialization: Populated on domain load from domain pack metadata (`data/domains/hospitality.json` line 50: `"default": 195.0`).

- **change handler**:
  - Component: HTML `<input type="range">` slider on the Home pricing workbench.
  - Source file: `apps/web/src/app/page.tsx` (lines 1403-1407).
  - Function: `onChange={(e) => { const updated = { ...factors, [f.name]: parseFloat(e.target.value) }; setFactors(updated); runEvaluation(updated, customRules); }}`.

- **API request**:
  - Transport: HTTP `POST /api/pricing/evaluate`.
  - Request Payload:
    ```json
    {
      "domain_id": "hospitality",
      "item_id": "room_deluxe",
      "factors": {
        "occupancy_rate": 0.75,
        "lead_days": 14,
        "loyalty_tier": "standard",
        "competitor_price": 250.0
      }
    }
    ```
  - State Inclusion: Confirmed. `competitor_price` changes in the request payload on every slider movement.

- **backend field**:
  - Endpoint handler: `@app.post("/api/pricing/evaluate")` in `apps/api/main.py`.
  - Pydantic Request Model: Received as `req.factors["competitor_price"]`.

- **engine context**:
  - Context instantiation: In `apps/api/main.py` line 228, stored inside `context.factors["competitor_price"]`.
  - Evaluator context: In `engine/evaluator.py` line 43, copied into `eval_ctx["competitor_price"]`.

- **active rules referencing it**:
  - Source file: `data/domains/hospitality.json` (lines 64-154).
  - **ZERO active rules reference `competitor_price`**.
  - All 4 active Hospitality rules evaluate only:
    1. `hosp_high_occupancy` $\rightarrow$ `occupancy_rate`
    2. `hosp_moderate_occupancy` $\rightarrow$ `occupancy_rate`
    3. `hosp_gold_loyalty` $\rightarrow$ `loyalty_tier`
    4. `hosp_last_minute` $\rightarrow$ `lead_days`, `occupancy_rate`

- **controlled test results**:
  - Tested directly against the engine with `base_price = $180.00`, `occupancy_rate = 0.75`, `lead_days = 14`:
    - `competitor_price = 100.0` $\rightarrow$ Final Price: **$198.00** | Matched Rules: `['Moderate Occupancy Uplift']`
    - `competitor_price = 195.0` $\rightarrow$ Final Price: **$198.00** | Matched Rules: `['Moderate Occupancy Uplift']`
    - `competitor_price = 450.0` $\rightarrow$ Final Price: **$198.00** | Matched Rules: `['Moderate Occupancy Uplift']`
  - In every test, `competitor_price` was present in the pricing context, but generated zero price adjustments.

- **root cause**:
  - **CASE 5**: "There is no active rule using the factor, so the price correctly does not change."
  - The entire data flow is functional from UI slider $\rightarrow$ network payload $\rightarrow$ FastAPI backend $\rightarrow$ `PricingContext` $\rightarrow$ engine `eval_ctx`.
  - However, no rule in the active strategy config references `competitor_price`. The factor exists as an available market intelligence signal, not an evaluated condition.
  - The issue was a **UX transparency problem**: the UI previously presented `competitor_price` identically to active rules-linked factors without communicating that no rule was configured to consume it.

---

## Occupancy Control Test

- **results**:
  - Evaluated on Deluxe King Room (Base: `$180.00`):
    - `occupancy_rate = 0.50`: Final Price: **$180.00** | Matched Rules: `[]` (Baseline rate)
    - `occupancy_rate = 0.70`: Final Price: **$198.00** | Matched Rules: `['Moderate Occupancy Uplift']` (+10% dynamic uplift)
    - `occupancy_rate = 0.85`: Final Price: **$225.00** | Matched Rules: `['High Occupancy Surge']` (+25% dynamic surge)

- **comparison**:
  - **Data Path Comparison**: `occupancy_rate`, `lead_days`, and `competitor_price` travel through the identical React state pipeline, identical network request serialization (`req.factors`), and identical engine context dictionary (`eval_ctx`).
  - **Why Occupancy Changes Price**: Both `hosp_high_occupancy` (`occupancy_rate >= 0.8`) and `hosp_moderate_occupancy` (`occupancy_rate >= 0.65` AND `occupancy_rate < 0.8`) evaluate `occupancy_rate`. At default `0.75`, the moderate rule is triggered (+10% $\rightarrow$ $198.00). Sliding above `0.80` triggers high surge (+25% $\rightarrow$ $225.00). Sliding below `0.65` deactivates both rules (returning to $180.00).
  - **Why Lead Days Did Not Change Price**: `lead_days` has an active rule (`hosp_last_minute`), but that rule requires `lead_days <= 2` AND `occupancy_rate < 0.6`. The UI slider could not go below 7, and default occupancy was 0.75.
  - **Why Competitor Price Did Not Change Price**: `competitor_price` has 0 active rules configured in the strategy.

---

## Final Diagnosis

### Classification of the Issue:
1. **For `competitor_price`**:
   - **CASE 5**: "There is no active rule using the factor, so the price correctly does not change."
   - There is **NO backend or engine bug** for `competitor_price`. The engine faithfully evaluates all active strategy rules. Because the business configuration of Hospitality v1.4.0/v1.7.0 contains no rule on competitor rates, the price remains unchanged.
   - The UX defect was an absence of status indicators differentiating active rule drivers from contextual market signals.

2. **For `lead_days`**:
   - **Combination of CASE 3 & UI Slider Defect**:
     - The value reaches the engine and the rule is loaded, but the condition was not met because the frontend slider formula `min = f.default * 0.5` mathematically prevented dragging `lead_days` below `7` (while the rule requires `lead_days <= 2`).
     - Furthermore, the rule `hosp_last_minute` is a compound rule that also requires `occupancy_rate < 0.6`. When testing `lead_days` while leaving `occupancy_rate` at default `0.75`, the condition is mathematically false.
   - **Backend Engine Type Coercion Bug**:
     - In `engine/evaluator.py`, `_conditions_match()` previously used `elif isinstance(target_val, (int, float))` which skipped converting `target_val` when `field_val` was numeric, and threw a `TypeError` when comparing stringified numbers with `Decimal`.

### Summary of Inspected Files:
1. `data/domains/hospitality.json`: Current domain configuration and strategy rules.
2. `apps/web/src/app/page.tsx`: Frontend factors state, slider input range calculations, and API evaluation triggers.
3. `apps/api/main.py`: REST endpoint routing, request models (`PricingEvaluationRequest`), and engine context creation.
4. `engine/evaluator.py`: Deterministic pricing evaluator, `_conditions_match()` operator logic, and trace generation.
5. `engine/models.py`: Data models for `PricingContext`, `Condition`, `Rule`, and `ComparisonOperator`.
