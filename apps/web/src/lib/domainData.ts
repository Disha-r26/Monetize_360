/**
 * Embedded default domain definitions for Monetize360.
 * Allows the frontend to run resiliently on Vercel standalone preview/production
 * without requiring an external database or network dependency.
 */

export const DEFAULT_DOMAINS: Record<string, any> = {
  "banking": {
    "id": "banking",
    "name": "Banking",
    "description": "Personal & auto loans, risk score tiers, loan-to-value offsets, prime rate spreads, and APR.",
    "unit": "% APR",
    "items": [
      {
        "id": "loan_personal",
        "name": "Unsecured Personal Term Loan (36mo)",
        "base_price": "5.50",
        "unit": "% APR",
        "attributes": {
          "term_months": 36,
          "secured": false
        }
      },
      {
        "id": "loan_auto",
        "name": "New Vehicle Auto Loan (60mo)",
        "base_price": "4.25",
        "unit": "% APR",
        "attributes": {
          "term_months": 60,
          "secured": true
        }
      }
    ],
    "factors": [
      {
        "name": "credit_tier",
        "type": "string",
        "default": "prime",
        "description": "Applicant credit score tier (super_prime, prime, near_prime, subprime)"
      },
      {
        "name": "ltv_ratio",
        "type": "number",
        "default": 0.8,
        "description": "Loan-to-value collateral coverage (0.0 to 1.5)"
      },
      {
        "name": "central_bank_prime",
        "type": "number",
        "default": 3.75,
        "description": "Underlying benchmark prime interest rate"
      }
    ],
    "strategy": {
      "domain_id": "banking",
      "version": "1.0.0",
      "stages": [
        "customer",
        "adjustments",
        "guardrails",
        "rounding"
      ],
      "rules": [
        {
          "id": "bank_subprime_risk",
          "name": "Subprime Risk Premium",
          "stage": "customer",
          "description": "Subprime applicants require +4.25% risk offset spread",
          "conditions": [
            {
              "field": "credit_tier",
              "operator": "==",
              "value": "subprime"
            }
          ],
          "action": {
            "type": "additive",
            "value": "4.25"
          },
          "priority": 10,
          "enabled": true
        },
        {
          "id": "bank_super_prime_discount",
          "name": "Super Prime Preferred Rate",
          "stage": "customer",
          "description": "Super prime tier receives 0.75% rate discount",
          "conditions": [
            {
              "field": "credit_tier",
              "operator": "==",
              "value": "super_prime"
            }
          ],
          "action": {
            "type": "additive",
            "value": "-0.75"
          },
          "priority": 15,
          "enabled": true
        },
        {
          "id": "bank_high_ltv",
          "name": "High LTV Collateral Spread",
          "stage": "adjustments",
          "description": "If LTV ratio exceeds 90%, add 0.50% risk margin",
          "conditions": [
            {
              "field": "ltv_ratio",
              "operator": ">=",
              "value": 0.9
            }
          ],
          "action": {
            "type": "additive",
            "value": "0.50"
          },
          "priority": 25,
          "enabled": true
        }
      ],
      "guardrails": [
        {
          "id": "bank_usury_ceiling",
          "name": "Regulatory Rate Cap",
          "type": "ceiling",
          "value": "24.99",
          "hard": true,
          "enabled": true
        },
        {
          "id": "bank_cost_of_funds_floor",
          "name": "Cost of Funds Floor",
          "type": "floor",
          "value": "3.50",
          "hard": true,
          "enabled": true
        }
      ],
      "rounding": {
        "method": "half_up",
        "decimals": 2
      }
    }
  },
  "cinema": {
    "id": "cinema",
    "name": "Cinema & Entertainment",
    "description": "Theatrical tickets, blockbuster opening weekend surge, matinee discounts, and auditorium capacity tiers.",
    "unit": "$",
    "items": [
      {
        "id": "ticket_imax",
        "name": "IMAX 70mm Reserved Ticket",
        "base_price": "21.50",
        "unit": "$",
        "attributes": {
          "screen_format": "imax",
          "is_opening_weekend": true
        }
      },
      {
        "id": "ticket_standard",
        "name": "Standard Digital Cinema Ticket",
        "base_price": "14.50",
        "unit": "$",
        "attributes": {
          "screen_format": "standard",
          "is_opening_weekend": false
        }
      },
      {
        "id": "item_1791112517672",
        "name": "LUXURY",
        "base_price": "100.00",
        "unit": "$",
        "attributes": {}
      }
    ],
    "factors": [
      {
        "name": "seats_sold_pct",
        "type": "number",
        "default": 0.88,
        "description": "Auditorium sellout percentage (0.0 to 1.0)"
      },
      {
        "name": "is_matinee",
        "type": "boolean",
        "default": false,
        "description": "Whether showtime is prior to 4:00 PM"
      },
      {
        "name": "popcorn_bundle",
        "type": "boolean",
        "default": false,
        "description": "Concession pre-purchase addon included"
      }
    ],
    "strategy": {
      "domain_id": "cinema",
      "version": "1.0.0",
      "stages": [
        "demand",
        "time",
        "adjustments",
        "guardrails",
        "rounding"
      ],
      "rules": [
        {
          "id": "cinema_soldout_rush",
          "name": "High Sellout Velocity",
          "stage": "demand",
          "description": "When auditorium is > 85% full, add $3.00 peak rush surcharge",
          "conditions": [
            {
              "field": "seats_sold_pct",
              "operator": ">=",
              "value": 0.85
            }
          ],
          "action": {
            "type": "additive",
            "value": "3.00"
          },
          "priority": 10,
          "enabled": true
        },
        {
          "id": "cinema_matinee_deal",
          "name": "Early Matinee Incentive",
          "stage": "time",
          "description": "Matinee showtimes receive 20% discount",
          "conditions": [
            {
              "field": "is_matinee",
              "operator": "==",
              "value": true
            }
          ],
          "action": {
            "type": "percentage",
            "value": "-20"
          },
          "priority": 15,
          "enabled": true
        }
      ],
      "guardrails": [
        {
          "id": "cinema_min_boxoffice",
          "name": "Distributor Minimum Guarantee",
          "type": "floor",
          "value": "8.50",
          "hard": true,
          "enabled": true
        }
      ],
      "rounding": {
        "method": "nearest_point_99",
        "decimals": 2
      }
    }
  },
  "ecommerce": {
    "id": "ecommerce",
    "name": "E-Commerce",
    "description": "Retail merchandise, stock velocity, competitor price match, and cart quantity incentives.",
    "unit": "$",
    "items": [
      {
        "id": "item_headphones",
        "name": "Noise Cancelling Wireless Headphones",
        "base_price": "149.99",
        "unit": "$",
        "attributes": {
          "category": "electronics",
          "stock_units": 45
        }
      },
      {
        "id": "item_smartwatch",
        "name": "GPS Fitness Smartwatch",
        "base_price": "249.99",
        "unit": "$",
        "attributes": {
          "category": "electronics",
          "stock_units": 8
        }
      }
    ],
    "factors": [
      {
        "name": "stock_velocity",
        "type": "number",
        "default": 2.4,
        "description": "Units sold per hour"
      },
      {
        "name": "competitor_min_price",
        "type": "number",
        "default": 139.99,
        "description": "Lowest scraped competitor market price"
      },
      {
        "name": "cart_total",
        "type": "number",
        "default": 85.0,
        "description": "Total user cart value prior to item"
      }
    ],
    "strategy": {
      "domain_id": "ecommerce",
      "version": "1.0.0",
      "stages": [
        "demand",
        "customer",
        "guardrails",
        "rounding"
      ],
      "rules": [
        {
          "id": "ecom_scarcity_uplift",
          "name": "Low Stock Scarcity Premium",
          "stage": "demand",
          "description": "If stock units <= 10 and velocity >= 2.0, increase price by 8%",
          "conditions": [
            {
              "field": "stock_units",
              "operator": "<=",
              "value": 10
            },
            {
              "field": "stock_velocity",
              "operator": ">=",
              "value": 2.0
            }
          ],
          "action": {
            "type": "percentage",
            "value": "8"
          },
          "priority": 10,
          "enabled": true
        },
        {
          "id": "ecom_cart_bonus",
          "name": "High Value Cart Incentive",
          "stage": "customer",
          "description": "If current cart exceeds $100, provide $10 discount",
          "conditions": [
            {
              "field": "cart_total",
              "operator": ">=",
              "value": 100.0
            }
          ],
          "action": {
            "type": "additive",
            "value": "-10.00"
          },
          "priority": 20,
          "enabled": true
        }
      ],
      "guardrails": [
        {
          "id": "ecom_cogs_floor",
          "name": "COGS Margin Floor",
          "type": "floor",
          "value": "95.00",
          "hard": true,
          "enabled": true
        }
      ],
      "rounding": {
        "method": "nearest_point_99",
        "decimals": 2
      }
    }
  },
  "hospitality": {
    "id": "hospitality",
    "name": "Hospitality",
    "description": "Hotel rooms, occupancy surge, length of stay discounts, and seasonal uplifts.",
    "unit": "$",
    "items": [
      {
        "id": "room_deluxe",
        "name": "Deluxe King Room",
        "base_price": "180.00",
        "unit": "$",
        "attributes": {
          "category": "premium",
          "max_occupancy": 2
        }
      },
      {
        "id": "room_suite",
        "name": "Executive Suite",
        "base_price": "320.00",
        "unit": "$",
        "attributes": {
          "category": "luxury",
          "max_occupancy": 4
        }
      }
    ],
    "factors": [
      {
        "name": "occupancy_rate",
        "type": "number",
        "default": 0.75,
        "description": "Current property occupancy ratio (0.0 to 1.0)"
      },
      {
        "name": "lead_days",
        "type": "number",
        "default": 14,
        "description": "Days remaining until check-in"
      },
      {
        "name": "loyalty_tier",
        "type": "string",
        "default": "standard",
        "description": "Customer membership tier (standard, silver, gold, platinum)"
      },
      {
        "name": "competitor_price",
        "type": "number",
        "default": 195.0,
        "description": "Average nearby 4-star room rate"
      }
    ],
    "strategy": {
      "domain_id": "hospitality",
      "version": "1.17.0",
      "stages": [
        "demand",
        "customer",
        "time",
        "guardrails",
        "rounding"
      ],
      "rules": [
        {
          "id": "hosp_high_occupancy",
          "name": "High Occupancy Surge",
          "stage": "demand",
          "description": "When occupancy exceeds 80%, increase price by 25%",
          "conditions": [
            {
              "field": "occupancy_rate",
              "operator": ">=",
              "value": 0.8
            }
          ],
          "action": {
            "type": "percentage",
            "value": "25"
          },
          "priority": 10,
          "enabled": true
        },
        {
          "id": "hosp_moderate_occupancy",
          "name": "Moderate Occupancy Uplift",
          "stage": "demand",
          "description": "When occupancy is between 65% and 80%, increase price by 10%",
          "conditions": [
            {
              "field": "occupancy_rate",
              "operator": ">=",
              "value": 0.65
            },
            {
              "field": "occupancy_rate",
              "operator": "<",
              "value": 0.8
            }
          ],
          "action": {
            "type": "percentage",
            "value": "10"
          },
          "priority": 15,
          "enabled": true
        },
        {
          "id": "hosp_comp_high",
          "name": "High Competitor Price",
          "stage": "demand",
          "description": "When competitor price exceeds $250, increase price by 10%",
          "conditions": [
            {
              "field": "competitor_price",
              "operator": ">",
              "value": 250
            }
          ],
          "action": {
            "type": "percentage",
            "value": "10"
          },
          "priority": 18,
          "enabled": true
        },
        {
          "id": "hosp_comp_low",
          "name": "Low Competitor Price",
          "stage": "demand",
          "description": "When competitor price is below $150, decrease price by 5%",
          "conditions": [
            {
              "field": "competitor_price",
              "operator": "<",
              "value": 150
            }
          ],
          "action": {
            "type": "percentage",
            "value": "-5"
          },
          "priority": 19,
          "enabled": true
        },
        {
          "id": "hosp_gold_loyalty",
          "name": "Gold Member Privilege",
          "stage": "customer",
          "description": "Gold and Platinum loyalty members receive a $15 discount",
          "conditions": [
            {
              "field": "loyalty_tier",
              "operator": "in",
              "value": [
                "gold",
                "platinum"
              ]
            }
          ],
          "action": {
            "type": "additive",
            "value": "-15.00"
          },
          "priority": 20,
          "enabled": true
        },
        {
          "id": "hosp_last_minute",
          "name": "Last Minute Booking Discount",
          "stage": "time",
          "description": "If booking within 2 days and occupancy < 60%, discount by 12%",
          "conditions": [
            {
              "field": "lead_days",
              "operator": "<=",
              "value": 2
            },
            {
              "field": "occupancy_rate",
              "operator": "<",
              "value": 0.6
            }
          ],
          "action": {
            "type": "percentage",
            "value": "-12"
          },
          "priority": 30,
          "enabled": true
        },
        {
          "id": "hosp_advance_booking",
          "name": "Advance Booking Discount",
          "stage": "time",
          "description": "When booking 21 or more days in advance, decrease price by 5%",
          "conditions": [
            {
              "field": "lead_days",
              "operator": ">=",
              "value": 21
            }
          ],
          "action": {
            "type": "percentage",
            "value": "-5"
          },
          "priority": 35,
          "enabled": true
        },
        {
          "id": "hosp_early_booking",
          "name": "Early Booking Discount",
          "stage": "time",
          "description": "When booking 14 to 20 days in advance, decrease price by 3%",
          "conditions": [
            {
              "field": "lead_days",
              "operator": ">=",
              "value": 14
            },
            {
              "field": "lead_days",
              "operator": "<",
              "value": 21
            }
          ],
          "action": {
            "type": "percentage",
            "value": "-3"
          },
          "priority": 36,
          "enabled": true
        }
      ],
      "guardrails": [
        {
          "id": "hosp_floor",
          "name": "Housekeeping Cost Floor",
          "type": "floor",
          "value": "90.00",
          "hard": true,
          "enabled": true
        },
        {
          "id": "hosp_ceiling",
          "name": "Maximum ADR Ceiling",
          "type": "ceiling",
          "value": "450.00",
          "hard": true,
          "enabled": true
        }
      ],
      "rounding": {
        "method": "half_up",
        "decimals": 2
      }
    }
  },
  "ridehailing": {
    "id": "ridehailing",
    "name": "Ride-Hailing",
    "description": "On-demand mobility, distance-time base rates, real-time surge multipliers, and supply elasticity.",
    "unit": "$",
    "items": [
      {
        "id": "ride_standard",
        "name": "City Standard Sedan (5 miles)",
        "base_price": "14.50",
        "unit": "$",
        "attributes": {
          "vehicle_class": "standard",
          "distance_miles": 5.0,
          "est_minutes": 15
        }
      },
      {
        "id": "ride_xl",
        "name": "Premium SUV (5 miles)",
        "base_price": "26.00",
        "unit": "$",
        "attributes": {
          "vehicle_class": "xl",
          "distance_miles": 5.0,
          "est_minutes": 15
        }
      },
      {
        "id": "item_1791112781851",
        "name": "Luxury Ocean Suite",
        "base_price": "120.00",
        "unit": "$",
        "attributes": {}
      }
    ],
    "factors": [
      {
        "name": "surge_ratio",
        "type": "number",
        "default": 1.45,
        "description": "Ratio of ride requests to active online vehicles"
      },
      {
        "name": "weather_severity",
        "type": "number",
        "default": 0.0,
        "description": "Rain/snow index (0.0 clear to 2.0 blizzard)"
      },
      {
        "name": "airport_zone",
        "type": "boolean",
        "default": false,
        "description": "Whether trip terminates at airport terminal"
      }
    ],
    "strategy": {
      "domain_id": "ridehailing",
      "version": "1.0.0",
      "stages": [
        "demand",
        "time",
        "adjustments",
        "guardrails",
        "rounding"
      ],
      "rules": [
        {
          "id": "ride_dynamic_surge",
          "name": "Dynamic Imbalance Surge",
          "stage": "demand",
          "description": "Multiply fare by surge ratio when surge > 1.10",
          "conditions": [
            {
              "field": "surge_ratio",
              "operator": ">",
              "value": 1.1
            }
          ],
          "action": {
            "type": "formula",
            "value": "current_price * surge_ratio"
          },
          "priority": 10,
          "enabled": true
        },
        {
          "id": "ride_adverse_weather",
          "name": "Severe Weather Supply Incentive",
          "stage": "adjustments",
          "description": "When weather severity >= 1.0, add $3.50 driver hazard stipend",
          "conditions": [
            {
              "field": "weather_severity",
              "operator": ">=",
              "value": 1.0
            }
          ],
          "action": {
            "type": "additive",
            "value": "3.50"
          },
          "priority": 20,
          "enabled": true
        },
        {
          "id": "ride_airport_toll",
          "name": "Airport Facility Surcharge",
          "stage": "adjustments",
          "description": "Airport pickup or dropoff includes fixed $5.00 surcharge",
          "conditions": [
            {
              "field": "airport_zone",
              "operator": "==",
              "value": true
            }
          ],
          "action": {
            "type": "additive",
            "value": "5.00"
          },
          "priority": 25,
          "enabled": true
        }
      ],
      "guardrails": [
        {
          "id": "ride_min_fare",
          "name": "Minimum Base Fare Floor",
          "type": "floor",
          "value": "8.00",
          "hard": true,
          "enabled": true
        },
        {
          "id": "ride_surge_cap",
          "name": "Anti-Gouging Surge Ceiling",
          "type": "ceiling",
          "value": "85.00",
          "hard": true,
          "enabled": true
        }
      ],
      "rounding": {
        "method": "nearest_0_05",
        "decimals": 2
      }
    }
  },
  "travel": {
    "id": "travel",
    "name": "Travel",
    "description": "Airline flights, departure lead time curves, cabin load tiers, and route demand.",
    "unit": "$",
    "items": [
      {
        "id": "flight_eco",
        "name": "Economy Non-Refundable Seat",
        "base_price": "220.00",
        "unit": "$",
        "attributes": {
          "cabin": "economy",
          "route": "JFK-LHR"
        }
      },
      {
        "id": "flight_bus",
        "name": "Business Class Flat Bed",
        "base_price": "1450.00",
        "unit": "$",
        "attributes": {
          "cabin": "business",
          "route": "JFK-LHR"
        }
      }
    ],
    "factors": [
      {
        "name": "load_factor",
        "type": "number",
        "default": 0.82,
        "description": "Booked cabin percentage (0.0 to 1.0)"
      },
      {
        "name": "days_to_departure",
        "type": "number",
        "default": 7,
        "description": "Days remaining until flight takeoff"
      },
      {
        "name": "fuel_index",
        "type": "number",
        "default": 1.1,
        "description": "Jet-A fuel cost index multiplier"
      }
    ],
    "strategy": {
      "domain_id": "travel",
      "version": "1.0.0",
      "stages": [
        "demand",
        "time",
        "adjustments",
        "guardrails",
        "rounding"
      ],
      "rules": [
        {
          "id": "travel_tight_capacity",
          "name": "High Load Factor Surge",
          "stage": "demand",
          "description": "If cabin load exceeds 85%, add 30% yield uplift",
          "conditions": [
            {
              "field": "load_factor",
              "operator": ">=",
              "value": 0.85
            }
          ],
          "action": {
            "type": "percentage",
            "value": "30"
          },
          "priority": 10,
          "enabled": true
        },
        {
          "id": "travel_departure_proximity",
          "name": "Departure Proximity Premium",
          "stage": "time",
          "description": "If departure is within 3 days, add $45 express booking fee",
          "conditions": [
            {
              "field": "days_to_departure",
              "operator": "<=",
              "value": 3
            }
          ],
          "action": {
            "type": "additive",
            "value": "45.00"
          },
          "priority": 20,
          "enabled": true
        }
      ],
      "guardrails": [
        {
          "id": "travel_min_margin",
          "name": "Direct Operating Cost Floor",
          "type": "floor",
          "value": "110.00",
          "hard": true,
          "enabled": true
        }
      ],
      "rounding": {
        "method": "nearest_point_99",
        "decimals": 2
      }
    }
  }
};

export function getAllDomains() {
  return Object.values(DEFAULT_DOMAINS).map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    unit: d.unit || "$",
    items_count: (d.items || []).length,
    rules_count: (d.strategy?.rules || []).length,
    active_version: d.strategy?.version || "1.0.0",
  }));
}

export function getDomainById(id: string) {
  return DEFAULT_DOMAINS[id] || null;
}
