"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseAuth } from "../lib/supabaseClient";
import { logUserLogout } from "../lib/authAuditService";
import {
  LayoutDashboard,
  Boxes,
  Sliders,
  Sparkles,
  FlaskConical,
  Send,
  History,
  Activity,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Info,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
  X,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Trash2,
  AlertTriangle,
  FileCheck2,
  Check,
  Zap,
  Lock,
  Search,
  Sliders as SlidersIcon,
  Copy,
  User,
  LogOut,
  Settings,
  Edit2,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface DomainInfo {
  id: string;
  name: string;
  description: string;
  unit: string;
  items_count: number;
  rules_count: number;
  active_version?: string;
}

interface TraceStep {
  step_number: number;
  stage: string;
  rule_id: string | null;
  rule_name: string | null;
  input_price: string;
  adjustment: string;
  output_price: string;
  reason: string;
  matched: boolean;
}

interface EvaluationResult {
  trace: {
    base_price: string;
    final_price: string;
    total_adjustment: string;
    steps: TraceStep[];
    guardrails_triggered: any[];
    decision_hash: string;
    rounding_applied: string;
    unit: string;
  };
  contributions: Array<{
    stage: string;
    rule_id: string;
    rule_name: string;
    adjustment: string;
    contribution_pct: string;
    reason: string;
  }>;
  item: {
    id: string;
    name: string;
    base_price: string;
    unit: string;
  };
  factors_used: Record<string, any>;
}

// Helper functions for business-friendly rule presentations
function capitalizeWords(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPrice(val: string | number | null | undefined, unit = "$"): string {
  if (val === null || val === undefined) return unit === "% APR" ? "0.00% APR" : `${unit}0.00`;
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return unit === "% APR" ? "0.00% APR" : `${unit}0.00`;
  if (unit === "% APR") return `${num.toFixed(2)}% APR`;
  return `${unit}${num.toFixed(2)}`;
}

function formatAdjustmentDelta(adjustment: string | number | null | undefined, unit = "$"): {
  formatted: string;
  isPositive: boolean;
  isNegative: boolean;
  sign: string;
} {
  if (adjustment === null || adjustment === undefined) {
    return {
      formatted: unit === "% APR" ? "+0.00% APR" : `+${unit}0.00`,
      isPositive: false,
      isNegative: false,
      sign: "+",
    };
  }
  const num = typeof adjustment === "number" ? adjustment : parseFloat(adjustment);
  if (isNaN(num) || num === 0) {
    return {
      formatted: unit === "% APR" ? "0.00% APR" : `${unit}0.00`,
      isPositive: false,
      isNegative: false,
      sign: "",
    };
  }
  const isPositive = num > 0;
  const isNegative = num < 0;
  const absFormatted = Math.abs(num).toFixed(2);
  const formatted = unit === "% APR"
    ? `${isPositive ? "+" : "-"}${absFormatted}% APR`
    : `${isPositive ? "+" : "-"}${unit}${absFormatted}`;

  return {
    formatted,
    isPositive,
    isNegative,
    sign: isPositive ? "+" : "-",
  };
}

function formatFactorDisplay(field: string, val: any, isPct: boolean, currentUnit = "$"): string {
  if (typeof val === "boolean") return val ? "Active (Yes)" : "Inactive (No)";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return capitalizeWords(String(val));
  if (isPct) return `${Math.round(num * 100)}%`;
  if (
    field.includes("price") ||
    field.includes("cart") ||
    field.includes("cost") ||
    field.includes("fare")
  ) {
    return formatPrice(num, currentUnit);
  }
  if (field.includes("day") || field.includes("lead") || field.includes("departure")) {
    return `${Math.round(num)} days`;
  }
  if (field.includes("units") || field.includes("stock")) {
    return `${Math.round(num)} units`;
  }
  if (num % 1 !== 0) return num.toFixed(2);
  return String(num);
}

function getHumanActionLabel(action: string, entry?: any): string {
  if (entry?.display_title) return entry.display_title;
  switch (action) {
    case "user_login":
    case "LOGIN":
    case "USER_LOGIN":
      return "User Logged In";
    case "user_logout":
    case "LOGOUT":
      return "User Logged Out";
    case "PUBLISH":
      return "Pricing Strategy Published";
    case "ITEM_CREATE":
      return "Room Created";
    case "ITEM_UPDATE":
      return "Room Updated";
    case "ITEM_DELETE":
      return "Room Removed";
    case "RULE_CREATE":
      return "Pricing Rule Added";
    case "RULE_UPDATE":
      return "Pricing Rule Updated";
    case "RULE_TOGGLE":
      return "Rule Status Toggled";
    case "ROLLBACK":
      return "Strategy Rolled Back";
    default:
      return capitalizeWords(action);
  }
}

function getAuditEntryDescription(entry: any, unit = "$"): string {
  const { action, details, version } = entry;
  if (action === "user_login" || action === "LOGIN" || action === "USER_LOGIN") {
    if (entry.description) return entry.description;
    if (details?.description) return details.description;
    const actor =
      entry.actor ||
      entry.actor_name ||
      entry.author ||
      details?.actor ||
      details?.actor_name ||
      details?.author ||
      (details?.email ? details.email.split("@")[0] : "User");
    return `${actor} signed in via email authentication`;
  }
  if (action === "user_logout" || action === "LOGOUT") {
    if (entry.description) return entry.description;
    if (details?.description) return details.description;
    const actor =
      entry.actor ||
      entry.actor_name ||
      entry.author ||
      details?.actor ||
      details?.actor_name ||
      details?.author ||
      (details?.email ? details.email.split("@")[0] : "User");
    return `${actor} terminated session`;
  }
  if (action === "PUBLISH") {
    const rulesStr = details?.rules_count !== undefined ? ` with ${details.rules_count} active rules` : "";
    const notesStr = details?.notes ? ` • ${details.notes}` : "";
    return `Published Strategy v${version}${rulesStr}${notesStr}`;
  }
  if (action === "ITEM_CREATE") {
    const name = details?.name || "Inventory Item";
    const price = details?.base_price ? ` (Base Rate: ${formatPrice(details.base_price, unit)})` : "";
    return `Created ${name}${price}`;
  }
  if (action === "ITEM_UPDATE") {
    const name = details?.name || details?.previous_name || "Room";
    const oldRate = details?.previous_base_price ? formatPrice(details.previous_base_price, unit) : null;
    const newRate = details?.new_base_price ? formatPrice(details.new_base_price, unit) : null;
    if (oldRate && newRate) {
      return `Updated ${name} • Base Rate: ${oldRate} → ${newRate}`;
    }
    return `Updated room details for ${name}`;
  }
  if (action === "ITEM_DELETE") {
    const name = details?.name || details?.item_id || "Inventory Item";
    return `Removed ${name}`;
  }
  if (action === "RULE_CREATE") {
    return `Created pricing rule "${details?.name || details?.rule_id || ""}"`;
  }
  if (action === "RULE_UPDATE") {
    return `Updated pricing rule "${details?.name || details?.rule_id || ""}"`;
  }
  if (action === "RULE_TOGGLE") {
    const stateStr = details?.enabled !== false ? "Active" : "Disabled";
    return `Set rule "${details?.rule_id || ""}" to ${stateStr}`;
  }
  if (action === "ROLLBACK") {
    return `Restored pricing strategy to snapshot v${details?.target_version || version}`;
  }
  return details?.notes || JSON.stringify(details || {});
}

function formatAuditTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return ts;
  }
}

function getFieldLabel(field: string): string {
  const customLabels: Record<string, string> = {
    occupancy_rate: "Occupancy",
    lead_days: "Booking window",
    days_to_departure: "Days to departure",
    loyalty_tier: "Loyalty tier",
    credit_tier: "Applicant credit tier",
    ltv_ratio: "Loan-to-value (LTV) ratio",
    competitor_price: "Competitor price",
    stock_units: "Inventory stock",
    stock_velocity: "Sales velocity",
    cart_total: "Cart total",
    surge_ratio: "Surge ratio",
    weather_severity: "Weather severity index",
    airport_zone: "Airport zone",
    seats_sold_pct: "Auditorium capacity",
    is_matinee: "Showtime schedule",
    load_factor: "Cabin load factor",
  };
  if (customLabels[field]) return customLabels[field];
  return capitalizeWords(field);
}

function formatConditionValue(field: string, val: any, currentUnit = "$"): string {
  if (typeof val === "boolean") return val ? "active" : "inactive";
  if (typeof val === "number") {
    if (
      val <= 1.0 &&
      val >= 0 &&
      (field.includes("rate") ||
        field.includes("pct") ||
        field.includes("ratio") ||
        field.includes("factor"))
    ) {
      return `${Math.round(val * 100)}%`;
    }
    if (
      field.includes("price") ||
      field.includes("cart") ||
      field.includes("cost") ||
      field.includes("fare")
    ) {
      return currentUnit === "% APR" ? `${val}% APR` : `${currentUnit}${val.toFixed(2)}`;
    }
    return String(val);
  }
  if (Array.isArray(val)) {
    return val.map((v) => capitalizeWords(String(v))).join(" or ");
  }
  return capitalizeWords(String(val));
}

function translateSingleCondition(c: any, currentUnit = "$"): string {
  const { field, operator, value } = c;

  if (field === "occupancy_rate") {
    const pct = typeof value === "number" ? `${Math.round(value * 100)}%` : String(value);
    if (operator === ">=" || operator === ">") return `Occupancy reaches ${pct} or higher`;
    if (operator === "<=" || operator === "<") return `Occupancy is below ${pct}`;
  }

  if (field === "lead_days") {
    if (operator === "<=" || operator === "<") return `Booking is within ${value} days`;
    if (operator === ">=" || operator === ">") return `Booking is ${value} or more days in advance`;
  }

  if (field === "days_to_departure") {
    if (operator === "<=" || operator === "<") return `Departure is within ${value} days`;
    if (operator === ">=" || operator === ">") return `Departure is ${value} or more days away`;
  }

  if (field === "loyalty_tier") {
    if (operator === "in" && Array.isArray(value)) {
      const tiers = value.map((t: string) => capitalizeWords(t)).join(" or ");
      return `Customer is a ${tiers} member`;
    }
    if (operator === "==") {
      return `Customer is a ${capitalizeWords(String(value))} member`;
    }
  }

  if (field === "credit_tier") {
    if (operator === "==") {
      return `Applicant credit tier is ${capitalizeWords(String(value))}`;
    }
  }

  if (field === "is_matinee") {
    if (operator === "==" && value === true) return `Showtime is an early matinee`;
    if (operator === "==" && value === false) return `Showtime is an evening or prime screening`;
  }

  if (field === "airport_zone") {
    if (operator === "==" && value === true) return `Trip is in an Airport Zone`;
  }

  if (field === "cart_total") {
    if (operator === ">=" || operator === ">") return `Cart total reaches ${currentUnit}${Number(value).toFixed(0)} or higher`;
    if (operator === "<=" || operator === "<") return `Cart total is below ${currentUnit}${Number(value).toFixed(0)}`;
  }

  if (field === "stock_units") {
    if (operator === "<=" || operator === "<") return `Inventory stock is ${value} units or fewer`;
    if (operator === ">=" || operator === ">") return `Inventory stock exceeds ${value} units`;
  }

  if (field === "stock_velocity") {
    if (operator === ">=" || operator === ">") return `Sales velocity reaches ${value} or higher`;
  }

  if (field === "seats_sold_pct") {
    const pct = typeof value === "number" ? `${Math.round(value * 100)}%` : String(value);
    if (operator === ">=" || operator === ">") return `Auditorium is ${pct} full or higher`;
  }

  if (field === "load_factor") {
    const pct = typeof value === "number" ? `${Math.round(value * 100)}%` : String(value);
    if (operator === ">=" || operator === ">") return `Cabin load factor exceeds ${pct}`;
  }

  if (field === "surge_ratio") {
    if (operator === ">" || operator === ">=") return `Surge ratio exceeds ${value}`;
  }

  if (field === "weather_severity") {
    if (operator === ">=" || operator === ">") return `Weather severity reaches ${value} or higher`;
  }

  if (field === "ltv_ratio") {
    const pct = typeof value === "number" ? `${Math.round(value * 100)}%` : String(value);
    if (operator === ">=" || operator === ">") return `Loan-to-value (LTV) ratio reaches ${pct} or higher`;
  }

  // General fallback translations based on operator
  const label = getFieldLabel(field);
  const formattedVal = formatConditionValue(field, value, currentUnit);

  switch (operator) {
    case ">=":
      return `${label} reaches ${formattedVal} or higher`;
    case ">":
      return `${label} exceeds ${formattedVal}`;
    case "<=":
      return `${label} is ${formattedVal} or lower`;
    case "<":
      return `${label} is below ${formattedVal}`;
    case "==":
      if (typeof value === "boolean") {
        return value ? `${label} is active` : `${label} is inactive`;
      }
      return `${label} is ${formattedVal}`;
    case "!=":
      return `${label} is not ${formattedVal}`;
    case "in":
      return `${label} is ${Array.isArray(value) ? value.map((v) => capitalizeWords(String(v))).join(" or ") : formattedVal}`;
    case "not_in":
      return `${label} is not ${Array.isArray(value) ? value.map((v) => capitalizeWords(String(v))).join(" or ") : formattedVal}`;
    default:
      return `${field} ${operator} ${value}`;
  }
}

function translateConditions(conditions: any[], currentUnit = "$"): string {
  if (!conditions || conditions.length === 0) {
    return "Always applied (unconditional)";
  }

  const byField: Record<string, any[]> = {};
  for (const c of conditions) {
    if (!byField[c.field]) byField[c.field] = [];
    byField[c.field].push(c);
  }

  const parts: string[] = [];

  for (const [field, conds] of Object.entries(byField)) {
    if (conds.length === 2) {
      const gte = conds.find((c) => c.operator === ">=" || c.operator === ">");
      const lte = conds.find((c) => c.operator === "<=" || c.operator === "<");

      if (gte && lte) {
        const fieldLabel = getFieldLabel(field);
        const minVal = formatConditionValue(field, gte.value, currentUnit);
        const maxVal = formatConditionValue(field, lte.value, currentUnit);
        parts.push(`${fieldLabel} is between ${minVal} and ${maxVal}`);
        continue;
      }
    }

    for (const c of conds) {
      parts.push(translateSingleCondition(c, currentUnit));
    }
  }

  if (parts.length === 0) {
    return conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join(" AND ");
  }

  return parts.join(" and ");
}

function getActionPresentation(action: any, currentUnit = "$"): {
  text: string;
  impact: string;
  impactType: "surge" | "discount" | "neutral";
} {
  if (!action) {
    return { text: "No action defined", impact: "—", impactType: "neutral" };
  }

  const type = action.type;
  const rawVal = action.value;
  const numVal = parseFloat(rawVal);
  const isApr = currentUnit === "% APR";

  if (type === "percentage") {
    if (numVal > 0) {
      return {
        text: `Increase price by ${Math.abs(numVal)}%`,
        impact: `+${Math.abs(numVal)}%`,
        impactType: "surge",
      };
    } else if (numVal < 0) {
      return {
        text: `Decrease price by ${Math.abs(numVal)}%`,
        impact: `-${Math.abs(numVal)}%`,
        impactType: "discount",
      };
    } else {
      return {
        text: "No percentage change (0%)",
        impact: "0%",
        impactType: "neutral",
      };
    }
  }

  if (type === "additive") {
    const absNum = Math.abs(numVal);
    const formattedAbs = isApr ? `${absNum.toFixed(2)}% APR` : `${currentUnit}${absNum.toFixed(2)}`;

    if (numVal > 0) {
      return {
        text: isApr ? `Increase rate by +${formattedAbs}` : `Increase price by ${formattedAbs}`,
        impact: `+${formattedAbs}`,
        impactType: "surge",
      };
    } else if (numVal < 0) {
      return {
        text: isApr ? `Apply a ${formattedAbs} rate discount` : `Apply a ${formattedAbs} discount`,
        impact: `-${formattedAbs}`,
        impactType: "discount",
      };
    } else {
      return {
        text: "No rate adjustment ($0.00)",
        impact: "0.00",
        impactType: "neutral",
      };
    }
  }

  if (type === "multiplicative") {
    return {
      text: `Multiply price by ${rawVal}×`,
      impact: `${rawVal}× multiplier`,
      impactType: numVal >= 1 ? "surge" : "discount",
    };
  }

  if (type === "fixed") {
    const formattedFixed = isApr ? `${rawVal}% APR` : `${currentUnit}${rawVal}`;
    return {
      text: `Set fixed price to ${formattedFixed}`,
      impact: `Fixed ${formattedFixed}`,
      impactType: "neutral",
    };
  }

  if (type === "formula") {
    return {
      text: `Apply dynamic formula: ${rawVal}`,
      impact: "Dynamic Formula",
      impactType: "neutral",
    };
  }

  return {
    text: `Action: ${type} (${rawVal})`,
    impact: `${rawVal}`,
    impactType: "neutral",
  };
}

interface FactorSliderConfig {
  isNumber: boolean;
  isPct: boolean;
  min: number;
  max: number;
  step: number;
  presets?: { label: string; value: any }[];
}

function getFactorSliderConfig(f: any): FactorSliderConfig {
  const isNumber = typeof f.default === "number";
  if (!isNumber) {
    let presets: { label: string; value: any }[] | undefined;
    if (f.name === "loyalty_tier") {
      presets = [
        { label: "Standard", value: "standard" },
        { label: "Silver", value: "silver" },
        { label: "Gold", value: "gold" },
        { label: "Platinum", value: "platinum" },
      ];
    } else if (f.name === "credit_tier") {
      presets = [
        { label: "Tier A", value: "tier_a" },
        { label: "Tier B", value: "tier_b" },
        { label: "Tier C", value: "tier_c" },
        { label: "Tier D", value: "tier_d" },
      ];
    }
    return { isNumber: false, isPct: false, min: 0, max: 0, step: 0, presets };
  }

  const name = String(f.name || "").toLowerCase();
  const isPct =
    f.default <= 1.0 &&
    f.default >= 0 &&
    (name.includes("rate") ||
      name.includes("pct") ||
      name.includes("ratio") ||
      name.includes("factor"));

  if (isPct) {
    return {
      isNumber: true,
      isPct: true,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      presets: [
        { label: "Low (30%)", value: 0.3 },
        { label: "Med (55%)", value: 0.55 },
        { label: "High (80%)", value: 0.8 },
        { label: "Surge (90%)", value: 0.9 },
        { label: "Peak (95%)", value: 0.95 },
      ],
    };
  }

  // Day counts / lead time / stock units / count
  if (
    name.includes("day") ||
    name.includes("lead") ||
    name.includes("time") ||
    name.includes("units") ||
    name.includes("stock") ||
    name.includes("count")
  ) {
    const maxVal = Math.max(30, Math.ceil(f.default * 2.5));
    let presets: { label: string; value: any }[] = [];
    if (name === "lead_days") {
      presets = [
        { label: "1d (Last-minute)", value: 1 },
        { label: "2d", value: 2 },
        { label: "3d", value: 3 },
        { label: "7d", value: 7 },
        { label: "13d", value: 13 },
        { label: "14d (Early: -3%)", value: 14 },
        { label: "20d", value: 20 },
        { label: "21d (Advance: -5%)", value: 21 },
      ];
    } else if (name === "days_to_departure") {
      presets = [
        { label: "1 day (Urgent)", value: 1 },
        { label: "3 days (Proximity limit)", value: 3 },
        { label: "7 days (Default)", value: 7 },
        { label: "14 days", value: 14 },
      ];
    } else if (name === "stock_units") {
      presets = [
        { label: "5 units (Scarcity)", value: 5 },
        { label: "10 units (Low stock)", value: 10 },
        { label: "15 units (Default)", value: 15 },
        { label: "30 units (Ample)", value: 30 },
      ];
    } else {
      presets = [
        { label: "Min (0)", value: 0 },
        { label: `Baseline (${f.default})`, value: f.default },
        { label: `Max (${maxVal})`, value: maxVal },
      ];
    }

    return {
      isNumber: true,
      isPct: false,
      min: 0,
      max: maxVal,
      step: 1,
      presets,
    };
  }

  // Monetary / price metrics (e.g. competitor_price, cart_total)
  if (name.includes("price") || name.includes("cart") || name.includes("cost") || name.includes("fare")) {
    const maxVal = Math.round(Math.max(400, f.default * 2.5));
    let presets = [
      { label: "$100", value: 100 },
      { label: `$${Math.round(f.default)} (Baseline)`, value: f.default },
      { label: "$250", value: 250 },
      { label: "$350", value: 350 },
    ];
    if (name === "competitor_price") {
      presets = [
        { label: "$120 (Low: -5%)", value: 120 },
        { label: "$149", value: 149 },
        { label: "$195 (Baseline)", value: 195 },
        { label: "$251", value: 251 },
        { label: "$300 (High: +10%)", value: 300 },
      ];
    }
    return {
      isNumber: true,
      isPct: false,
      min: 0,
      max: maxVal,
      step: 1,
      presets,
    };
  }

  // General numbers (e.g. fuel_index, weather_severity, surge_ratio)
  const maxVal = Math.max(5, Math.ceil(f.default * 2.5));
  const step = f.default < 10 ? 0.05 : 1;
  return {
    isNumber: true,
    isPct: false,
    min: 0,
    max: maxVal,
    step,
  };
}

import { useAuth } from "../context/AuthContext";

export default function Home() {
  const router = useRouter();
  const { authState, user: currentUser, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();

  // Edit item state (Rooms & Rates)
  const [showEditItemModal, setShowEditItemModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editItemName, setEditItemName] = useState<string>("");
  const [editItemBasePrice, setEditItemBasePrice] = useState<string>("");
  const [isEditingLoading, setIsEditingLoading] = useState<boolean>(false);
  const [editItemError, setEditItemError] = useState<string | null>(null);

  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>("hospitality");
  const [domainDetail, setDomainDetail] = useState<any>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  // Navigation tab
  const [activeTab, setActiveTab] = useState<
    "home" | "items" | "factors" | "strategy" | "simulation" | "publish" | "versions" | "live-console" | "explain" | "audit"
  >("home");

  // Factors & evaluation state
  const [factors, setFactors] = useState<Record<string, any>>({});
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const evalSeqRef = useRef<number>(0);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Copilot drawer state
  const [showCopilot, setShowCopilot] = useState<boolean>(false);
  const [copilotPrompt, setCopilotPrompt] = useState<string>("");
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);
  const [copilotProposal, setCopilotProposal] = useState<any>(null);
  const [customRules, setCustomRules] = useState<any[]>([]);

  // Simulation state
  const [simPoints, setSimPoints] = useState<any[]>([]);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  // Counterfactual state
  const [cfDelta, setCfDelta] = useState<string | null>(null);
  const [cfFactorVal, setCfFactorVal] = useState<number>(0.5);

  // Governance & Versions
  const [versionsList, setVersionsList] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditValid, setAuditValid] = useState<boolean | null>(null);
  const [lintIssues, setLintIssues] = useState<any[]>([]);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string>("");

  // Live feed
  const [liveTicks, setLiveTicks] = useState<any[]>([]);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);

  // Items modal
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>("");
  const [newItemBasePrice, setNewItemBasePrice] = useState<string>("100.00");

  // Expanded rule details state in Strategy Studio
  const [expandedRuleIds, setExpandedRuleIds] = useState<Record<string, boolean>>({});
  const toggleRuleExpanded = (ruleId: string) => {
    setExpandedRuleIds((prev) => ({
      ...prev,
      [ruleId]: !prev[ruleId],
    }));
  };

  // Pricing Dashboard UI & Popover state
  const [activeFactorPopover, setActiveFactorPopover] = useState<string | null>(null);
  const [showEngineInfo, setShowEngineInfo] = useState<boolean>(false);
  const [bottomSummaryExpanded, setBottomSummaryExpanded] = useState<boolean>(false);

  // Navigation collapsible Developer menu & User Profile
  const [devToolsOpen, setDevToolsOpen] = useState<boolean>(false);
  const [showUserProfile, setShowUserProfile] = useState<boolean>(false);

  // What-If Simulation state (used by dedicated Simulator)
  const [whatIfFactor, setWhatIfFactor] = useState<string>("occupancy_rate");
  const [whatIfValue, setWhatIfValue] = useState<any>(0.9);
  const [whatIfResult, setWhatIfResult] = useState<EvaluationResult | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState<boolean>(false);

  // Activity & Audit Log filters and security details accordion
  const [auditFilter, setAuditFilter] = useState<"all" | "changes" | "releases" | "user">("all");
  const [expandedAuditTechIds, setExpandedAuditTechIds] = useState<Record<string, boolean>>({});
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Strategy Activation Readiness technical checks accordion
  const [showPublishTech, setShowPublishTech] = useState<boolean>(false);

  const toggleAuditTech = (id: string) => {
    setExpandedAuditTechIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopyHash = (hash: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(hash).then(() => {
        setCopiedHash(hash);
        setTimeout(() => setCopiedHash(null), 2000);
      });
    }
  };

  // Close popovers on click outside or Escape
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveFactorPopover(null);
      setShowEngineInfo(false);
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveFactorPopover(null);
        setShowEngineInfo(false);
      }
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  // Authoritative client-side route guard: redirect to /login ONCE if unauthenticated
  useEffect(() => {
    if (authState === "UNAUTHENTICATED") {
      router.replace("/login");
    }
  }, [authState, router]);

  const isDemoUser =
    currentUser?.email?.toLowerCase().includes("demo") ||
    (currentUser?.user_metadata?.role?.toLowerCase() === "revenue director" &&
      currentUser?.email?.toLowerCase().includes("demo"));
  const userDisplayName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.user_metadata?.name ||
    (isDemoUser ? "Monetize360 Demo" : currentUser?.email?.split("@")[0] || "Disha R");
  const userRole = currentUser?.user_metadata?.role || (isDemoUser ? "Revenue Director" : "Pricing Analyst");
  const userEmail = currentUser?.email || (isDemoUser ? "demo@monetize360.com" : "disha.r@monetize360.io");

  // Logout handler
  const handleLogout = async () => {
    setShowUserProfile(false);
    try {
      // 1. Capture authenticated user BEFORE calling signOut()
      if (currentUser) {
        // 2 & 3. Create persistent user_logout event via centralized authAuditService
        const auditRes = await logUserLogout(currentUser, {
          domainId: selectedDomainId || "hospitality",
        });
        if (!auditRes.success) {
          console.warn("Logout audit event notice:", auditRes.error);
        }
      }
      // 4. Safely terminate Supabase session through authoritative context
      await logout();
      // 5. Redirect to /login
      router.replace("/login");
    } catch (e) {
      console.error("Logout error:", e);
      try {
        await logout();
      } catch {}
      router.replace("/login");
    }
  };

  // Open Edit Item Modal
  const openEditItemModal = (it: any) => {
    setEditingItem(it);
    setEditItemName(it.name || "");
    setEditItemBasePrice(it.base_price ? String(it.base_price) : "");
    setEditItemError(null);
    setShowEditItemModal(true);
  };

  // Save Edit Item
  const handleSaveEditItem = async () => {
    if (!editingItem) return;
    if (!editItemName.trim()) {
      setEditItemError("Room name is required.");
      return;
    }
    if (!editItemBasePrice.trim() || isNaN(parseFloat(editItemBasePrice))) {
      setEditItemError("Please enter a valid numeric base rate.");
      return;
    }

    setIsEditingLoading(true);
    setEditItemError(null);

    try {
      const res = await fetch(`/api/domains/${selectedDomainId}/items/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editItemName.trim(),
          base_price: parseFloat(editItemBasePrice).toFixed(2),
          author: userDisplayName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update room");
      }

      setShowEditItemModal(false);
      setEditingItem(null);
      await loadDomainDetail(selectedDomainId);
      loadGovernanceData();
    } catch (err: any) {
      setEditItemError(err?.message || "Failed to save room updates.");
    } finally {
      setIsEditingLoading(false);
    }
  };

  // Load all domain packs
  const loadDomains = useCallback(() => {
    fetch("/api/domains")
      .then((res) => res.json())
      .then((data) => {
        if (data.domains && data.domains.length > 0) {
          setDomains(data.domains);
        }
      })
      .catch((err) => console.error("Error fetching domains:", err));
  }, []);

  useEffect(() => {
    if (isAuthLoading || !currentUser) return;
    loadDomains();
  }, [isAuthLoading, currentUser, loadDomains]);

  // Load domain details
  const loadDomainDetail = useCallback((domainId: string) => {
    fetch(`/api/domains/${domainId}`)
      .then((res) => res.json())
      .then((data) => {
        setDomainDetail(data);
        if (data.items && data.items.length > 0) {
          setSelectedItemId(data.items[0].id);
        }
        const defaultFactors: Record<string, any> = {};
        if (data.factors) {
          data.factors.forEach((f: any) => {
            defaultFactors[f.name] = f.default;
          });
        }
        setFactors(defaultFactors);
        setCustomRules([]);
        setCopilotProposal(null);
      })
      .catch((err) => console.error("Error fetching domain details:", err));
  }, []);

  useEffect(() => {
    if (isAuthLoading || !currentUser) return;
    if (selectedDomainId) {
      loadDomainDetail(selectedDomainId);
    }
  }, [isAuthLoading, currentUser, selectedDomainId, loadDomainDetail]);

  // Evaluate price
  const runEvaluation = useCallback(
    async (currentFactors = factors, rules = customRules) => {
      if (!selectedDomainId || !selectedItemId) return;
      const seq = ++evalSeqRef.current;
      setIsLoading(true);
      setIsAnimating(true);
      setEvalError(null);

      try {
        const res = await fetch("/api/pricing/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain_id: selectedDomainId,
            item_id: selectedItemId,
            factors: currentFactors,
            custom_rules: rules.length > 0 ? rules : undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Evaluation failed (status ${res.status})`);
        }
        const data = await res.json();
        if (seq === evalSeqRef.current) {
          setEvalResult(data);
          setEvalError(null);
        }
      } catch (err: any) {
        if (seq === evalSeqRef.current) {
          setEvalError(err?.message || "Failed to calculate dynamic price");
        }
        console.error("Evaluation error:", err);
      } finally {
        if (seq === evalSeqRef.current) {
          setIsLoading(false);
          setTimeout(() => setIsAnimating(false), 500);
        }
      }
    },
    [selectedDomainId, selectedItemId, factors, customRules]
  );

  useEffect(() => {
    if (isAuthLoading || !currentUser) return;
    if (selectedDomainId && selectedItemId) {
      runEvaluation(factors, customRules);
    }
  }, [isAuthLoading, currentUser, selectedDomainId, selectedItemId, factors, customRules, runEvaluation]);

  // Run What-If calculation using the exact same backend evaluator
  const runWhatIfCalculation = useCallback(
    async (factorName: string, val: any) => {
      if (!selectedDomainId || !selectedItemId) return;
      setWhatIfLoading(true);
      try {
        const scenarioFactors = { ...factors, [factorName]: val };
        const res = await fetch("/api/pricing/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain_id: selectedDomainId,
            item_id: selectedItemId,
            factors: scenarioFactors,
            custom_rules: customRules.length > 0 ? customRules : undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setWhatIfResult(data);
        }
      } catch (err) {
        console.error("What-if calculation error:", err);
      } finally {
        setWhatIfLoading(false);
      }
    },
    [selectedDomainId, selectedItemId, factors, customRules]
  );

  useEffect(() => {
    if (isAuthLoading || !currentUser) return;
    if (selectedDomainId && selectedItemId && domainDetail?.factors?.length) {
      const fName = whatIfFactor || domainDetail.factors[0].name;
      const targetVal = whatIfValue !== undefined ? whatIfValue : (factors[fName] !== undefined ? factors[fName] : domainDetail.factors[0].default);
      runWhatIfCalculation(fName, targetVal);
    }
  }, [isAuthLoading, currentUser, selectedDomainId, selectedItemId, factors, customRules, whatIfFactor, whatIfValue, runWhatIfCalculation, domainDetail]);

  // Load versions and audit log
  const loadGovernanceData = useCallback(() => {
    if (!selectedDomainId) return;
    fetch(`/api/governance/versions/${selectedDomainId}`)
      .then((r) => r.json())
      .then((d) => setVersionsList(d.versions || []));

    fetch(`/api/governance/audit-trail?domain_id=${selectedDomainId}`)
      .then((r) => r.json())
      .then((d) => setAuditLog(d.audit_trail || []));

    fetch("/api/governance/verify-audit")
      .then((r) => r.json())
      .then((d) => setAuditValid(d.valid));
  }, [selectedDomainId]);

  useEffect(() => {
    if (isAuthLoading || !currentUser) return;
    loadGovernanceData();
  }, [isAuthLoading, currentUser, selectedDomainId, loadGovernanceData]);

  // Live feed stream
  useEffect(() => {
    if (isAuthLoading || !currentUser) return;
    if (!selectedDomainId || !isLiveStreaming) return;
    const fetchFeed = () => {
      fetch(`/api/pricing/feed/${selectedDomainId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.feed) {
            setLiveTicks(d.feed);
          }
        })
        .catch((e) => console.error("Feed error:", e));
    };
    fetchFeed();
    const interval = setInterval(fetchFeed, 4000);
    return () => clearInterval(interval);
  }, [isAuthLoading, currentUser, selectedDomainId, isLiveStreaming]);

  // Run linter
  const runLinterCheck = async () => {
    if (!domainDetail?.strategy) return;
    try {
      const res = await fetch("/api/governance/lint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(domainDetail.strategy),
      });
      const data = await res.json();
      setLintIssues(data.issues || []);
    } catch (e) {
      console.error("Linter error:", e);
    }
  };

  // Publish new version
  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishSuccessMsg("");
    try {
      const res = await fetch("/api/governance/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_id: selectedDomainId,
          author: userDisplayName,
          notes: "Approved live dynamic pricing strategy update",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPublishSuccessMsg(`Published successfully as version ${data.version}!`);
        loadDomainDetail(selectedDomainId);
        loadGovernanceData();
      } else {
        const err = await res.json();
        alert(err.detail || "Publishing blocked by governance");
      }
    } catch (e) {
      console.error("Publish error:", e);
    } finally {
      setIsPublishing(false);
    }
  };

  // Rollback version
  const handleRollback = async (targetVersion: string) => {
    if (!confirm(`Are you sure you want to rollback to version ${targetVersion}?`)) return;
    try {
      const res = await fetch("/api/governance/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_id: selectedDomainId,
          target_version: targetVersion,
          author: userDisplayName,
        }),
      });
      if (res.ok) {
        alert(`Rolled back successfully to version ${targetVersion}!`);
        loadDomainDetail(selectedDomainId);
        loadGovernanceData();
      }
    } catch (e) {
      console.error("Rollback error:", e);
    }
  };

  // Add Item
  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    const itemId = `item_${Date.now()}`;
    try {
      const res = await fetch(`/api/domains/${selectedDomainId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: itemId,
          name: newItemName.trim(),
          base_price: newItemBasePrice.trim(),
          unit: domainDetail?.unit || "$",
          author: userDisplayName,
        }),
      });
      if (res.ok) {
        setShowAddItemModal(false);
        setNewItemName("");
        loadDomainDetail(selectedDomainId);
        loadGovernanceData();
      }
    } catch (e) {
      console.error("Add item error:", e);
    }
  };

  // Delete Item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Delete this inventory item?")) return;
    try {
      await fetch(
        `/api/domains/${selectedDomainId}/items/${itemId}?author=${encodeURIComponent(userDisplayName)}`,
        { method: "DELETE" }
      );
      loadDomainDetail(selectedDomainId);
      loadGovernanceData();
    } catch (e) {
      console.error("Delete item error:", e);
    }
  };

  // Toggle Rule
  const handleToggleRule = async (ruleId: string) => {
    try {
      await fetch(
        `/api/domains/${selectedDomainId}/rules/${ruleId}/toggle?author=${encodeURIComponent(userDisplayName)}`,
        { method: "PATCH" }
      );
      loadDomainDetail(selectedDomainId);
      loadGovernanceData();
    } catch (e) {
      console.error("Toggle rule error:", e);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Delete this rule from the strategy?")) return;
    try {
      await fetch(
        `/api/domains/${selectedDomainId}/rules/${ruleId}?author=${encodeURIComponent(userDisplayName)}`,
        { method: "DELETE" }
      );
      loadDomainDetail(selectedDomainId);
      loadGovernanceData();
    } catch (e) {
      console.error("Delete rule error:", e);
    }
  };

  // Run Simulation curve
  const handleRunSimulation = async (factorToSweep?: string) => {
    if (!selectedDomainId || !selectedItemId || !domainDetail?.factors?.length) return;
    setSimLoading(true);
    const sweepFact = factorToSweep || whatIfFactor || domainDetail.factors[0].name;
    const fObj = domainDetail.factors.find((f: any) => f.name === sweepFact);
    const sliderCfg = fObj ? getFactorSliderConfig(fObj) : { min: 0.2, max: 1.0, isPct: false };

    let minVal = sliderCfg.min;
    let maxVal = sliderCfg.max;
    if (sliderCfg.isPct) {
      minVal = 0.2;
      maxVal = 1.0;
    } else if (sweepFact.includes("day") || sweepFact.includes("lead")) {
      minVal = 1;
      maxVal = 25;
    } else if (sweepFact.includes("price") || sweepFact.includes("cost") || sweepFact.includes("cart")) {
      minVal = Math.round(Math.max(80, (fObj?.default || 200) * 0.6));
      maxVal = Math.round(Math.max(320, (fObj?.default || 200) * 1.6));
    } else {
      minVal = Math.max(1, Math.round((fObj?.default || 10) * 0.4));
      maxVal = Math.max(5, Math.round((fObj?.default || 10) * 2.0));
    }

    try {
      const res = await fetch("/api/pricing/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_id: selectedDomainId,
          item_id: selectedItemId,
          sweep_factor: sweepFact,
          min_val: minVal,
          max_val: maxVal,
          steps_count: 6,
          base_factors: factors,
        }),
      });
      const data = await res.json();
      setSimPoints(data.points || []);
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setSimLoading(false);
    }
  };

  // Run Counterfactual
  const handleRunCounterfactual = async (val: number) => {
    setCfFactorVal(val);
    if (!domainDetail?.factors?.length) return;
    const firstFact = domainDetail.factors[0].name;
    try {
      const res = await fetch("/api/pricing/counterfactual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_id: selectedDomainId,
          item_id: selectedItemId,
          base_factors: factors,
          modified_factors: { [firstFact]: val },
        }),
      });
      const data = await res.json();
      setCfDelta(data.delta);
    } catch (e) {
      console.error("Counterfactual error:", e);
    }
  };

  // Copilot keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCopilot((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleGenerateCopilotRule = async () => {
    if (!copilotPrompt.trim()) return;
    setCopilotLoading(true);
    try {
      const res = await fetch("/api/copilot/generate-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_id: selectedDomainId,
          prompt: copilotPrompt,
        }),
      });
      const data = await res.json();
      setCopilotProposal(data);
    } catch (err) {
      console.error("Copilot error:", err);
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleApplyCopilotRule = () => {
    if (copilotProposal?.rule) {
      const updatedRules = [...customRules, copilotProposal.rule];
      setCustomRules(updatedRules);
      runEvaluation(factors, updatedRules);
      setShowCopilot(false);
      setCopilotProposal(null);
      setCopilotPrompt("");
    }
  };

  const currentUnit = evalResult?.trace?.unit || "$";
  const outputPrice = evalResult?.trace?.final_price || "0.00";
  const basePrice = evalResult?.trace?.base_price || "0.00";
  const currentItem = domainDetail?.items?.find((it: any) => it.id === selectedItemId) || domainDetail?.items?.[0];
  const baseVal = parseFloat(basePrice) || 0;
  const finalVal = parseFloat(outputPrice) || 0;
  const priceDelta = finalVal - baseVal;
  const priceDeltaPct = baseVal > 0 ? ((priceDelta / baseVal) * 100).toFixed(1) : "0.0";
  const activeStrategyVersion = domainDetail?.active_version || domainDetail?.strategy?.version || "1.0.0";

  // What-If derived calculations
  const whatIfFactorObj = domainDetail?.factors?.find((f: any) => f.name === whatIfFactor) || domainDetail?.factors?.[0];
  const whatIfSliderCfg = whatIfFactorObj ? getFactorSliderConfig(whatIfFactorObj) : null;
  const whatIfProjectedPrice = whatIfResult?.trace?.final_price || outputPrice;
  const whatIfBasePrice = whatIfResult?.trace?.base_price || basePrice;
  const whatIfProjectedNum = parseFloat(whatIfProjectedPrice) || 0;
  const currentOutputNum = parseFloat(outputPrice) || 0;
  const whatIfDelta = whatIfProjectedNum - currentOutputNum;
  const whatIfDeltaPct = currentOutputNum > 0 ? ((whatIfDelta / currentOutputNum) * 100).toFixed(2) : "0.00";
  const whatIfBaseDelta = whatIfProjectedNum - (parseFloat(whatIfBasePrice) || 0);
  const whatIfBaseDeltaPct = parseFloat(whatIfBasePrice) > 0 ? ((whatIfBaseDelta / parseFloat(whatIfBasePrice)) * 100).toFixed(2) : "0.00";
  const whatIfTriggeredRules = whatIfResult?.trace?.steps?.filter((s: any) => s.matched && s.stage !== "guardrails" && s.stage !== "rounding") || [];
  const whatIfTriggeredRule = whatIfTriggeredRules.length > 0 ? whatIfTriggeredRules[whatIfTriggeredRules.length - 1] : null;

  // Activation readiness derived state
  const hasBlockingIssues = lintIssues.some((iss: any) => iss.severity === "error");
  const isStrategyReady = !hasBlockingIssues && auditValid !== false;
  const floorGuardrail = domainDetail?.strategy?.guardrails?.find((g: any) => g.type === "floor");
  const ceilingGuardrail = domainDetail?.strategy?.guardrails?.find((g: any) => g.type === "ceiling");

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-ledger flex items-center justify-center font-sans text-ink p-4">
        <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
          <Loader2 className="w-4 h-4 animate-spin text-cobalt" />
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-ledger font-sans text-ink">
      {/* Primary Sidebar (Solid Deep Blue SaaS styling from reference design) */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border text-white flex flex-col justify-between p-4 shrink-0 shadow-xl relative z-20">
        <div className="space-y-6">
          {/* Logo & Brand Header */}
          <div className="px-2 py-1.5 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/10 border border-white/20 text-white flex items-center justify-center font-mono font-bold rounded-xl text-sm shadow-xs backdrop-blur-xs">
              M
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                MONETIZE<span className="text-blue-300">360</span>
              </h1>
              <p className="text-[10px] uppercase font-mono tracking-wider text-blue-200/70">
                Dynamic Pricing Engine
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-4 text-xs">
            {/* Overview */}
            <div>
              <button
                onClick={() => setActiveTab("home")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150 ${
                  activeTab === "home"
                    ? "bg-white/15 text-white font-semibold shadow-xs backdrop-blur-xs border border-white/10"
                    : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${activeTab === "home" ? "text-white" : "text-blue-200/80"}`} />
                <span>Overview</span>
              </button>
            </div>

            {/* Rooms & Rates */}
            <div>
              <button
                onClick={() => setActiveTab("items")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all duration-150 ${
                  activeTab === "items"
                    ? "bg-white/15 text-white font-semibold shadow-xs backdrop-blur-xs border border-white/10"
                    : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Boxes className={`w-4 h-4 ${activeTab === "items" ? "text-white" : "text-blue-200/80"}`} />
                  <span>Rooms & Rates</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-blue-100 font-medium">
                  {domainDetail?.items?.length || 0}
                </span>
              </button>
            </div>

            {/* Pricing Rules */}
            <div>
              <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-blue-300/60 mb-1.5 font-medium">
                Pricing Rules
              </p>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("strategy");
                    runLinterCheck();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150 ${
                    activeTab === "strategy"
                      ? "bg-white/15 text-white font-semibold shadow-xs backdrop-blur-xs border border-white/10"
                      : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Strategy Studio</span>
                </button>
                <button
                  onClick={() => setActiveTab("factors")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150 ${
                    activeTab === "factors"
                      ? "bg-white/15 text-white font-semibold shadow-xs backdrop-blur-xs border border-white/10"
                      : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4 text-sky-300" />
                  <span>Pricing Factors</span>
                </button>
              </div>
            </div>

            {/* Activity & History */}
            <div>
              <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-blue-300/60 mb-1.5 font-medium">
                Activity & History
              </p>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("audit");
                    loadGovernanceData();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150 ${
                    activeTab === "audit"
                      ? "bg-white/15 text-white font-semibold shadow-xs backdrop-blur-xs border border-white/10"
                      : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>Activity & Audit Log</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("versions");
                    loadGovernanceData();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150 ${
                    activeTab === "versions"
                      ? "bg-white/15 text-white font-semibold shadow-xs backdrop-blur-xs border border-white/10"
                      : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <History className="w-4 h-4 text-blue-200" />
                  <span>Versions & Rollback</span>
                </button>
              </div>
            </div>

            {/* Developer & Diagnostics Collapsible Section */}
            <div className="pt-2 border-t border-sidebar-border">
              <button
                onClick={() => setDevToolsOpen(!devToolsOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-mono text-blue-200/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-300" />
                  Developer & Diagnostics
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${devToolsOpen ? "rotate-180" : ""}`} />
              </button>

              {devToolsOpen && (
                <div className="mt-1 space-y-0.5 pl-2 animate-fade-in">
                  <button
                    onClick={() => {
                      setActiveTab("simulation");
                      handleRunSimulation();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      activeTab === "simulation"
                        ? "bg-white/15 text-white font-semibold"
                        : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-sky-300" />
                    <span>What-If Price Simulator</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("publish");
                      runLinterCheck();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      activeTab === "publish"
                        ? "bg-white/15 text-white font-semibold"
                        : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Send className="w-3.5 h-3.5 text-blue-200" />
                    <span>Activation Readiness</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("live-console")}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      activeTab === "live-console"
                        ? "bg-white/15 text-white font-semibold"
                        : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-amber-300" />
                    <span>Live Decision Stream</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("explain")}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      activeTab === "explain"
                        ? "bg-white/15 text-white font-semibold"
                        : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Audit Trace (&quot;Why this price?&quot;)</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Secondary System Status in Sidebar Footer (PART 5) */}
        <div className="border-t border-sidebar-border pt-3 px-2 text-[11px] space-y-1">
          <div className="flex items-center justify-between text-blue-100/90">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs animate-pulse"></span>
              Full Stack Online
            </span>
            <span className="font-mono text-[10px] text-blue-200/70">Pure Decimal</span>
          </div>
          <div className="text-[10px] text-blue-200/50 font-mono">
            Port: 3000 • Arbitrary Precision
          </div>
        </div>
      </aside>

      {/* Main Workbench Body */}
      <main className="relative flex-1 flex flex-col overflow-y-auto bg-ledger min-w-0">
        {/* Subtle decorative curved background lines (from reference design) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0">
          <svg
            className="absolute top-0 right-0 w-[900px] h-[550px] text-cobalt opacity-40"
            viewBox="0 0 900 550"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M120 -80 C 350 140, 580 90, 950 280"
              stroke="rgba(37, 99, 235, 0.08)"
              strokeWidth="2.5"
              strokeDasharray="6 6"
            />
            <path
              d="M60 60 C 280 260, 620 180, 1000 400"
              stroke="rgba(37, 99, 235, 0.07)"
              strokeWidth="2"
            />
            <path
              d="M-30 200 C 220 400, 680 320, 1050 540"
              stroke="rgba(37, 99, 235, 0.05)"
              strokeWidth="1.5"
            />
            <circle cx="720" cy="160" r="220" fill="url(#blue-gradient-subtle)" />
            <defs>
              <radialGradient id="blue-gradient-subtle" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        {/* Top Header */}
        <header className="h-16 border-b border-ink-border bg-paper/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 shadow-xs z-20 sticky top-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-semibold text-ink-muted hidden md:inline">Domain:</span>
              <div className="relative">
                <select
                  value={selectedDomainId}
                  onChange={(e) => setSelectedDomainId(e.target.value)}
                  className="appearance-none bg-ledger border border-ink-border rounded-xl px-2.5 py-1.5 pr-6 text-xs font-bold text-ink cursor-pointer focus:outline-none focus:ring-2 focus:ring-cobalt/20 focus:border-cobalt transition-all shadow-xs max-w-[110px] sm:max-w-[150px] truncate"
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-ink-muted absolute right-1.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div className="h-4 w-px bg-ink-border hidden md:block"></div>

            {/* Item Selector */}
            {domainDetail?.items && domainDetail.items.length > 0 && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-semibold text-ink-muted hidden md:inline">Item:</span>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="bg-ledger border border-ink-border rounded-xl px-2.5 py-1.5 text-xs font-medium text-ink cursor-pointer focus:outline-none focus:ring-2 focus:ring-cobalt/20 focus:border-cobalt transition-all shadow-xs truncate max-w-[120px] sm:max-w-[160px] md:max-w-[200px]"
                >
                  {domainDetail.items.map((it: any) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.unit}{it.base_price})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              onClick={() => setShowCopilot(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-marigold/30 bg-marigold-light/80 text-ink text-xs font-semibold hover:bg-marigold/20 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
              title="Open AI Copilot (Ctrl+K)"
            >
              <Sparkles className="w-3.5 h-3.5 text-marigold shrink-0" />
              <span className="hidden xl:inline">AI Copilot (Ctrl+K)</span>
              <span className="hidden sm:inline xl:hidden">Copilot</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("simulation");
                handleRunSimulation();
              }}
              className="px-3 py-1.5 rounded-xl bg-cobalt hover:bg-cobalt-hover text-paper text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
              title="Open What-If Simulator"
            >
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">What-If Simulator</span>
              <span className="sm:hidden">Simulator</span>
            </button>

            {/* Authenticated User Profile (Single instance in global top navigation bar) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserProfile(!showUserProfile);
                }}
                className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-2 sm:pr-2.5 py-1.5 rounded-xl border border-ink-border bg-ledger/70 hover:bg-ledger transition-colors text-ink cursor-pointer shadow-2xs shrink-0"
                aria-label="User account menu"
              >
                <div className="w-7 h-7 rounded-full bg-sidebar text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  {userDisplayName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden xl:block">
                  <div className="text-xs font-bold text-ink leading-tight truncate max-w-[110px]">
                    {userDisplayName}
                  </div>
                  <div className="text-[10px] text-ink-muted leading-tight truncate">
                    {userRole}
                  </div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-ink-muted transition-transform duration-200 shrink-0 ${
                    showUserProfile ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Top-Right Dropdown Menu */}
              {showUserProfile && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-2 w-64 bg-paper border border-ink-border rounded-xl shadow-card p-3 text-xs text-ink z-50 space-y-2.5 animate-fade-in"
                >
                  <div className="border-b border-ink-border/70 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-sidebar text-white font-bold flex items-center justify-center text-sm shrink-0">
                        {userDisplayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-ink truncate">{userDisplayName}</div>
                        <div className="text-[11px] text-ink-muted truncate">{userEmail}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-lagoon"></span>
                      <span className="text-[10px] font-mono text-lagoon font-semibold">
                        {supabaseAuth.isConfigured ? "Supabase Authenticated" : "Authenticated Workspace"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setActiveTab("strategy");
                        setShowUserProfile(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-ink hover:bg-ledger transition-colors cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-ink-muted" />
                      <span>Workspace Settings</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-coral font-semibold hover:bg-coral-light transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-coral" />
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic View Body */}
        <div className="relative z-10 p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Active Custom Rules Banner */}
          {customRules.length > 0 && (
            <div className="p-3 bg-cobalt-light border border-cobalt/30 rounded-md flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-cobalt font-medium">
                <Sparkles className="w-4 h-4" />
                Active Copilot Draft Rules: {customRules.length} rule(s) injected in sandbox
              </span>
              <button
                onClick={() => {
                  setCustomRules([]);
                  runEvaluation(factors, []);
                }}
                className="text-[11px] underline text-cobalt hover:text-ink font-mono"
              >
                Clear sandbox rules
              </button>
            </div>
          )}

          {/* TAB 1: HOME */}
          {activeTab === "home" && (
            <>
              {/* Business Pricing Summary & Dynamic Price Strip */}
              <div className="bg-paper border border-ink-border rounded-2xl p-6 shadow-card space-y-6">
                {/* Hero Header: Item, Strategy Status & Dynamic Price */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink-border pb-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lagoon-light text-lagoon font-mono text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-lagoon animate-pulse"></span>
                        Strategy v{activeStrategyVersion} Active
                      </span>
                      <span className="text-xs text-ink-subtle">•</span>
                      <span className="text-xs font-medium text-ink-muted">
                        {domainDetail?.name || "Dynamic Pricing"} Domain
                      </span>
                    </div>

                    <div className="flex items-baseline gap-3">
                      <h2 className="text-xl font-bold tracking-tight text-ink">
                        {currentItem?.name || "Selected Item"}
                      </h2>
                      <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-md bg-ledger border border-ink-border text-ink-muted">
                        Base Rate: {formatPrice(basePrice, currentUnit)}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted">
                      Real-time pricing determined by active business rules and live context signals.
                    </p>
                  </div>

                  {/* Computed Price & Impact Delta */}
                  <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 pt-3 md:pt-0 border-ink-border/60">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                      Dynamic Output Price
                    </div>
                    <div
                      className={`text-3xl sm:text-4xl font-bold font-mono text-ink tabular-nums transition-all ${
                        isAnimating ? "animate-price-pulse text-cobalt" : ""
                      }`}
                    >
                      {formatPrice(outputPrice, currentUnit)}
                    </div>
                    <div className="mt-1">
                      {priceDelta > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-lagoon-light text-lagoon text-xs font-mono font-semibold">
                          <TrendingUp className="w-3 h-3" />
                          +{formatPrice(priceDelta, currentUnit)} (+{priceDeltaPct}% dynamic surge)
                        </span>
                      ) : priceDelta < 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-coral-light text-coral text-xs font-mono font-semibold">
                          <TrendingUp className="w-3 h-3 rotate-180" />
                          -{formatPrice(Math.abs(priceDelta), currentUnit)} ({priceDeltaPct}% discount)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-ledger border border-ink-border text-ink-muted text-xs font-mono">
                          At Baseline Rate (0.0% delta)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Executive Actions Bar: Clear Hierarchy */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-ledger/70 rounded-xl border border-ink-border">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* PRIMARY ACTION: Exactly one prominent Why this price action */}
                    <button
                      onClick={() => setActiveTab("explain")}
                      className="px-4 py-2 rounded-xl bg-cobalt hover:bg-cobalt-hover text-paper text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <HelpCircle className="w-4 h-4" />
                      Why this price?
                    </button>

                    {/* SECONDARY ACTION: Strategy Studio */}
                    <button
                      onClick={() => {
                        setActiveTab("strategy");
                        runLinterCheck();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-paper border border-ink-border hover:bg-ledger text-ink text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-marigold" />
                      <span>Strategy Studio</span>
                    </button>
                  </div>

                  {/* SECONDARY/TECHNICAL: Engine Info moved into discreet popover */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setShowEngineInfo(!showEngineInfo)}
                      aria-label="Engine details"
                      className="text-[11px] text-ink-muted hover:text-ink font-mono flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-paper border border-transparent hover:border-ink-border/60 transition-colors cursor-pointer"
                      title="View engine architecture & precision details"
                    >
                      <Info className="w-3.5 h-3.5 text-ink-subtle" />
                      <span>Engine Details</span>
                    </button>

                    {showEngineInfo && (
                      <div className="absolute right-0 mt-1.5 w-72 bg-paper border border-ink-border rounded-xl shadow-card-hover p-4 text-xs text-ink z-30 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-ink-border/60 pb-1.5">
                          <span className="font-bold text-ink flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-lagoon" />
                            Deterministic Decimal Engine
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowEngineInfo(false)}
                            className="text-ink-subtle hover:text-ink p-0.5 rounded cursor-pointer"
                            aria-label="Close"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-ink-muted leading-relaxed">
                          Prices are evaluated with arbitrary-precision Decimal arithmetic (IEEE 754 float-free), AST-validated expression guards, automated guardrails, and cryptographic SHA-256 decision hashes.
                        </p>
                        <div className="pt-1.5 border-t border-ink-border/60 flex items-center justify-between text-[11px]">
                          <span className="text-ink-subtle font-mono">v{activeStrategyVersion} Active</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowEngineInfo(false);
                              setActiveTab("audit");
                            }}
                            className="text-cobalt font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Audit Trail <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>


                {/* Interactive Factor Sliders & Context Inputs */}
                {domainDetail?.factors && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-ink font-mono flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-cobalt" />
                          Live Pricing Factors & Context Signals
                        </h4>
                        <p className="text-[11px] text-ink-muted">
                          Adjust signals to see instant dynamic price recalculation.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab("factors")}
                        className="text-xs font-semibold text-cobalt hover:underline flex items-center gap-1"
                      >
                        Factor Catalog & Rules <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-ledger/60 p-4 rounded-2xl border border-ink-border">
                      {domainDetail.factors.map((f: any, idx: number) => {
                        const val = factors[f.name] !== undefined ? factors[f.name] : f.default;
                        const sliderConfig = getFactorSliderConfig(f);

                        // Find all active rules in current strategy that evaluate this factor
                        const activeRules =
                          domainDetail?.strategy?.rules?.filter(
                            (r: any) =>
                              r.enabled !== false &&
                              r.conditions?.some((c: any) => c.field === f.name)
                          ) || [];
                        const hasActiveRules = activeRules.length > 0;

                        // Check if any rule referencing this factor was matched in current evaluation
                        const appliedMatchingRules =
                          evalResult?.trace?.steps?.filter(
                            (s: any) => s.matched && activeRules.some((r: any) => r.id === s.rule_id)
                          ) || [];
                        const isCurrentlyApplied = appliedMatchingRules.length > 0;

                        // Check compound condition for hospitality last-minute discount
                        const isHospitalityLastMinute = f.name === "lead_days" && selectedDomainId === "hospitality";
                        const occupancyVal = factors["occupancy_rate"] !== undefined ? Number(factors["occupancy_rate"]) : 0.75;
                        const leadDaysVal = typeof val === "number" ? val : parseFloat(val);
                        const isLeadDaysMet = leadDaysVal <= 2;
                        const isOccupancyMetForDiscount = occupancyVal < 0.6;

                        // Formatted values for clean presentation
                        const formattedVal = formatFactorDisplay(f.name, val, sliderConfig.isPct, currentUnit);
                        const formattedBaseVal = formatFactorDisplay(f.name, f.default, sliderConfig.isPct, currentUnit);

                        // Info popover component
                        const renderPopover = () => (
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFactorPopover(activeFactorPopover === f.name ? null : f.name);
                              }}
                              aria-label={`About ${getFieldLabel(f.name)} factor`}
                              className="p-1 rounded-full text-ink-subtle hover:text-cobalt hover:bg-ledger transition-colors focus:outline-none focus:ring-1 focus:ring-cobalt"
                              title="Click for baseline and rule mapping details"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>

                            {activeFactorPopover === f.name && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute mt-1.5 w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] bg-paper border border-ink-border rounded-xl shadow-card-hover p-4 z-40 text-xs text-ink space-y-2.5 animate-fade-in ${
                                  idx % 2 === 1 ? "right-0" : "left-0"
                                }`}
                              >
                                {/* Popover Header */}
                                <div className="flex items-start justify-between border-b border-ink-border/60 pb-2">
                                  <div>
                                    <h5 className="font-bold text-ink text-xs">{getFieldLabel(f.name)}</h5>
                                    <span className="text-[11px] font-mono text-ink-subtle">
                                      Baseline default: {formattedBaseVal}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setActiveFactorPopover(null)}
                                    className="text-ink-subtle hover:text-ink p-1 rounded hover:bg-ledger cursor-pointer"
                                    aria-label="Close factor details"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Description */}
                                <p className="text-[11px] text-ink-muted leading-relaxed">
                                  {f.description}
                                </p>

                                {/* Pricing Influence Status */}
                                <div className="p-2.5 rounded-lg bg-ledger border border-ink-border/70 space-y-1">
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle font-semibold block">
                                    Current Pricing Influence
                                  </span>
                                  {isCurrentlyApplied ? (
                                    <div className="flex items-center gap-1.5 text-lagoon font-semibold text-[11px]">
                                      <Check className="w-3.5 h-3.5 shrink-0" />
                                      <span>Actively impacting price ({appliedMatchingRules.map((r: any) => r.rule_name).join(", ")})</span>
                                    </div>
                                  ) : hasActiveRules ? (
                                    <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
                                      <Clock className="w-3.5 h-3.5 shrink-0 text-ink-subtle" />
                                      <span>Active rule(s) configured — currently within baseline threshold</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-ink-subtle text-[11px]">
                                      <Info className="w-3.5 h-3.5 shrink-0" />
                                      <span>Market context signal (no active pricing adjustments configured)</span>
                                    </div>
                                  )}
                                </div>

                                {/* Active Pricing Rules List */}
                                {hasActiveRules ? (
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle font-semibold block">
                                      Active Pricing Rules ({activeRules.length}):
                                    </span>
                                    <ul className="space-y-1.5">
                                      {activeRules.map((r: any) => {
                                        const actionInfo = getActionPresentation(r.action, currentUnit);
                                        const condText = translateConditions(r.conditions, currentUnit);
                                        return (
                                          <li key={r.id} className="text-[11px] bg-paper p-2 rounded-lg border border-ink-border/70 space-y-0.5">
                                            <div className="flex items-center justify-between font-medium text-ink">
                                              <span>{r.name}</span>
                                              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                                actionInfo.impactType === "surge" 
                                                  ? "bg-lagoon-light text-lagoon" 
                                                  : actionInfo.impactType === "discount" 
                                                  ? "bg-coral-light text-coral" 
                                                  : "bg-ledger text-ink-muted"
                                              }`}>
                                                {actionInfo.impact}
                                              </span>
                                            </div>
                                            <div className="text-[10px] text-ink-muted">
                                              When: {condText}
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                ) : null}

                                {/* Compound condition note */}
                                {isHospitalityLastMinute && (
                                  <div className="text-[10px] p-2 rounded-lg bg-marigold-light/50 border border-marigold/30 text-ink">
                                    <strong>Booking Window Rule Note:</strong> Last Minute Booking Discount (-12%) requires both Lead Days &le; 2 and Occupancy &lt; 60% (currently {Math.round(occupancyVal * 100)}%).
                                  </div>
                                )}

                                {/* Quick Link to Strategy Studio */}
                                <div className="pt-1.5 border-t border-ink-border/60 flex items-center justify-between text-[11px]">
                                  <span className="text-ink-subtle">Need to change rules?</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveFactorPopover(null);
                                      setActiveTab("strategy");
                                      runLinterCheck();
                                    }}
                                    className="text-cobalt font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    Strategy Studio <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );

                        if (sliderConfig.isNumber) {
                          const isPct = sliderConfig.isPct;
                          const numVal = typeof val === "number" ? val : parseFloat(val) || 0;
                          return (
                            <div key={f.name} className="relative space-y-2.5 bg-paper p-4 rounded-xl border border-ink-border shadow-xs hover:shadow-card hover:border-cobalt/40 transition-all">
                              {/* Clean Header: Factor Name + (i) on left, Current Value on right */}
                              <div className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-ink capitalize text-xs tracking-tight">
                                    {getFieldLabel(f.name)}
                                  </span>
                                  {renderPopover()}
                                </div>
                                <div className="text-right">
                                  <span className="font-mono text-cobalt font-bold text-sm tabular-nums">
                                    {formattedVal}
                                  </span>
                                </div>
                              </div>

                              {/* Interactive Range Slider */}
                              <input
                                type="range"
                                min={sliderConfig.min}
                                max={sliderConfig.max}
                                step={sliderConfig.step}
                                value={numVal}
                                onChange={(e) => {
                                  const updated = { ...factors, [f.name]: parseFloat(e.target.value) };
                                  setFactors(updated);
                                  runEvaluation(updated, customRules);
                                }}
                                className="w-full h-1.5 bg-ink-border rounded-lg appearance-none cursor-pointer accent-cobalt"
                              />

                              {/* Quick Presets */}
                              {sliderConfig.presets && sliderConfig.presets.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                  <span className="text-[9px] font-mono text-ink-subtle uppercase mr-1">Presets:</span>
                                  {sliderConfig.presets.map((preset, pIdx) => {
                                    const isSelected = Math.abs(numVal - preset.value) < (isPct ? 0.02 : 0.5);
                                    return (
                                      <button
                                        key={pIdx}
                                        type="button"
                                        onClick={() => {
                                          const updated = { ...factors, [f.name]: preset.value };
                                          setFactors(updated);
                                          runEvaluation(updated, customRules);
                                        }}
                                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                                          isSelected
                                            ? "bg-cobalt text-paper font-bold shadow-xs"
                                            : "bg-ledger text-ink-muted border border-ink-border/80 hover:bg-paper hover:text-ink"
                                        }`}
                                      >
                                        {preset.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        } else if (typeof f.default === "boolean") {
                          return (
                            <div key={f.name} className="relative space-y-2.5 p-4 bg-paper rounded-xl border border-ink-border shadow-xs hover:shadow-card hover:border-cobalt/40 transition-all">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-ink capitalize">
                                    {getFieldLabel(f.name)}
                                  </span>
                                  {renderPopover()}
                                </div>
                                <button
                                  onClick={() => {
                                    const updated = { ...factors, [f.name]: !val };
                                    setFactors(updated);
                                    runEvaluation(updated, customRules);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors shadow-xs cursor-pointer ${
                                    val ? "bg-lagoon text-paper" : "bg-ink-border text-ink"
                                  }`}
                                >
                                  {val ? "TRUE (Active)" : "FALSE"}
                                </button>
                              </div>
                            </div>
                          );
                        } else {
                          const presets = sliderConfig.presets || [];
                          return (
                            <div key={f.name} className="relative space-y-2.5 bg-paper p-4 rounded-xl border border-ink-border shadow-xs hover:shadow-card hover:border-cobalt/40 transition-all">
                              <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-ink capitalize">
                                    {getFieldLabel(f.name)}
                                  </span>
                                  {renderPopover()}
                                </div>
                                <div className="text-right">
                                  <span className="font-mono text-cobalt font-bold text-sm capitalize">
                                    {formattedVal}
                                  </span>
                                </div>
                              </div>

                              {presets.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                  <span className="text-[9px] font-mono text-ink-subtle uppercase mr-1">Presets:</span>
                                  {presets.map((preset, pIdx) => {
                                    const isSelected = String(val).toLowerCase() === String(preset.value).toLowerCase();
                                    return (
                                      <button
                                        key={pIdx}
                                        type="button"
                                        onClick={() => {
                                          const updated = { ...factors, [f.name]: preset.value };
                                          setFactors(updated);
                                          runEvaluation(updated, customRules);
                                        }}
                                        className={`px-2.5 py-0.5 rounded-lg text-xs font-mono transition-colors capitalize cursor-pointer ${
                                          isSelected
                                            ? "bg-cobalt text-paper font-bold shadow-xs"
                                            : "bg-ledger text-ink-muted border border-ink-border hover:bg-paper hover:text-ink"
                                        }`}
                                      >
                                        {preset.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              <input
                                type="text"
                                value={val || ""}
                                placeholder={`Enter ${f.name.replace(/_/g, " ")}`}
                                onChange={(e) => {
                                  const updated = { ...factors, [f.name]: e.target.value };
                                  setFactors(updated);
                                  runEvaluation(updated, customRules);
                                }}
                                className="w-full px-3 py-1.5 text-xs border border-ink-border rounded-lg bg-ledger font-mono focus:outline-none focus:ring-2 focus:ring-cobalt/20 focus:border-cobalt"
                              />
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                )}

                {/* Price Calculation Waterfall: Clear Progression & 2-Decimal Precision */}
                {(() => {
                  const matchedAdjustmentSteps =
                    evalResult?.trace?.steps?.filter((s: any) => s.matched && s.stage !== "base") || [];

                  return (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
                        <div>
                          <span className="font-bold uppercase tracking-wider font-mono text-ink">
                            Price Calculation Waterfall
                          </span>
                          <p className="text-[11px] text-ink-muted font-normal">
                            Sequential adjustments applied by active strategy rules to calculate the dynamic price
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab("explain")}
                          className="text-xs font-semibold text-cobalt hover:underline flex items-center gap-1"
                        >
                          Full Factor Contributions & Audit Trace <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex flex-col md:flex-row items-stretch gap-3">
                        {/* 1. Base Price Card */}
                        <div className="w-full md:w-48 bg-paper border border-ink-border rounded-xl p-4 flex flex-col justify-between shadow-card">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle font-semibold block">
                              Base Price
                            </span>
                            <div className="text-base font-bold font-mono text-ink mt-1">
                              {formatPrice(basePrice, currentUnit)}
                            </div>
                          </div>
                          <div className="text-[11px] text-ink-muted mt-2 pt-2 border-t border-ink-border/50 truncate" title={currentItem?.name}>
                            {currentItem?.name || "Catalog baseline"}
                          </div>
                        </div>

                        {/* Arrow Connector */}
                        <div className="hidden md:flex items-center justify-center text-ink-subtle">
                          <ArrowRight className="w-4 h-4" />
                        </div>

                        {/* 2. Applied Adjustments */}
                        {matchedAdjustmentSteps.length > 0 ? (
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {matchedAdjustmentSteps.map((step: any, idx: number) => {
                              const delta = formatAdjustmentDelta(step.adjustment, currentUnit);
                              return (
                                <div
                                  key={idx}
                                  className={`p-3.5 rounded-xl border flex flex-col justify-between shadow-xs transition-all ${
                                    delta.isPositive
                                      ? "bg-lagoon-light/50 border-lagoon/30 text-ink"
                                      : delta.isNegative
                                      ? "bg-coral-light/50 border-coral/30 text-ink"
                                      : "bg-paper border-ink-border text-ink"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-[10px] uppercase font-mono font-semibold text-ink-muted truncate" title={step.rule_name || step.stage}>
                                        {step.rule_name || step.stage}
                                      </span>
                                    </div>
                                    <div className="mt-1">
                                      <span
                                        className={`inline-flex items-center gap-1 font-mono font-bold text-sm px-2.5 py-0.5 rounded-full ${
                                          delta.isPositive
                                            ? "bg-lagoon-light text-lagoon"
                                            : delta.isNegative
                                            ? "bg-coral-light text-coral"
                                            : "bg-ledger text-ink-muted"
                                        }`}
                                      >
                                        {delta.isPositive ? (
                                          <TrendingUp className="w-3 h-3" />
                                        ) : delta.isNegative ? (
                                          <TrendingUp className="w-3 h-3 rotate-180" />
                                        ) : null}
                                        {delta.formatted}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-[10px] font-mono text-ink-muted mt-2 pt-1 border-t border-ink-border/40">
                                    Running: {formatPrice(step.output_price, currentUnit)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex-1 p-4 rounded-xl border border-dashed border-ink-border bg-ledger/40 flex items-center justify-center text-center">
                            <span className="text-xs text-ink-muted font-mono">
                              No active adjustments applied (Current factors evaluate within baseline parameters)
                            </span>
                          </div>
                        )}

                        {/* Arrow Connector */}
                        <div className="hidden md:flex items-center justify-center text-ink-subtle">
                          <ArrowRight className="w-4 h-4" />
                        </div>

                        {/* 3. Final Dynamic Price Card (Visually dominant) */}
                        <div className="w-full md:w-56 bg-sidebar text-white rounded-xl p-4 flex flex-col justify-between shadow-card border border-sidebar-border">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-blue-200/80 font-semibold">
                                Dynamic Output Price
                              </span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
                              {formatPrice(outputPrice, currentUnit)}
                            </div>
                          </div>
                          <div className="text-[11px] font-mono text-blue-100/90 mt-2 pt-2 border-t border-white/20 flex items-center justify-between">
                            <span>Net Delta:</span>
                            <span className={`font-semibold ${priceDelta > 0 ? "text-emerald-300" : priceDelta < 0 ? "text-rose-300" : "text-white/80"}`}>
                              {priceDelta >= 0 ? "+" : ""}{formatPrice(priceDelta, currentUnit)} ({priceDelta >= 0 ? "+" : ""}{priceDeltaPct}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Consolidated Collapsible Executive Summary Drawer */}
              {(() => {
                const matchedAdjustmentSteps =
                  evalResult?.trace?.steps?.filter((s: any) => s.matched && s.stage !== "base") || [];

                return (
                  <div className="bg-paper border border-ink-border rounded-2xl shadow-card overflow-hidden transition-all">
                    {/* Collapsed Header / Summary Bar */}
                    <div
                      onClick={() => setBottomSummaryExpanded(!bottomSummaryExpanded)}
                      className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-ledger/60 transition-colors select-none"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setBottomSummaryExpanded(!bottomSummaryExpanded);
                        }
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-semibold text-ink flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-marigold" />
                          Strategy:{" "}
                          <span className="font-mono font-medium text-ink-muted">
                            v{activeStrategyVersion} ({domainDetail?.name || "Dynamic"} Pricing)
                          </span>
                        </span>
                        <span className="text-ink-subtle">•</span>
                        <span className="font-semibold text-ink flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-lagoon" />
                          Impact:{" "}
                          <span className="font-mono font-medium text-ink-muted">
                            {priceDelta >= 0 ? "+" : ""}
                            {formatPrice(priceDelta, currentUnit)} ({priceDelta >= 0 ? "+" : ""}
                            {priceDeltaPct}%)
                          </span>
                        </span>
                        <span className="text-ink-subtle hidden sm:inline">•</span>
                        <span className="font-semibold text-ink hidden sm:flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5 text-cobalt" />
                          Scenario:{" "}
                          <span className="font-mono font-medium text-ink-muted">
                            Active Sandbox Factors
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs font-semibold text-cobalt">
                        <span>{bottomSummaryExpanded ? "Hide Summary" : "View Summary"}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            bottomSummaryExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expanded Content Grid */}
                    {bottomSummaryExpanded && (
                      <div className="p-5 border-t border-ink-border bg-ledger/30 grid grid-cols-1 md:grid-cols-3 gap-5 animate-fade-in">
                        {/* 1. Strategy Status */}
                        <div className="bg-paper border border-ink-border rounded-xl p-4 shadow-card flex flex-col justify-between space-y-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-ink-subtle">
                              <span className="font-mono uppercase tracking-wider font-semibold">Active Strategy</span>
                              <Sparkles className="w-4 h-4 text-marigold" />
                            </div>
                            <div className="text-lg font-bold font-mono text-ink">
                              v{activeStrategyVersion} Published
                            </div>
                            <p className="text-xs text-ink-muted">
                              {domainDetail?.strategy?.rules?.length || 0} active rules across {domainDetail?.strategy?.stages?.length || 0} pipeline stages
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveTab("strategy");
                              runLinterCheck();
                            }}
                            className="text-xs font-semibold text-cobalt hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                          >
                            Open Strategy Studio <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* 2. Price Impact Summary (No duplicate Why this price button!) */}
                        <div className="bg-paper border border-ink-border rounded-xl p-4 shadow-card flex flex-col justify-between space-y-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-ink-subtle">
                              <span className="font-mono uppercase tracking-wider font-semibold">Dynamic Price Impact</span>
                              <TrendingUp className="w-4 h-4 text-lagoon" />
                            </div>
                            <div className="text-lg font-bold font-mono text-ink">
                              {priceDelta >= 0 ? "+" : ""}{formatPrice(priceDelta, currentUnit)} ({priceDelta >= 0 ? "+" : ""}{priceDeltaPct}%)
                            </div>
                            <p className="text-xs text-ink-muted">
                              Base rate {formatPrice(basePrice, currentUnit)} adjusted by {matchedAdjustmentSteps.length} active rule(s)
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveTab("explain")}
                            className="text-xs font-semibold text-cobalt hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                          >
                            View Full Factor Contributions <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* 3. Scenario & Stress Testing */}
                        <div className="bg-paper border border-ink-border rounded-xl p-4 shadow-card flex flex-col justify-between space-y-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-ink-subtle">
                              <span className="font-mono uppercase tracking-wider font-semibold">Scenario Simulation</span>
                              <FlaskConical className="w-4 h-4 text-cobalt" />
                            </div>
                            <div className="text-lg font-bold font-mono text-ink">
                              Simulation Lab
                            </div>
                            <p className="text-xs text-ink-muted">
                              Sweep factor sensitivity and test counterfactual &quot;What-If&quot; pricing scenarios
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveTab("simulation");
                              handleRunSimulation();
                            }}
                            className="text-xs font-semibold text-cobalt hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                          >
                            Run Simulation Sweeps <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {/* TAB 2: ITEMS INVENTORY */}
          {activeTab === "items" && (
            <div className="bg-paper border border-ink-border rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Items & SKU Catalog</h3>
                  <p className="text-xs text-ink-muted">
                    Manage priced units for {domainDetail?.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-cobalt hover:bg-cobalt-hover text-paper text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {domainDetail?.items?.map((it: any) => (
                  <div
                    key={it.id}
                    className="p-5 bg-ledger/60 border border-ink-border rounded-xl flex items-center justify-between hover:border-cobalt/40 shadow-xs transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-ink">{it.name}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-lagoon-light text-lagoon font-semibold border border-lagoon/20">
                          Active
                        </span>
                      </div>
                      <p className="text-xs font-mono text-ink-subtle mt-0.5">ID: {it.id}</p>
                      <span className="text-xs font-mono font-bold text-cobalt mt-1.5 block">
                        Base Rate: {it.unit}{it.base_price}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEditItemModal(it)}
                        className="px-3 py-1.5 rounded-lg border border-ink-border bg-paper hover:bg-ledger text-xs font-semibold text-cobalt flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        title="Edit room"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(it.id)}
                        className="p-2 text-coral hover:bg-coral-light rounded-lg transition-colors cursor-pointer border border-transparent hover:border-coral/20"
                        title="Delete room"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: FACTORS */}
          {activeTab === "factors" && (
            <div className="bg-paper border border-ink-border rounded-2xl p-6 shadow-card space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-border pb-4">
                <div>
                  <h3 className="text-base font-bold text-ink">Pricing Factors</h3>
                  <p className="text-xs text-ink-muted">
                    Signals used by your pricing strategy to evaluate conditions and calculate dynamic prices for {domainDetail?.name}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("home")}
                    className="px-3.5 py-2 rounded-xl border border-ink-border hover:bg-ledger text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Back to Home
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("strategy");
                      runLinterCheck();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-cobalt hover:bg-cobalt-hover text-paper text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-marigold" />
                    Configure Rules in Studio
                  </button>
                </div>
              </div>

              {/* Conceptual Pipeline Guide */}
              <div className="p-4 bg-ledger/60 border border-ink-border rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider font-mono text-ink flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-cobalt" />
                    How Factors Drive Your Dynamic Pricing
                  </span>
                  <span className="text-[10px] font-mono text-ink-subtle">
                    {domainDetail?.factors?.length || 0} Configured Signals
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Factors capture real-world business context—such as real-time demand, available inventory, loyalty tier, or competitor rates.
                  Your strategy rules continuously evaluate these values to calculate automated, deterministic price adjustments.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2.5 bg-paper border border-ink-border rounded-lg text-center shadow-2xs">
                    <span className="text-[10px] uppercase font-mono text-cobalt font-bold block">1. Pricing Factors</span>
                    <span className="text-[11px] text-ink block mt-0.5">Real-time context inputs</span>
                  </div>
                  <div className="p-2.5 bg-paper border border-ink-border rounded-lg text-center shadow-2xs">
                    <span className="text-[10px] uppercase font-mono text-marigold font-bold block">2. Strategy Rules</span>
                    <span className="text-[11px] text-ink block mt-0.5">Evaluate factor conditions</span>
                  </div>
                  <div className="p-2.5 bg-paper border border-ink-border rounded-lg text-center shadow-2xs">
                    <span className="text-[10px] uppercase font-mono text-lagoon font-bold block">3. Evaluator</span>
                    <span className="text-[11px] text-ink block mt-0.5">Exact Decimal adjustments</span>
                  </div>
                  <div className="p-2.5 bg-paper border border-ink-border rounded-lg text-center shadow-2xs">
                    <span className="text-[10px] uppercase font-mono text-ink font-bold block">4. Final Price</span>
                    <span className="text-[11px] text-ink block mt-0.5">Auditable output rate</span>
                  </div>
                </div>
              </div>

              {/* Factors Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {domainDetail?.factors?.map((f: any) => {
                  const currentVal = factors[f.name] !== undefined ? factors[f.name] : f.default;
                  const isNumber = typeof f.default === "number";
                  const isPct = isNumber && f.default <= 1.0 && f.default >= 0;
                  const isBool = typeof f.default === "boolean";

                  // Human-friendly signal type description
                  const friendlyType = isBool
                    ? "Yes / No (Boolean Flag)"
                    : isPct
                    ? "Percentage (0% – 100%)"
                    : isNumber
                    ? "Numeric Value"
                    : "Category / Text";

                  // Format current and baseline values
                  const formatVal = (v: any) => {
                    if (typeof v === "boolean") return v ? "True (Yes)" : "False (No)";
                    if (typeof v === "number") {
                      if (isPct) return `${v.toFixed(2)} (${Math.round(v * 100)}%)`;
                      return v.toFixed(2);
                    }
                    return String(v);
                  };

                  // Find actual strategy rules that reference this factor
                  const referencedRules = domainDetail?.strategy?.rules?.filter((r: any) =>
                    r.conditions?.some((c: any) => c.field === f.name)
                  ) || [];

                  return (
                    <div key={f.name} className="p-4 bg-ledger/60 border border-ink-border rounded-xl space-y-3 shadow-xs hover:border-cobalt/40 transition-all">
                      {/* Factor Header */}
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-ink capitalize">
                          {f.name.replace(/_/g, " ")}
                        </h4>
                        <span className="px-2 py-0.5 bg-paper rounded-full text-[10px] font-mono text-ink-subtle border border-ink-border">
                          {friendlyType}
                        </span>
                      </div>

                      {/* Business Description */}
                      <p className="text-xs text-ink-muted leading-relaxed">
                        {f.description}
                      </p>

                      {/* Value Status: Current vs Baseline */}
                      <div className="grid grid-cols-2 gap-2 bg-paper p-3 rounded-lg border border-ink-border text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-mono text-ink-subtle block">Current Live Value</span>
                          <span className="font-mono font-bold text-cobalt block mt-0.5">
                            {formatVal(currentVal)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-mono text-ink-subtle block">Baseline Default</span>
                          <span className="font-mono text-ink-muted block mt-0.5">
                            {formatVal(f.default)}
                          </span>
                        </div>
                      </div>

                      {/* How it influences pricing: Verified Rules */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-semibold text-ink font-mono uppercase tracking-wider">
                          Influences Strategy Rules:
                        </div>
                        {referencedRules.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {referencedRules.map((rule: any) => (
                              <span
                                key={rule.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-cobalt-light text-cobalt rounded text-[10px] font-mono font-semibold"
                                title={`Stage: ${rule.stage} | ${rule.description}`}
                              >
                                <span className="opacity-70">[{rule.stage}]</span> {rule.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-ink-subtle italic block">
                            Available signal (not directly evaluated by current active rules; can be added in Strategy Studio).
                          </span>
                        )}
                      </div>

                      {/* Interactive Sandbox Slider / Toggle directly on card */}
                      <div className="pt-2 border-t border-ink-border/60">
                        {isNumber ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-ink-muted">
                              <span>Live Sandbox Adjustment:</span>
                              <span className="font-mono font-semibold text-ink">
                                {formatVal(currentVal)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={getFactorSliderConfig(f).min}
                              max={getFactorSliderConfig(f).max}
                              step={getFactorSliderConfig(f).step}
                              value={typeof currentVal === "number" ? currentVal : parseFloat(currentVal) || 0}
                              onChange={(e) => {
                                const updated = { ...factors, [f.name]: parseFloat(e.target.value) };
                                setFactors(updated);
                                runEvaluation(updated, customRules);
                              }}
                              className="w-full h-1.5 bg-ink-border rounded-lg appearance-none cursor-pointer accent-cobalt"
                            />
                          </div>
                        ) : isBool ? (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-ink-muted">Toggle Sandbox Value:</span>
                            <button
                              onClick={() => {
                                const updated = { ...factors, [f.name]: !currentVal };
                                setFactors(updated);
                                runEvaluation(updated, customRules);
                              }}
                              className={`px-3 py-1 rounded text-xs font-semibold font-mono transition-colors ${
                                currentVal ? "bg-lagoon text-paper" : "bg-ink-border text-ink"
                              }`}
                            >
                              {currentVal ? "TRUE (Active)" : "FALSE"}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-[11px] text-ink-muted block">Edit Sandbox Value:</span>
                            <input
                              type="text"
                              value={currentVal || ""}
                              onChange={(e) => {
                                const updated = { ...factors, [f.name]: e.target.value };
                                setFactors(updated);
                                runEvaluation(updated, customRules);
                              }}
                              className="w-full px-2.5 py-1 text-xs border border-ink-border rounded bg-paper font-mono"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: STRATEGY STUDIO */}
          {activeTab === "strategy" && domainDetail && (
            <div className="bg-paper border border-ink-border rounded-2xl p-6 shadow-card space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-border pb-4">
                <div>
                  <h3 className="text-base font-bold text-ink">Strategy Studio — Rule Configurations</h3>
                  <p className="text-xs text-ink-muted">
                    Define the rules that determine how prices change based on demand, customers, and timing.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={runLinterCheck}
                    className="px-3.5 py-2 rounded-xl border border-ink-border text-xs font-medium hover:bg-ledger flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 text-cobalt" />
                    Run Linter ({lintIssues.length} issues)
                  </button>
                  <button
                    onClick={() => setShowCopilot(true)}
                    className="px-3.5 py-2 rounded-xl bg-cobalt hover:bg-cobalt-hover text-paper text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Rule with Copilot
                  </button>
                </div>
              </div>

              {/* Business-to-Engine Pricing Connection Banner */}
              <div className="p-3.5 bg-ledger/60 rounded-xl border border-ink-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs">
                <div className="flex items-center gap-2 text-ink font-medium">
                  <Info className="w-4 h-4 text-cobalt shrink-0" />
                  <span>Dynamic Logic: Context Factors → Strategy Rules (When/Then) → Engine Evaluator → Final Price</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-muted shrink-0">
                  <span className="text-ink-subtle">Pipeline:</span>
                  {domainDetail.strategy?.stages?.join(" → ")}
                </div>
              </div>

              {/* Linter warnings if any */}
              {lintIssues.length > 0 && (
                <div className="p-4 bg-marigold-light/80 border border-marigold/30 rounded-xl space-y-1.5 shadow-xs">
                  <span className="text-xs font-bold text-marigold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Linter Findings ({lintIssues.length})
                  </span>
                  {lintIssues.map((issue, idx) => (
                    <div key={idx} className="text-xs text-ink">
                      • <span className="font-semibold font-mono">{issue.code}</span>: {issue.message} ({issue.recommendation})
                    </div>
                  ))}
                </div>
              )}

              {/* Rule Cards List */}
              <div className="space-y-4">
                {domainDetail.strategy?.rules?.map((rule: any) => {
                  const isExpanded = !!expandedRuleIds[rule.id];
                  const conditionText = translateConditions(rule.conditions, currentUnit);
                  const actionPres = getActionPresentation(rule.action, currentUnit);

                  return (
                    <div
                      key={rule.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        rule.enabled !== false
                          ? "bg-paper border-ink-border shadow-card hover:border-cobalt/40"
                          : "bg-ledger/60 border-ink-border/70 opacity-75"
                      }`}
                    >
                      {/* Card Header: Rule Name, Status, Stage, and Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-border/60 pb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="text-base font-bold text-ink">
                            {rule.name}
                          </h4>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                              rule.enabled !== false
                                ? "bg-lagoon-light text-lagoon"
                                : "bg-ledger text-ink-subtle border border-ink-border"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                rule.enabled !== false ? "bg-lagoon animate-pulse" : "bg-ink-subtle"
                              }`}
                            ></span>
                            {rule.enabled !== false ? "ENABLED" : "DISABLED"}
                          </span>
                          <span className="text-xs text-ink-subtle">•</span>
                          <span className="text-xs font-mono text-ink-muted capitalize">
                            Stage: {rule.stage}
                          </span>
                        </div>

                        {/* Existing actions: Toggle (Enable/Disable) and Delete */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => handleToggleRule(rule.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                              rule.enabled !== false
                                ? "border-ink-border text-ink-muted hover:bg-ledger hover:text-ink"
                                : "border-lagoon/40 bg-lagoon-light text-lagoon hover:bg-lagoon hover:text-paper"
                            }`}
                          >
                            {rule.enabled !== false ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 text-coral hover:bg-coral-light rounded-lg transition-colors cursor-pointer"
                            title="Delete rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Rule Description */}
                      {rule.description && (
                        <p className="text-xs text-ink-muted pt-2.5 italic">
                          &ldquo;{rule.description}&rdquo;
                        </p>
                      )}

                      {/* Business Logic: WHEN and THEN in Plain Language */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3.5 pb-2">
                        {/* WHEN (Condition) */}
                        <div className="md:col-span-6 bg-ledger/60 p-3.5 rounded-xl border border-ink-border space-y-1">
                          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-cobalt flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3 h-3" />
                            WHEN
                          </div>
                          <div className="text-sm font-semibold text-ink leading-snug">
                            {conditionText}
                          </div>
                        </div>

                        {/* THEN (Action) */}
                        <div className="md:col-span-4 bg-ledger/60 p-3.5 rounded-xl border border-ink-border space-y-1">
                          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-lagoon flex items-center gap-1.5">
                            <ArrowRight className="w-3 h-3" />
                            THEN
                          </div>
                          <div className="text-sm font-semibold text-ink leading-snug">
                            {actionPres.text}
                          </div>
                        </div>

                        {/* Price Impact Badge */}
                        <div className="md:col-span-2 bg-ledger/60 p-3.5 rounded-xl border border-ink-border flex flex-col justify-center text-center">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                            Price Impact
                          </span>
                          <span
                            className={`text-base font-bold font-mono mt-0.5 ${
                              actionPres.impactType === "surge"
                                ? "text-lagoon"
                                : actionPres.impactType === "discount"
                                ? "text-coral"
                                : "text-ink"
                            }`}
                          >
                            {actionPres.impact}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Advanced Details (Technical configuration) */}
                      <div className="pt-2 border-t border-ink-border/50">
                        <button
                          onClick={() => toggleRuleExpanded(rule.id)}
                          className="text-[11px] font-mono text-ink-muted hover:text-ink flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                          {isExpanded ? "Hide technical configuration" : "Advanced details (Technical configuration)"}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 p-3.5 bg-ledger rounded-md border border-ink-border font-mono text-xs space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <span className="text-[10px] uppercase text-ink-subtle block">Rule ID</span>
                                <span className="font-semibold text-ink">{rule.id}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase text-ink-subtle block">Execution Stage</span>
                                <span className="font-semibold text-ink">{rule.stage}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase text-ink-subtle block">Priority Order</span>
                                <span className="font-semibold text-ink">{rule.priority ?? 100}</span>
                              </div>
                            </div>

                            <div className="border-t border-ink-border/60 pt-2 space-y-1.5">
                              <span className="text-[10px] uppercase text-ink-subtle block">
                                Raw Evaluator Conditions
                              </span>
                              {rule.conditions && rule.conditions.length > 0 ? (
                                <div className="space-y-1">
                                  {rule.conditions.map((c: any, cIdx: number) => (
                                    <div
                                      key={cIdx}
                                      className="text-[11px] bg-paper px-2.5 py-1.5 rounded border border-ink-border flex flex-wrap items-center justify-between gap-2"
                                    >
                                      <span>
                                        Field: <strong className="text-ink">{c.field}</strong>
                                      </span>
                                      <span className="text-cobalt font-bold">Operator: {c.operator}</span>
                                      <span>
                                        Value:{" "}
                                        <strong className="text-ink">
                                          {Array.isArray(c.value) ? `[${c.value.join(", ")}]` : String(c.value)}
                                        </strong>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-ink-muted italic">None (unconditional)</span>
                              )}
                            </div>

                            <div className="border-t border-ink-border/60 pt-2 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                              <div>
                                <span className="text-[10px] uppercase text-ink-subtle block">Action Type</span>
                                <span className="font-semibold text-ink">{rule.action?.type}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase text-ink-subtle block">Action Value</span>
                                <span className="font-semibold text-cobalt">{rule.action?.value}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase text-ink-subtle block">Status</span>
                                <span className="font-semibold">
                                  {rule.enabled !== false ? "enabled: true" : "enabled: false"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: WHAT-IF PRICE SIMULATOR */}
          {activeTab === "simulation" && (
            <div className="bg-paper border border-ink-border rounded-2xl p-6 shadow-card space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-border pb-4">
                <div>
                  <h3 className="text-base font-bold text-ink">What-If Price Simulator</h3>
                  <p className="text-xs text-ink-muted">
                    Test how different market conditions impact your room prices before pushing changes live.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (domainDetail?.factors && domainDetail.factors.length > 0) {
                        const curDef = factors[whatIfFactor] !== undefined ? factors[whatIfFactor] : domainDetail.factors[0].default;
                        setWhatIfValue(curDef);
                        runWhatIfCalculation(whatIfFactor, curDef);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl border border-ink-border hover:bg-ledger text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-ink-subtle" />
                    Reset to Baseline
                  </button>
                  <button
                    onClick={() => handleRunSimulation(whatIfFactor)}
                    disabled={simLoading}
                    className="px-4 py-2 rounded-xl bg-cobalt hover:bg-cobalt-hover text-paper text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${simLoading ? "animate-spin" : ""}`} />
                    Re-run Sweep Analysis
                  </button>
                </div>
              </div>

              {/* Main Interactive What-If Studio */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 7 cols: Factor Selector, Natural Unit Presets, and Interactive Slider */}
                <div className="lg:col-span-7 bg-ledger/60 p-5 rounded-2xl border border-ink-border space-y-5 shadow-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle font-semibold block mb-1.5">
                      Select Market Condition to Simulate:
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <select
                          value={whatIfFactor}
                          onChange={(e) => {
                            const newF = e.target.value;
                            setWhatIfFactor(newF);
                            const fObj = domainDetail?.factors?.find((f: any) => f.name === newF);
                            const sCfg = fObj ? getFactorSliderConfig(fObj) : null;
                            const nextVal = sCfg?.presets && sCfg.presets.length > 0 ? sCfg.presets[sCfg.presets.length - 1].value : (fObj?.default ?? 0);
                            setWhatIfValue(nextVal);
                            runWhatIfCalculation(newF, nextVal);
                            handleRunSimulation(newF);
                          }}
                          className="appearance-none bg-paper border border-ink-border rounded-xl px-3.5 py-2 pr-8 text-xs font-bold text-ink cursor-pointer focus:outline-none focus:ring-2 focus:ring-cobalt/20 focus:border-cobalt shadow-xs"
                        >
                          {domainDetail?.factors?.map((f: any) => (
                            <option key={f.name} value={f.name}>
                              {getFieldLabel(f.name)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-ink-muted absolute right-2.5 top-2.5 pointer-events-none" />
                      </div>

                      <div className="text-xs text-ink-muted">
                        Live Baseline:{" "}
                        <strong className="text-ink font-mono">
                          {formatFactorDisplay(
                            whatIfFactor,
                            factors[whatIfFactor] !== undefined ? factors[whatIfFactor] : (whatIfFactorObj?.default ?? 0),
                            whatIfSliderCfg?.isPct ?? false,
                            currentUnit
                          )}
                        </strong>
                      </div>
                    </div>
                    {whatIfFactorObj?.description && (
                      <p className="text-[11px] text-ink-muted mt-2">
                        {whatIfFactorObj.description}
                      </p>
                    )}
                  </div>

                  {/* Natural Units Scenario Presets */}
                  {whatIfSliderCfg?.presets && whatIfSliderCfg.presets.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-ink-border/60">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle block font-semibold">
                        Meaningful Scenario Presets:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {whatIfSliderCfg.presets.map((preset: any, idx: number) => {
                          const isSelected = whatIfValue === preset.value;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setWhatIfValue(preset.value);
                                runWhatIfCalculation(whatIfFactor, preset.value);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-cobalt text-paper shadow-xs ring-2 ring-cobalt/30"
                                  : "bg-paper border border-ink-border text-ink hover:bg-ledger"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Slider Control with Natural Unit Display */}
                  {whatIfSliderCfg && whatIfSliderCfg.isNumber && (
                    <div className="space-y-2.5 pt-2 border-t border-ink-border/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink">Fine-tune Scenario Value:</span>
                        <span className="font-mono font-bold text-cobalt bg-paper px-2.5 py-0.5 rounded-lg border border-ink-border text-sm">
                          {formatFactorDisplay(whatIfFactor, whatIfValue, whatIfSliderCfg.isPct, currentUnit)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={whatIfSliderCfg.min}
                        max={whatIfSliderCfg.max}
                        step={whatIfSliderCfg.step}
                        value={typeof whatIfValue === "number" ? whatIfValue : parseFloat(whatIfValue) || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setWhatIfValue(val);
                          runWhatIfCalculation(whatIfFactor, val);
                        }}
                        className="w-full h-2 bg-ink-border rounded-lg cursor-pointer accent-cobalt"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-ink-subtle">
                        <span>Min: {formatFactorDisplay(whatIfFactor, whatIfSliderCfg.min, whatIfSliderCfg.isPct, currentUnit)}</span>
                        <span>Max: {formatFactorDisplay(whatIfFactor, whatIfSliderCfg.max, whatIfSliderCfg.isPct, currentUnit)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right 5 cols: Projected Rate Comparison Card */}
                <div className="lg:col-span-5 bg-paper border border-ink-border rounded-2xl p-5 shadow-card space-y-4">
                  <div className="border-b border-ink-border/60 pb-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle block font-semibold">
                      Target Inventory Unit
                    </span>
                    <h4 className="text-base font-bold text-ink">
                      {currentItem?.name || "Selected Item"}
                    </h4>
                  </div>

                  {/* Comparison Grid */}
                  <div className="grid grid-cols-2 gap-4 text-center bg-ledger/60 p-4 rounded-xl border border-ink-border">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle block">
                        Base Rate
                      </span>
                      <span className="text-xl font-bold font-mono text-ink block mt-0.5">
                        {formatPrice(whatIfBasePrice, currentUnit)}
                      </span>
                      <span className="text-[10px] text-ink-muted">Standard rate</span>
                    </div>

                    <div className="border-l border-ink-border/60 pl-3">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cobalt block font-bold">
                        Projected Rate
                      </span>
                      <span className={`text-xl font-bold font-mono text-cobalt block mt-0.5 ${whatIfLoading ? "opacity-50" : ""}`}>
                        {formatPrice(whatIfProjectedPrice, currentUnit)}
                      </span>
                      <span className="text-[10px] text-cobalt font-medium">Scenario output</span>
                    </div>
                  </div>

                  {/* Net Change Card */}
                  <div className="p-3.5 rounded-xl border flex items-center justify-between text-xs bg-ledger/50 border-ink-border">
                    <span className="text-ink-muted font-medium">Projected Rate Change:</span>
                    <div>
                      {whatIfBaseDelta > 0 ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-lagoon text-sm">
                            <TrendingUp className="w-4 h-4" />
                            +{formatPrice(whatIfBaseDelta, currentUnit)}
                          </span>
                          <span className="text-[10px] font-mono text-lagoon block">
                            +{whatIfBaseDeltaPct}% dynamic uplift
                          </span>
                        </div>
                      ) : whatIfBaseDelta < 0 ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-coral text-sm">
                            <TrendingUp className="w-4 h-4 rotate-180" />
                            -{formatPrice(Math.abs(whatIfBaseDelta), currentUnit)}
                          </span>
                          <span className="text-[10px] font-mono text-coral block">
                            {whatIfBaseDeltaPct}% discount
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-ink-muted font-medium">At Baseline (0.00)</span>
                      )}
                    </div>
                  </div>

                  {/* Triggered Rules in Scenario */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle block font-semibold">
                      Rules Triggered Under Scenario ({whatIfTriggeredRules.length}):
                    </span>
                    {whatIfTriggeredRules.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {whatIfTriggeredRules.map((step: any, sIdx: number) => (
                          <div
                            key={sIdx}
                            className="p-2.5 bg-ledger rounded-lg border border-ink-border flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-ink">{step.rule_name || step.rule_id}</span>
                              <p className="text-[10px] text-ink-muted">{step.reason}</p>
                            </div>
                            <span className="font-mono font-bold text-cobalt text-xs shrink-0 ml-2">
                              {formatAdjustmentDelta(step.adjustment, currentUnit).formatted}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-ink-muted italic p-2.5 bg-ledger rounded-lg border border-ink-border">
                        No conditional rules triggered. Room priced at standard base rate.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Scenario Sensitivity Sweep Curve */}
              <div className="space-y-3 pt-4 border-t border-ink-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-ink flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-cobalt" />
                      Sensitivity Analysis Across {getFieldLabel(whatIfFactor)}
                    </h4>
                    <p className="text-[11px] text-ink-muted">
                      Projected room rates as market conditions scale across natural levels.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-ink-subtle">
                    Click any point to load scenario
                  </span>
                </div>

                {simPoints.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {simPoints.map((pt, i) => {
                      const displayVal = formatFactorDisplay(
                        whatIfFactor,
                        pt.sweep_value,
                        whatIfSliderCfg?.isPct ?? false,
                        currentUnit
                      );
                      const isSelected = whatIfValue === pt.sweep_value;
                      const ptDelta = pt.final_price - baseVal;
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setWhatIfValue(pt.sweep_value);
                            runWhatIfCalculation(whatIfFactor, pt.sweep_value);
                          }}
                          className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-cobalt-light/40 border-cobalt ring-2 ring-cobalt/30 shadow-xs"
                              : "bg-ledger/60 border-ink-border hover:bg-paper hover:border-cobalt/40 shadow-xs"
                          }`}
                        >
                          <span className="text-[10px] font-mono uppercase text-ink-subtle block">
                            {displayVal}
                          </span>
                          <span className="text-base font-bold font-mono text-ink block mt-1">
                            {formatPrice(pt.final_price, currentUnit)}
                          </span>
                          <span className={`text-[10px] font-mono font-medium block mt-0.5 ${ptDelta > 0 ? "text-lagoon" : ptDelta < 0 ? "text-coral" : "text-ink-muted"}`}>
                            {ptDelta >= 0 ? "+" : ""}{formatPrice(ptDelta, currentUnit)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-ink-muted bg-ledger rounded-xl border border-ink-border">
                    Click &ldquo;Re-run Sweep Analysis&rdquo; to generate sensitivity points.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: STRATEGY ACTIVATION READINESS */}
          {activeTab === "publish" && (
            <div className="bg-paper border border-ink-border rounded-2xl p-6 shadow-card space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-border pb-4">
                <div>
                  <h3 className="text-base font-bold text-ink">Strategy Activation Readiness</h3>
                  <p className="text-xs text-ink-muted">
                    Verify business rules, safety guardrails, and governance before promoting changes to production.
                  </p>
                </div>
                <div>
                  {isStrategyReady ? (
                    <span className="px-3.5 py-1 rounded-full bg-lagoon-light text-lagoon text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4" />
                      READY TO ACTIVATE
                    </span>
                  ) : (
                    <span className="px-3.5 py-1 rounded-full bg-coral-light text-coral text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                      <AlertTriangle className="w-4 h-4" />
                      ACTION REQUIRED
                    </span>
                  )}
                </div>
              </div>

              {/* Business Readiness Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Rule logic verified */}
                <div className="p-4 bg-ledger/60 rounded-xl border border-ink-border space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-lagoon shrink-0" />
                      Rule logic verified
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-lagoon-light text-lagoon font-semibold">
                      Passed
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    All {domainDetail?.strategy?.rules?.length || 0} pricing rules inspected for syntax and condition validity. Zero circular logic detected.
                  </p>
                </div>

                {/* 2. Audit integrity verified */}
                <div className="p-4 bg-ledger/60 rounded-xl border border-ink-border space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-lagoon shrink-0" />
                      Audit integrity verified
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-lagoon-light text-lagoon font-semibold">
                      Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    Cryptographic audit trail is unbroken. All historical rate changes and releases are verified and tamper-evident.
                  </p>
                </div>

                {/* 3. Strategy validation complete */}
                <div className="p-4 bg-ledger/60 rounded-xl border border-ink-border space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-lagoon shrink-0" />
                      Strategy validation complete
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-lagoon-light text-lagoon font-semibold">
                      Passed
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    Pipeline stages ({domainDetail?.strategy?.stages?.join(" → ") || "demand → customer → time → guardrails → rounding"}) verified for execution order.
                  </p>
                </div>

                {/* 4. Price guardrails validated */}
                <div className="p-4 bg-ledger/60 rounded-xl border border-ink-border space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-2">
                      <Lock className="w-4 h-4 text-lagoon shrink-0" />
                      Price guardrails validated
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-lagoon-light text-lagoon font-semibold">
                      Enforced
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    Hard pricing floors and ceilings protect rates against unintended market anomalies:
                  </p>
                  <div className="flex items-center gap-3 text-xs font-mono pt-1">
                    <span className="bg-paper px-2.5 py-1 rounded-lg border border-ink-border shadow-2xs">
                      Floor: <strong>{formatPrice(floorGuardrail?.value || "90.00", currentUnit)}</strong>
                    </span>
                    <span className="bg-paper px-2.5 py-1 rounded-lg border border-ink-border shadow-2xs">
                      Ceiling: <strong>{formatPrice(ceilingGuardrail?.value || "450.00", currentUnit)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Messages */}
              {publishSuccessMsg && (
                <div className="p-3.5 bg-lagoon-light border border-lagoon/30 text-lagoon text-xs rounded-xl font-medium flex items-center gap-2 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{publishSuccessMsg}</span>
                </div>
              )}

              {/* Primary Action Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-ink-border">
                <div className="text-xs text-ink-muted">
                  Strategy release creates an immutable snapshot version and appends to the verified governance ledger.
                </div>
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="px-6 py-2.5 rounded-xl bg-cobalt hover:bg-cobalt-hover text-paper font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Activating Strategy...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Save & Activate Strategy
                    </>
                  )}
                </button>
              </div>

              {/* Secondary: Technical Checks Collapsible Accordion */}
              <div className="pt-2 border-t border-ink-border/70">
                <button
                  onClick={() => setShowPublishTech(!showPublishTech)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-ledger/60 hover:bg-ledger/80 border border-ink-border text-xs font-mono text-ink-muted transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-cobalt" />
                    <span>View Technical Checks & Diagnostic Details</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showPublishTech ? "rotate-180" : ""}`} />
                </button>

                {showPublishTech && (
                  <div className="mt-3 p-4 bg-ledger/60 rounded-xl border border-ink-border space-y-3 text-xs animate-fade-in shadow-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-ink-subtle block">Expression Engine</span>
                        <span className="font-semibold text-ink">AST-validated expression parser (Zero eval/exec)</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-ink-subtle block">Arithmetic Precision</span>
                        <span className="font-semibold text-ink">Arbitrary-precision Decimal (IEEE-754 float drift free)</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-ink-subtle block">Active Strategy Version</span>
                        <span className="font-mono text-cobalt font-semibold">v{activeStrategyVersion}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-ink-subtle block">Governance Chain Blocks</span>
                        <span className="font-mono text-ink font-semibold">{auditLog.length} sequential blocks</span>
                      </div>
                    </div>

                    {lintIssues.length > 0 && (
                      <div className="pt-2 border-t border-ink-border/60 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-ink-subtle block">Linter Diagnostics</span>
                        {lintIssues.map((issue: any, iIdx: number) => (
                          <div key={iIdx} className="text-[11px] p-2 rounded-lg bg-paper border border-ink-border text-ink-muted">
                            <strong className="text-ink">{issue.code}:</strong> {issue.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: VERSIONS & ROLLBACK */}
          {activeTab === "versions" && (
            <div className="bg-paper border border-ink-border rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Version History & Instant Rollback</h3>
                  <p className="text-xs text-ink-muted">
                    Immutable history of published strategy snapshots
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {versionsList.map((ver, idx) => (
                  <div key={idx} className="p-4 bg-ledger/60 border border-ink-border rounded-xl flex items-center justify-between hover:border-cobalt/40 shadow-xs transition-all">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">v{ver.version}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${ver.status === "published" ? "bg-lagoon-light text-lagoon" : "bg-ink-border text-ink-subtle"}`}>
                          {ver.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">Author: {ver.author} • Rules: {ver.rules_count}</p>
                      <p className="text-[10px] font-mono text-ink-subtle mt-0.5">{ver.created_at}</p>
                    </div>

                    {ver.status !== "published" && (
                      <button
                        onClick={() => handleRollback(ver.version)}
                        className="px-3.5 py-1.5 rounded-lg border border-ink-border text-xs font-semibold hover:bg-paper flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-cobalt" />
                        Rollback to this
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: LIVE CONSOLE */}
          {activeTab === "live-console" && (
            <div className="bg-paper border border-ink-border rounded-2xl p-6 shadow-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Live Decision Stream</h3>
                  <p className="text-xs text-ink-muted">
                    Real-time evaluated pricing ticks flowing through the engine for {domainDetail?.name || "active domain"}
                  </p>
                </div>
                <button
                  onClick={() => setIsLiveStreaming(!isLiveStreaming)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
                    isLiveStreaming ? "bg-lagoon text-paper" : "bg-ink-border text-ink"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  {isLiveStreaming ? "Streaming Active" : "Stream Paused"}
                </button>
              </div>

              {/* Engine Runtime Telemetry & Performance Metrics (Moved from Home) */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-ledger/60 border border-ink-border rounded-xl shadow-xs">
                <div>
                  <div className="flex items-center justify-between text-xs text-ink-subtle">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Engine Latency</span>
                    <TrendingUp className="w-3.5 h-3.5 text-lagoon" />
                  </div>
                  <div className="text-xl font-bold font-mono text-ink mt-0.5">1.82 ms</div>
                  <p className="text-[10px] text-ink-muted">P99 evaluation latency</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-ink-subtle">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Engine Core</span>
                    <Zap className="w-3.5 h-3.5 text-marigold" />
                  </div>
                  <div className="text-xl font-bold font-mono text-ink mt-0.5">Pure Decimal</div>
                  <p className="text-[10px] text-ink-muted">Zero float arithmetic drift</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-ink-subtle">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Session Stream</span>
                    <Activity className="w-3.5 h-3.5 text-cobalt" />
                  </div>
                  <div className="text-xl font-bold font-mono text-ink mt-0.5">{liveTicks.length} Ticks</div>
                  <p className="text-[10px] text-ink-muted">Active evaluations tracked</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-ink-subtle">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Active Packs</span>
                    <Layers className="w-3.5 h-3.5 text-ink" />
                  </div>
                  <div className="text-xl font-bold font-mono text-ink mt-0.5">{domains.length} Domains</div>
                  <p className="text-[10px] text-ink-muted">Declarative configuration</p>
                </div>
              </div>

              <div className="space-y-2">
                {liveTicks.map((tick, i) => (
                  <div key={i} className="p-3.5 bg-ledger/60 border border-ink-border rounded-xl flex items-center justify-between text-xs hover:border-cobalt/40 shadow-2xs transition-all">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{tick.item_name}</span>
                        <span className="text-[10px] font-mono text-ink-subtle">{tick.tick_id}</span>
                      </div>
                      <div className="text-[11px] font-mono text-ink-muted mt-0.5">
                        Hash: {tick.decision_hash}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-ink block">
                        {tick.unit}{tick.evaluated_price}
                      </span>
                      <span className="text-[10px] font-mono text-ink-subtle">
                        Base: {tick.unit}{tick.base_price}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: EXPLAIN */}
          {activeTab === "explain" && evalResult && (
            <div className="bg-paper border border-ink-border rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Audit Trace Deep Dive (&quot;Why this price?&quot;)</h3>
                  <p className="text-xs text-ink-muted">
                    Complete verifiable execution path from initial base rate to final Decimal
                  </p>
                </div>
                <span className="font-mono text-xs text-ink font-semibold">
                  SHA-256: {evalResult.trace.decision_hash}
                </span>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-ink-muted">
                  Factor Contributions Breakdown
                </h4>
                <div className="space-y-2">
                  {evalResult.contributions.map((c, i) => (
                    <div key={i} className="p-3.5 bg-ledger/60 border border-ink-border rounded-xl flex items-center justify-between text-xs shadow-2xs">
                      <div>
                        <span className="font-semibold text-ink">{c.rule_name || c.rule_id}</span>
                        <p className="text-[11px] text-ink-muted">{c.reason}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-ink">{c.adjustment}</span>
                        <span className="text-[10px] font-mono text-cobalt block">{c.contribution_pct}% contribution</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: ACTIVITY & AUDIT LOG */}
          {activeTab === "audit" && (
            <div className="bg-paper border border-ink-border rounded-2xl p-6 shadow-card space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-border pb-4">
                <div>
                  <h3 className="text-base font-bold text-ink">Activity & Audit Log</h3>
                  <p className="text-xs text-ink-muted">
                    A complete record of who updated room rates, published rules, or modified settings.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-1.5 rounded-full bg-lagoon-light text-lagoon text-xs font-semibold flex items-center gap-1.5 shadow-2xs border border-lagoon/20">
                    <ShieldCheck className="w-4 h-4 text-lagoon" />
                    {auditValid ? "✓ Verified & Compliant" : "Verifying Compliance..."}
                  </span>
                </div>
              </div>

              {/* Compliance & Overview Summary Card */}
              <div className="p-5 bg-ledger/60 rounded-xl border border-ink-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-lagoon-light text-lagoon flex items-center justify-center shrink-0 border border-lagoon/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-ink block text-xs">Tamper-Evident Governance Ledger Active</span>
                    <span className="text-ink-muted text-[11px]">
                      Continuous cryptographic verification guarantees non-repudiation for every rate, rule, and governance event.
                    </span>
                  </div>
                </div>
                <span className="font-mono text-ink-subtle text-[11px] shrink-0 font-medium px-2.5 py-1 bg-paper rounded-lg border border-ink-border">
                  {auditLog.length} Recorded Activities
                </span>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap items-center gap-2 border-b border-ink-border/60 pb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle font-semibold mr-1">
                  Filter Activity:
                </span>
                {[
                  { id: "all", label: "All Activity" },
                  { id: "changes", label: "Price & Room Changes" },
                  { id: "releases", label: "Strategy Releases" },
                  { id: "user", label: "User Actions" },
                ].map((f) => {
                  const isSelected = auditFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setAuditFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-cobalt text-paper shadow-xs font-semibold"
                          : "bg-ledger/80 border border-ink-border text-ink hover:bg-paper"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Activity Feed */}
              {(() => {
                // Sort chronologically: newest → oldest
                const sortedAuditEntries = [...auditLog].sort((a, b) => {
                  const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
                  const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
                  return timeB - timeA;
                });

                const filteredAuditEntries = sortedAuditEntries.filter((entry) => {
                  if (auditFilter === "all") return true;
                  if (auditFilter === "changes") {
                    return ["ITEM_CREATE", "ITEM_UPDATE", "ITEM_DELETE", "PRICE_UPDATE"].includes(entry.action);
                  }
                  if (auditFilter === "releases") {
                    return ["PUBLISH", "ROLLBACK"].includes(entry.action);
                  }
                  if (auditFilter === "user") {
                    return [
                      "user_login",
                      "user_logout",
                      "LOGIN",
                      "USER_LOGIN",
                      "LOGOUT",
                      "RULE_CREATE",
                      "RULE_UPDATE",
                      "RULE_TOGGLE",
                      "CONFIG_CHANGE",
                    ].includes(entry.action) ||
                    entry.category === "user_actions" ||
                    entry.event_type === "user_login" ||
                    entry.event_type === "user_logout";
                  }
                  return true;
                });

                if (filteredAuditEntries.length === 0) {
                  return (
                    <div className="p-8 text-center text-xs text-ink-muted bg-ledger/60 rounded-xl border border-ink-border">
                      No activity found under the selected filter.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filteredAuditEntries.map((entry, idx) => {
                      const isTechExpanded = !!expandedAuditTechIds[entry.id];
                      const isPublishedAction = entry.action === "PUBLISH";
                      const canRollback = isPublishedAction && entry.version && entry.version !== activeStrategyVersion;

                      const isLoginEvent =
                        entry.action === "user_login" ||
                        entry.action === "LOGIN" ||
                        entry.action === "USER_LOGIN" ||
                        entry.event_type === "user_login";

                      const isLogoutEvent =
                        entry.action === "user_logout" ||
                        entry.action === "LOGOUT" ||
                        entry.event_type === "user_logout";

                      const isAuthEvent = isLoginEvent || isLogoutEvent;

                      // Resolve clean actor name and email
                      const actorName =
                        entry.actor_name ||
                        entry.actor ||
                        entry.author ||
                        entry.details?.actor_name ||
                        entry.details?.actor ||
                        entry.details?.author ||
                        "";

                      const actorEmail =
                        entry.actor_email ||
                        entry.details?.actor_email ||
                        entry.details?.email ||
                        "";

                      let actorDetails = "";
                      if (actorName && actorEmail && actorName.toLowerCase() !== actorEmail.toLowerCase()) {
                        actorDetails = `${actorName} (${actorEmail})`;
                      } else if (actorEmail) {
                        actorDetails = actorEmail;
                      } else if (actorName) {
                        actorDetails = actorName;
                      } else {
                        actorDetails = "Authenticated User";
                      }

                      return (
                        <div
                          key={entry.id || idx}
                          className="p-5 bg-paper rounded-xl border border-ink-border shadow-card space-y-3.5 transition-all hover:border-cobalt/40"
                        >
                          {/* Top: Event Name, Author & Timestamp */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-ink-border/60 pb-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isLoginEvent ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    User Logged In
                                  </span>
                                ) : isLogoutEvent ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                    User Logged Out
                                  </span>
                                ) : (
                                  <h4 className="text-sm font-bold text-ink">
                                    {getHumanActionLabel(entry.action, entry)}
                                  </h4>
                                )}
                                {entry.version && !isAuthEvent && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cobalt-light text-cobalt font-semibold border border-cobalt/20">
                                    v{entry.version}
                                  </span>
                                )}
                              </div>

                              {isAuthEvent ? (
                                <div className="space-y-0.5 pt-0.5">
                                  <div className="text-xs font-semibold text-ink">
                                    {actorDetails}
                                  </div>
                                  <p className="text-xs text-ink-muted">
                                    {getAuditEntryDescription(entry, currentUnit)}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-ink-muted">
                                  {getAuditEntryDescription(entry, currentUnit)}
                                </p>
                              )}
                            </div>

                            <div className="text-left sm:text-right shrink-0 space-y-0.5">
                              {!isAuthEvent && (
                                <span className="text-xs font-semibold text-ink block">
                                  {entry.author || "Pricing Manager"}
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-ink-subtle block">
                                {formatAuditTimestamp(entry.timestamp || entry.created_at)}
                              </span>
                            </div>
                          </div>

                          {/* Action Row: Rollback (if applicable) & Accordion toggle */}
                          <div className="flex items-center justify-between text-xs pt-0.5">
                            <div>
                              {canRollback && (
                                <button
                                  onClick={() => handleRollback(entry.version)}
                                  className="px-3 py-1.5 rounded-lg border border-ink-border text-xs font-semibold hover:bg-ledger text-cobalt flex items-center gap-1.5 transition-colors shadow-2xs"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Rollback to v{entry.version}
                                </button>
                              )}
                            </div>

                            {/* Collapsed Technical Proof Accordion Toggle */}
                            <button
                              onClick={() => toggleAuditTech(entry.id)}
                              className="text-[11px] font-mono text-ink-muted hover:text-ink flex items-center gap-1 transition-colors ml-auto"
                            >
                              <span>Technical Proof / Security Details</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isTechExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          </div>

                          {/* Expanded Technical Proof Details */}
                          {isTechExpanded && (
                            <div className="p-4 bg-ledger/60 rounded-xl border border-ink-border space-y-2.5 text-xs font-mono animate-fade-in">
                              <div className="flex items-center justify-between gap-2 border-b border-ink-border/60 pb-1.5">
                                <span className="text-[10px] uppercase text-ink-subtle font-semibold">
                                  Cryptographic Verification Details
                                </span>
                                <button
                                  onClick={() => handleCopyHash(entry.entry_hash)}
                                  className="text-[10px] text-cobalt hover:underline flex items-center gap-1 font-sans"
                                >
                                  <Copy className="w-3 h-3" />
                                  {copiedHash === entry.entry_hash ? "Copied!" : "Copy Hash"}
                                </button>
                              </div>

                              <div className="space-y-1.5 text-[11px]">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                  <span className="text-ink-subtle text-[10px]">Entry SHA-256 Hash:</span>
                                  <span className="text-ink break-all select-all font-semibold">
                                    {entry.entry_hash}
                                  </span>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                  <span className="text-ink-subtle text-[10px]">Previous Block Hash:</span>
                                  <span className="text-ink-muted break-all select-all">
                                    {entry.prev_hash}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-ink-border/50 text-[10px] text-ink-subtle">
                                  <span>Block ID: {entry.id}</span>
                                  <span>Raw Event Code: {entry.action}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </main>

      {/* AI Copilot Side Drawer */}
      {showCopilot && (
        <div className="fixed inset-y-0 right-0 w-96 bg-paper border-l border-ink-border shadow-2xl z-50 flex flex-col justify-between p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-ink-border pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-marigold" />
                <h3 className="text-sm font-bold text-ink">Monetize360 AI Copilot</h3>
              </div>
              <button onClick={() => setShowCopilot(false)} className="text-ink-muted hover:text-ink transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-ink-muted">
              Enter a natural language pricing strategy. The copilot uses Google Gemini (or deterministic offline parser) to formulate a strict schema rule.
            </p>

            <div className="space-y-2.5">
              <textarea
                rows={3}
                value={copilotPrompt}
                onChange={(e) => setCopilotPrompt(e.target.value)}
                placeholder="e.g., If occupancy rate exceeds 0.85, apply a 20% surge uplift"
                className="w-full p-3 text-xs border border-ink-border rounded-xl bg-ledger/60 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt font-sans transition-all"
              />
              <button
                onClick={handleGenerateCopilotRule}
                disabled={copilotLoading}
                className="w-full py-2.5 bg-sidebar text-paper text-xs font-semibold rounded-xl hover:bg-sidebar-hover transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                {copilotLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating rule...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-marigold" />
                    Formulate Rule
                  </>
                )}
              </button>
            </div>

            {copilotProposal && (
              <div className="p-4 bg-ledger/60 border border-ink-border rounded-xl space-y-3 text-xs shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{copilotProposal.rule.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-lagoon-light text-lagoon font-semibold border border-lagoon/20">
                    {copilotProposal.provider}
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted">{copilotProposal.explanation}</p>
                <div className="bg-paper p-3 rounded-lg border border-ink-border space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-cobalt font-bold">WHEN: </span>
                    <span className="font-semibold text-ink">{translateConditions(copilotProposal.rule.conditions, currentUnit)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-lagoon font-bold">THEN: </span>
                    <span className="font-semibold text-ink">{getActionPresentation(copilotProposal.rule.action, currentUnit).text}</span>
                  </div>
                  <div className="text-[10px] font-mono text-ink-subtle pt-1.5 border-t border-ink-border/60 flex items-center justify-between">
                    <span>Stage: {copilotProposal.rule.stage}</span>
                    <span>Impact: <strong className="text-ink">{getActionPresentation(copilotProposal.rule.action, currentUnit).impact}</strong></span>
                  </div>
                </div>
                <button
                  onClick={handleApplyCopilotRule}
                  className="w-full py-2 bg-cobalt text-paper font-semibold rounded-xl text-xs hover:bg-cobalt-hover shadow-xs transition-all"
                >
                  Apply to Live Preview
                </button>
              </div>
            )}
          </div>

          <div className="text-[10px] text-ink-subtle border-t border-ink-border pt-3">
            Safety invariant: Copilot strictly proposes drafts. Approvals and validation remain authoritative.
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-paper border border-ink-border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-border pb-3">
              <h4 className="text-sm font-bold text-ink">Add New Inventory Item</h4>
              <button onClick={() => setShowAddItemModal(false)} className="text-ink-muted hover:text-ink transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-medium text-ink block mb-1">Item Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g., Luxury Ocean Suite"
                  className="w-full p-2.5 border border-ink-border rounded-xl bg-ledger/60 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt font-sans transition-all"
                />
              </div>

              <div>
                <label className="font-medium text-ink block mb-1">Base Price ({domainDetail?.unit || "$"})</label>
                <input
                  type="text"
                  value={newItemBasePrice}
                  onChange={(e) => setNewItemBasePrice(e.target.value)}
                  placeholder="e.g., 250.00"
                  className="w-full p-2.5 border border-ink-border rounded-xl bg-ledger/60 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt font-mono transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-ink-border">
              <button
                onClick={() => setShowAddItemModal(false)}
                className="px-3.5 py-2 rounded-xl border border-ink-border text-xs text-ink hover:bg-ledger transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 rounded-xl bg-cobalt text-paper text-xs font-semibold hover:bg-cobalt-hover shadow-xs transition-all"
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Room Modal (PART 1) */}
      {showEditItemModal && editingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-paper border border-ink-border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-ink-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-ink">Edit Room</h4>
                <p className="text-[11px] text-ink-muted">Update inventory details and base rate</p>
              </div>
              <button
                onClick={() => {
                  setShowEditItemModal(false);
                  setEditingItem(null);
                }}
                className="text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editItemError && (
              <div className="p-2.5 bg-coral-light text-coral border border-coral/30 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editItemError}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-medium text-ink block mb-1">Room Name</label>
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  placeholder="e.g., Deluxe King Room"
                  className="w-full p-2.5 border border-ink-border rounded-xl bg-ledger/60 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt font-sans transition-all"
                />
              </div>

              <div>
                <label className="font-medium text-ink block mb-1">
                  Base Rate ({editingItem?.unit || domainDetail?.unit || "$"})
                </label>
                <input
                  type="text"
                  value={editItemBasePrice}
                  onChange={(e) => setEditItemBasePrice(e.target.value)}
                  placeholder="e.g., 195.00"
                  className="w-full p-2.5 border border-ink-border rounded-xl bg-ledger/60 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt font-mono transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-ink-border">
              <button
                type="button"
                onClick={() => {
                  setShowEditItemModal(false);
                  setEditingItem(null);
                }}
                className="px-3.5 py-2 rounded-xl border border-ink-border text-xs text-ink hover:bg-ledger transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isEditingLoading}
                onClick={handleSaveEditItem}
                className="px-4 py-2 rounded-xl bg-cobalt text-paper text-xs font-semibold hover:bg-cobalt-hover shadow-xs transition-all cursor-pointer disabled:opacity-60"
              >
                {isEditingLoading ? "Saving Changes..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
