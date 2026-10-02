"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Plus
} from "lucide-react";

interface DomainInfo {
  id: string;
  name: string;
  description: string;
  unit: string;
  items_count: number;
  rules_count: number;
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

export default function Home() {
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>("hospitality");
  const [domainDetail, setDomainDetail] = useState<any>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  // Factors state
  const [factors, setFactors] = useState<Record<string, any>>({});
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<"home" | "strategy" | "simulation" | "explain">("home");

  // Drawers
  const [showCopilot, setShowCopilot] = useState<boolean>(false);
  const [copilotPrompt, setCopilotPrompt] = useState<string>("");
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);
  const [copilotProposal, setCopilotProposal] = useState<any>(null);
  const [customRules, setCustomRules] = useState<any[]>([]);

  // Simulation state
  const [simPoints, setSimPoints] = useState<any[]>([]);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  // Fetch all domain packs from backend via Next.js proxy
  useEffect(() => {
    fetch("/api/domains")
      .then((res) => res.json())
      .then((data) => {
        if (data.domains && data.domains.length > 0) {
          setDomains(data.domains);
          setSelectedDomainId(data.domains[0].id);
        }
      })
      .catch((err) => console.error("Error fetching domains:", err));
  }, []);

  // Fetch domain details when domain changes
  useEffect(() => {
    if (!selectedDomainId) return;

    fetch(`/api/domains/${selectedDomainId}`)
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
  }, [selectedDomainId]);

  // Evaluate price whenever factors, item, or customRules change
  const runEvaluation = useCallback(
    async (currentFactors = factors, rules = customRules) => {
      if (!selectedDomainId || !selectedItemId) return;
      setIsLoading(true);
      setIsAnimating(true);

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
        const data = await res.json();
        setEvalResult(data);
      } catch (err) {
        console.error("Evaluation error:", err);
      } finally {
        setIsLoading(false);
        setTimeout(() => setIsAnimating(false), 600);
      }
    },
    [selectedDomainId, selectedItemId, factors, customRules]
  );

  useEffect(() => {
    if (selectedDomainId && selectedItemId) {
      runEvaluation(factors, customRules);
    }
  }, [selectedDomainId, selectedItemId, runEvaluation]);

  // Keyboard shortcut Ctrl+K for Copilot
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

  // Update specific factor
  const handleFactorChange = (name: string, value: any) => {
    const updated = { ...factors, [name]: value };
    setFactors(updated);
    runEvaluation(updated, customRules);
  };

  // Run Copilot rule generation
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

  // Apply proposed Copilot rule
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

  // Run Simulation curve
  const handleRunSimulation = async () => {
    if (!selectedDomainId || !selectedItemId || !domainDetail?.factors?.length) return;
    setSimLoading(true);
    const sweepFact = domainDetail.factors[0].name;

    try {
      const res = await fetch("/api/pricing/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_id: selectedDomainId,
          item_id: selectedItemId,
          sweep_factor: sweepFact,
          min_val: 0.5,
          max_val: 2.0,
          steps_count: 7,
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

  const currentUnit = evalResult?.trace?.unit || "$";
  const outputPrice = evalResult?.trace?.final_price || "0.00";
  const basePrice = evalResult?.trace?.base_price || "0.00";

  return (
    <div className="flex min-h-screen bg-ledger">
      {/* Primary Sidebar */}
      <aside className="w-64 border-r border-ink-border bg-paper flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-6">
          {/* Logo */}
          <div className="px-2 py-1 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-ink text-paper flex items-center justify-center font-mono font-bold rounded-sm text-sm shadow-sm">
              M
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-ink">MONETIZE360</h1>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-subtle">
                Dynamic Pricing Engine
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-4 text-xs">
            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                Workspace
              </p>
              <button
                onClick={() => setActiveTab("home")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-medium text-left transition-colors ${
                  activeTab === "home" ? "bg-cobalt-light text-cobalt" : "text-ink-muted hover:bg-ledger"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Home
              </button>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                1 Set Up
              </p>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab("home")}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger text-left"
                >
                  <Boxes className="w-4 h-4" />
                  Items ({domainDetail?.items?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("home")}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger text-left"
                >
                  <Sliders className="w-4 h-4" />
                  Factors ({domainDetail?.factors?.length || 0})
                </button>
              </div>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                2 Build
              </p>
              <button
                onClick={() => setActiveTab("strategy")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-medium text-left transition-colors ${
                  activeTab === "strategy" ? "bg-cobalt-light text-cobalt" : "text-ink-muted hover:bg-ledger"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Strategy Studio
              </button>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                3 Test
              </p>
              <button
                onClick={() => {
                  setActiveTab("simulation");
                  handleRunSimulation();
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-medium text-left transition-colors ${
                  activeTab === "simulation" ? "bg-cobalt-light text-cobalt" : "text-ink-muted hover:bg-ledger"
                }`}
              >
                <FlaskConical className="w-4 h-4" />
                Simulation Lab
              </button>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                Understand
              </p>
              <button
                onClick={() => setActiveTab("explain")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-medium text-left transition-colors ${
                  activeTab === "explain" ? "bg-cobalt-light text-cobalt" : "text-ink-muted hover:bg-ledger"
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                Explain ("Why this price?")
              </button>
            </div>
          </nav>
        </div>

        {/* Engine Status */}
        <div className="border-t border-ink-border pt-3 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-lagoon"></span>
              Full Stack Online
            </span>
            <span className="font-mono text-[10px]">Pure Decimal</span>
          </div>
          <div className="text-[10px] text-ink-subtle">
            Single Entry Point: Port 3000
          </div>
        </div>
      </aside>

      {/* Main Workbench */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="h-14 border-b border-ink-border bg-paper px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-muted">Active Domain:</span>
              <div className="relative">
                <select
                  value={selectedDomainId}
                  onChange={(e) => setSelectedDomainId(e.target.value)}
                  className="appearance-none bg-ledger border border-ink-border rounded-md px-3 py-1 pr-7 text-xs font-semibold text-ink cursor-pointer focus:outline-none focus:ring-1 focus:ring-cobalt"
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-ink-muted absolute right-2 top-2 pointer-events-none" />
              </div>
            </div>

            <div className="h-4 w-px bg-ink-border"></div>

            {/* Item Selector */}
            {domainDetail?.items && domainDetail.items.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-ink-muted">Item:</span>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="bg-ledger border border-ink-border rounded-md px-3 py-1 text-xs font-medium text-ink cursor-pointer focus:outline-none"
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

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCopilot(true)}
              className="px-3 py-1.5 rounded-md border border-marigold/40 bg-marigold-light text-ink text-xs font-semibold hover:bg-marigold/20 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-marigold" />
              AI Copilot (Ctrl+K)
            </button>
            <button
              onClick={() => {
                setActiveTab("simulation");
                handleRunSimulation();
              }}
              className="px-4 py-1.5 rounded-md bg-cobalt text-paper text-xs font-semibold hover:bg-opacity-95 transition-all flex items-center gap-1.5 shadow-sm"
            >
              Simulate Price
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Dynamic View Body */}
        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
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

          {/* Price Strip + Waterfall Component */}
          <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-ink-border pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink font-mono">
                  Deterministic Price Strip & Waterfall
                </h3>
                <p className="text-xs text-ink-muted">
                  Connected seamlessly to backend Decimal engine (Evaluated in {isLoading ? "..." : "< 2ms"})
                </p>
              </div>

              {/* Price Output */}
              <div className="text-right">
                <div className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                  Computed Output Price
                </div>
                <div
                  className={`text-3xl font-bold font-mono text-ink tabular-nums transition-all ${
                    isAnimating ? "animate-price-pulse text-marigold" : ""
                  }`}
                >
                  {currentUnit === "% APR" ? `${outputPrice}% APR` : `${currentUnit}${outputPrice}`}
                </div>
              </div>
            </div>

            {/* Interactive Factor Sliders */}
            {domainDetail?.factors && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-ledger p-4 rounded-md border border-ink-border">
                {domainDetail.factors.map((f: any) => {
                  const val = factors[f.name] !== undefined ? factors[f.name] : f.default;
                  if (typeof f.default === "number") {
                    const min = f.default < 1 ? 0.0 : Math.max(0, f.default * 0.5);
                    const max = f.default < 1 ? 1.0 : f.default * 2.0;
                    const step = f.default < 1 ? 0.05 : 1;
                    return (
                      <div key={f.name} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-ink capitalize">
                            {f.name.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono text-cobalt font-semibold">
                            {typeof val === "number" ? val.toFixed(2) : val}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={val}
                          onChange={(e) => handleFactorChange(f.name, parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-ink-border rounded-lg appearance-none cursor-pointer accent-cobalt"
                        />
                        <div className="text-[10px] text-ink-subtle">{f.description}</div>
                      </div>
                    );
                  } else if (typeof f.default === "boolean") {
                    return (
                      <div key={f.name} className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-xs font-medium text-ink capitalize">
                            {f.name.replace(/_/g, " ")}
                          </div>
                          <div className="text-[10px] text-ink-subtle">{f.description}</div>
                        </div>
                        <button
                          onClick={() => handleFactorChange(f.name, !val)}
                          className={`px-3 py-1 rounded text-xs font-semibold ${
                            val ? "bg-lagoon text-paper" : "bg-ink-border text-ink"
                          }`}
                        >
                          {val ? "TRUE" : "FALSE"}
                        </button>
                      </div>
                    );
                  } else {
                    return (
                      <div key={f.name} className="space-y-1.5">
                        <div className="text-xs font-medium text-ink capitalize">
                          {f.name.replace(/_/g, " ")}
                        </div>
                        <input
                          type="text"
                          value={val || ""}
                          onChange={(e) => handleFactorChange(f.name, e.target.value)}
                          className="w-full px-2.5 py-1 text-xs border border-ink-border rounded bg-paper font-mono"
                        />
                      </div>
                    );
                  }
                })}
              </div>
            )}

            {/* Waterfall Steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
                <span>Evaluation Waterfall Journey</span>
                <span className="font-mono text-[10px] text-ink-subtle">
                  Decision Hash: {evalResult?.trace?.decision_hash?.substring(0, 16)}...
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {evalResult?.trace?.steps?.slice(0, 5).map((step, idx) => {
                  const isBase = step.stage === "base";
                  const isNegative = parseFloat(step.adjustment) < 0;
                  const isPositive = parseFloat(step.adjustment) > 0;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-md border text-center transition-all ${
                        isBase
                          ? "bg-ledger border-ink-border"
                          : isPositive
                          ? "bg-lagoon-light/60 border-lagoon/20"
                          : isNegative
                          ? "bg-coral-light/60 border-coral/20"
                          : "bg-paper border-ink-border"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-mono text-ink-subtle block truncate">
                        {step.rule_name || step.stage}
                      </span>
                      <span className="text-base font-bold font-mono text-ink tabular-nums block mt-1">
                        {isBase ? `${currentUnit}${step.input_price}` : `${isPositive ? "+" : ""}${step.adjustment}`}
                      </span>
                      <span className="text-[10px] font-mono text-ink-muted block mt-0.5">
                        → {currentUnit}{step.output_price}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tab 2: Strategy Studio */}
          {activeTab === "strategy" && domainDetail && (
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Strategy Studio — Rule Configurations</h3>
                  <p className="text-xs text-ink-muted">
                    Declarative domain pack rules for {domainDetail.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowCopilot(true)}
                  className="px-3 py-1.5 rounded bg-cobalt text-paper text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Rule with AI Copilot
                </button>
              </div>

              <div className="space-y-3">
                {domainDetail.strategy?.rules?.map((rule: any) => (
                  <div key={rule.id} className="p-4 bg-ledger border border-ink-border rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-cobalt-light text-cobalt font-semibold">
                          {rule.stage}
                        </span>
                        <h4 className="text-sm font-bold text-ink">{rule.name}</h4>
                      </div>
                      <span className="text-xs font-mono font-bold text-ink">
                        Action: {rule.action?.type} ({rule.action?.value})
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted">{rule.description}</p>
                    <div className="text-[11px] font-mono text-ink-subtle">
                      Conditions: {rule.conditions?.map((c: any) => `${c.field} ${c.operator} ${c.value}`).join(" AND ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Simulation Lab */}
          {activeTab === "simulation" && (
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Simulation Lab — Scenario Curve</h3>
                  <p className="text-xs text-ink-muted">
                    Sweep factor analysis evaluated through pure Decimal engine
                  </p>
                </div>
                <button
                  onClick={handleRunSimulation}
                  disabled={simLoading}
                  className="px-3 py-1.5 rounded bg-cobalt text-paper text-xs font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${simLoading ? "animate-spin" : ""}`} />
                  Re-run Sweep
                </button>
              </div>

              {simPoints.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-7 gap-2">
                    {simPoints.map((pt, i) => (
                      <div key={i} className="p-3 bg-ledger border border-ink-border rounded text-center">
                        <span className="text-[10px] font-mono text-ink-subtle block">Factor: {pt.sweep_value}</span>
                        <span className="text-sm font-bold font-mono text-cobalt block mt-1">
                          {currentUnit}{pt.final_price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Explain ("Why this price?") */}
          {activeTab === "explain" && evalResult && (
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Audit Trace Deep Dive ("Why this price?")</h3>
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
                    <div key={i} className="p-3 bg-ledger border border-ink-border rounded flex items-center justify-between text-xs">
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
              <button onClick={() => setShowCopilot(false)} className="text-ink-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-ink-muted">
              Enter a natural language pricing strategy. The copilot uses Google Gemini (or deterministic offline parser) to formulate a strict schema rule.
            </p>

            <div className="space-y-2">
              <textarea
                rows={3}
                value={copilotPrompt}
                onChange={(e) => setCopilotPrompt(e.target.value)}
                placeholder="e.g., If occupancy rate exceeds 0.85, apply a 20% surge uplift"
                className="w-full p-2.5 text-xs border border-ink-border rounded-md bg-ledger focus:outline-none focus:ring-1 focus:ring-cobalt font-sans"
              />
              <button
                onClick={handleGenerateCopilotRule}
                disabled={copilotLoading}
                className="w-full py-2 bg-ink text-paper text-xs font-semibold rounded-md hover:bg-opacity-90 transition-all flex items-center justify-center gap-1.5"
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
              <div className="p-3 bg-ledger border border-ink-border rounded-md space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{copilotProposal.rule.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-lagoon-light text-lagoon">
                    {copilotProposal.provider}
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted">{copilotProposal.explanation}</p>
                <div className="font-mono text-[10px] bg-paper p-2 rounded border border-ink-border">
                  Stage: {copilotProposal.rule.stage} | Action: {copilotProposal.rule.action.type} (
                  {copilotProposal.rule.action.value})
                </div>
                <button
                  onClick={handleApplyCopilotRule}
                  className="w-full py-1.5 bg-cobalt text-paper font-semibold rounded text-xs hover:bg-opacity-90"
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
    </div>
  );
}
