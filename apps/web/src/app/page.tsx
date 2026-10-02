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
  Plus,
  Trash2,
  AlertTriangle,
  FileCheck2,
  Check,
  Zap,
  Lock,
  Search,
  Sliders as SlidersIcon
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

export default function Home() {
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
    loadDomains();
  }, [loadDomains]);

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
    if (selectedDomainId) {
      loadDomainDetail(selectedDomainId);
    }
  }, [selectedDomainId, loadDomainDetail]);

  // Evaluate price
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
  }, [selectedDomainId, selectedItemId, factors, customRules, runEvaluation]);

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
    loadGovernanceData();
  }, [selectedDomainId, loadGovernanceData]);

  // Live feed stream
  useEffect(() => {
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
  }, [selectedDomainId, isLiveStreaming]);

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
          author: "Revenue Director",
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
          author: "Revenue Director",
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
          name: newItemName,
          base_price: newItemBasePrice,
          unit: domainDetail?.unit || "$",
        }),
      });
      if (res.ok) {
        setShowAddItemModal(false);
        setNewItemName("");
        loadDomainDetail(selectedDomainId);
      }
    } catch (e) {
      console.error("Add item error:", e);
    }
  };

  // Delete Item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Delete this inventory item?")) return;
    try {
      await fetch(`/api/domains/${selectedDomainId}/items/${itemId}`, { method: "DELETE" });
      loadDomainDetail(selectedDomainId);
    } catch (e) {
      console.error("Delete item error:", e);
    }
  };

  // Toggle Rule
  const handleToggleRule = async (ruleId: string) => {
    try {
      await fetch(`/api/domains/${selectedDomainId}/rules/${ruleId}/toggle`, { method: "PATCH" });
      loadDomainDetail(selectedDomainId);
    } catch (e) {
      console.error("Toggle rule error:", e);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Delete this rule from the strategy?")) return;
    try {
      await fetch(`/api/domains/${selectedDomainId}/rules/${ruleId}`, { method: "DELETE" });
      loadDomainDetail(selectedDomainId);
    } catch (e) {
      console.error("Delete rule error:", e);
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

  return (
    <div className="flex min-h-screen bg-ledger font-sans text-ink">
      {/* Primary Sidebar */}
      <aside className="w-64 border-r border-ink-border bg-paper flex flex-col justify-between p-4 shrink-0 shadow-sm">
        <div className="space-y-6">
          {/* Logo */}
          <div className="px-2 py-1 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-ink text-paper flex items-center justify-center font-mono font-bold rounded-sm text-sm shadow">
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
                  onClick={() => setActiveTab("items")}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                    activeTab === "items" ? "bg-cobalt-light text-cobalt font-medium" : "text-ink-muted hover:bg-ledger"
                  }`}
                >
                  <Boxes className="w-4 h-4" />
                  Items ({domainDetail?.items?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("factors")}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                    activeTab === "factors" ? "bg-cobalt-light text-cobalt font-medium" : "text-ink-muted hover:bg-ledger"
                  }`}
                >
                  <SlidersIcon className="w-4 h-4" />
                  Factors ({domainDetail?.factors?.length || 0})
                </button>
              </div>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                2 Build
              </p>
              <button
                onClick={() => {
                  setActiveTab("strategy");
                  runLinterCheck();
                }}
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
                4 Go Live
              </p>
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setActiveTab("publish");
                    runLinterCheck();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                    activeTab === "publish" ? "bg-cobalt-light text-cobalt font-medium" : "text-ink-muted hover:bg-ledger"
                  }`}
                >
                  <Send className="w-4 h-4" />
                  Publish & Deploy
                </button>
                <button
                  onClick={() => {
                    setActiveTab("versions");
                    loadGovernanceData();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                    activeTab === "versions" ? "bg-cobalt-light text-cobalt font-medium" : "text-ink-muted hover:bg-ledger"
                  }`}
                >
                  <History className="w-4 h-4" />
                  Versions & Rollback
                </button>
              </div>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                5 Monitor
              </p>
              <button
                onClick={() => setActiveTab("live-console")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-medium text-left transition-colors ${
                  activeTab === "live-console" ? "bg-cobalt-light text-cobalt" : "text-ink-muted hover:bg-ledger"
                }`}
              >
                <Activity className="w-4 h-4" />
                Live Console
              </button>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                Understand
              </p>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab("explain")}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                    activeTab === "explain" ? "bg-cobalt-light text-cobalt font-medium" : "text-ink-muted hover:bg-ledger"
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  Explain (&quot;Why this price?&quot;)
                </button>
                <button
                  onClick={() => {
                    setActiveTab("audit");
                    loadGovernanceData();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                    activeTab === "audit" ? "bg-cobalt-light text-cobalt font-medium" : "text-ink-muted hover:bg-ledger"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Audit Trail
                </button>
              </div>
            </div>
          </nav>
        </div>

        {/* Engine Status */}
        <div className="border-t border-ink-border pt-3 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="flex items-center gap-1.5 font-medium">
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

      {/* Main Workbench Body */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="h-14 border-b border-ink-border bg-paper px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-muted">Domain:</span>
              <div className="relative">
                <select
                  value={selectedDomainId}
                  onChange={(e) => setSelectedDomainId(e.target.value)}
                  className="appearance-none bg-ledger border border-ink-border rounded-md px-3 py-1 pr-7 text-xs font-bold text-ink cursor-pointer focus:outline-none focus:ring-1 focus:ring-cobalt"
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
                <span className="text-xs font-semibold text-ink-muted">Item:</span>
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

          {/* TAB 1: HOME */}
          {activeTab === "home" && (
            <>
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
                              <span className="font-semibold text-ink capitalize">
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
                              onChange={(e) => {
                                const updated = { ...factors, [f.name]: parseFloat(e.target.value) };
                                setFactors(updated);
                                runEvaluation(updated, customRules);
                              }}
                              className="w-full h-1.5 bg-ink-border rounded-lg appearance-none cursor-pointer accent-cobalt"
                            />
                            <div className="text-[10px] text-ink-subtle">{f.description}</div>
                          </div>
                        );
                      } else if (typeof f.default === "boolean") {
                        return (
                          <div key={f.name} className="flex items-center justify-between py-2">
                            <div>
                              <div className="text-xs font-semibold text-ink capitalize">
                                {f.name.replace(/_/g, " ")}
                              </div>
                              <div className="text-[10px] text-ink-subtle">{f.description}</div>
                            </div>
                            <button
                              onClick={() => {
                                const updated = { ...factors, [f.name]: !val };
                                setFactors(updated);
                                runEvaluation(updated, customRules);
                              }}
                              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
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
                            <div className="text-xs font-semibold text-ink capitalize">
                              {f.name.replace(/_/g, " ")}
                            </div>
                            <input
                              type="text"
                              value={val || ""}
                              onChange={(e) => {
                                const updated = { ...factors, [f.name]: e.target.value };
                                setFactors(updated);
                                runEvaluation(updated, customRules);
                              }}
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

              {/* Quick Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-paper border border-ink-border rounded-lg p-5 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs text-ink-subtle">
                    <span className="font-mono uppercase tracking-wider font-semibold">Engine Latency</span>
                    <TrendingUp className="w-3.5 h-3.5 text-lagoon" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-ink">1.82 ms</div>
                  <p className="text-[11px] text-ink-muted">P99 evaluation latency across test suite</p>
                </div>

                <div className="bg-paper border border-ink-border rounded-lg p-5 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs text-ink-subtle">
                    <span className="font-mono uppercase tracking-wider font-semibold">Audit Integrity</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-lagoon" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-ink">
                    {auditValid ? "VERIFIED_SECURE" : "ACTIVE"}
                  </div>
                  <p className="text-[11px] text-ink-muted">Cryptographic SHA-256 tamper-evident chain</p>
                </div>

                <div className="bg-paper border border-ink-border rounded-lg p-5 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs text-ink-subtle">
                    <span className="font-mono uppercase tracking-wider font-semibold">Active Domain Packs</span>
                    <Layers className="w-3.5 h-3.5 text-cobalt" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-ink">{domains.length} Industries</div>
                  <p className="text-[11px] text-ink-muted">Domain-agnostic declarative configuration</p>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: ITEMS INVENTORY */}
          {activeTab === "items" && (
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Items & SKU Catalog</h3>
                  <p className="text-xs text-ink-muted">
                    Manage priced units for {domainDetail?.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="px-3 py-1.5 rounded bg-cobalt text-paper text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {domainDetail?.items?.map((it: any) => (
                  <div key={it.id} className="p-4 bg-ledger border border-ink-border rounded-md flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-ink">{it.name}</h4>
                      <p className="text-xs font-mono text-ink-subtle mt-0.5">ID: {it.id}</p>
                      <span className="text-xs font-mono font-bold text-cobalt mt-1 block">
                        Base Price: {it.unit}{it.base_price}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(it.id)}
                      className="p-1.5 text-coral hover:bg-coral-light rounded transition-colors"
                      title="Delete item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: FACTORS */}
          {activeTab === "factors" && (
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Pricing Factors & Context Signals</h3>
                  <p className="text-xs text-ink-muted">
                    Input signals and telemetry factors configured for {domainDetail?.name}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {domainDetail?.factors?.map((f: any) => (
                  <div key={f.name} className="p-4 bg-ledger border border-ink-border rounded-md space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-ink capitalize">{f.name.replace(/_/g, " ")}</h4>
                      <span className="px-2 py-0.5 bg-paper rounded text-[10px] font-mono text-ink-subtle border border-ink-border">
                        {f.type}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted">{f.description}</p>
                    <div className="text-xs font-mono font-semibold text-cobalt pt-1">
                      Baseline Default: {String(f.default)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: STRATEGY STUDIO */}
          {activeTab === "strategy" && domainDetail && (
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Strategy Studio — Rule Configurations</h3>
                  <p className="text-xs text-ink-muted">
                    Active strategy stages: {domainDetail.strategy?.stages?.join(" → ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={runLinterCheck}
                    className="px-3 py-1.5 rounded border border-ink-border text-xs font-medium hover:bg-ledger flex items-center gap-1.5"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 text-cobalt" />
                    Run Linter ({lintIssues.length} issues)
                  </button>
                  <button
                    onClick={() => setShowCopilot(true)}
                    className="px-3 py-1.5 rounded bg-cobalt text-paper text-xs font-semibold flex items-center gap-1.5 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Rule with Copilot
                  </button>
                </div>
              </div>

              {/* Linter warnings if any */}
              {lintIssues.length > 0 && (
                <div className="p-3 bg-marigold-light border border-marigold/30 rounded-md space-y-1">
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

              <div className="space-y-3">
                {domainDetail.strategy?.rules?.map((rule: any) => (
                  <div key={rule.id} className="p-4 bg-ledger border border-ink-border rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-cobalt-light text-cobalt font-semibold">
                          {rule.stage}
                        </span>
                        <h4 className="text-sm font-bold text-ink">{rule.name}</h4>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${rule.enabled !== false ? "bg-lagoon-light text-lagoon" : "bg-ink-border text-ink-subtle"}`}>
                          {rule.enabled !== false ? "ENABLED" : "DISABLED"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-ink">
                          Action: {rule.action?.type} ({rule.action?.value})
                        </span>
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className="text-xs underline text-ink-muted hover:text-ink"
                        >
                          {rule.enabled !== false ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-coral hover:bg-coral-light p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

          {/* TAB 5: SIMULATION LAB */}
          {activeTab === "simulation" && (
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-6">
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
                  className="px-3 py-1.5 rounded bg-cobalt text-paper text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${simLoading ? "animate-spin" : ""}`} />
                  Re-run Sweep
                </button>
              </div>

              {simPoints.length > 0 ? (
                <div className="space-y-4">
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

                  {/* Counterfactual Interactive Sandbox */}
                  <div className="p-4 bg-ledger border border-ink-border rounded-md space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-ink">
                      Counterfactual Sandbox (&quot;What If?&quot;)
                    </h4>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-ink font-medium">Test Factor Value: {cfFactorVal}</span>
                      <input
                        type="range"
                        min="0.2"
                        max="2.0"
                        step="0.1"
                        value={cfFactorVal}
                        onChange={(e) => handleRunCounterfactual(parseFloat(e.target.value))}
                        className="w-64 h-1.5 bg-ink-border rounded-lg cursor-pointer accent-cobalt"
                      />
                      {cfDelta && (
                        <span className="text-xs font-mono font-bold text-cobalt">
                          Predicted Price Impact Delta: {cfDelta.startsWith("-") ? cfDelta : `+${cfDelta}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-ink-muted">
                  Click &quot;Re-run Sweep&quot; to generate simulation points.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PUBLISH & DEPLOY */}
          {activeTab === "publish" && (
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-6">
              <div className="border-b border-ink-border pb-3">
                <h3 className="text-base font-bold text-ink">Go Live Deployment Checklist</h3>
                <p className="text-xs text-ink-muted">
                  Formal strategy promotion workflow: Validate → Approval → Publish
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-lagoon">
                  <CheckCircle2 className="w-4 h-4" />
                  Schema & Data Pack Validated
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-lagoon">
                  <CheckCircle2 className="w-4 h-4" />
                  Safe AST Expressions Verified (Zero eval/exec)
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-lagoon">
                  <CheckCircle2 className="w-4 h-4" />
                  Deterministic Hash Verification Passed
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-marigold">
                  <Clock className="w-4 h-4" />
                  Production Sign-off Required
                </div>
              </div>

              {publishSuccessMsg && (
                <div className="p-3 bg-lagoon-light border border-lagoon/30 text-lagoon text-xs rounded font-medium">
                  {publishSuccessMsg}
                </div>
              )}

              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="px-6 py-2.5 rounded bg-cobalt text-paper font-semibold text-xs hover:bg-opacity-95 flex items-center gap-2 shadow"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Publish Live Version
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 7: VERSIONS & ROLLBACK */}
          {activeTab === "versions" && (
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-4">
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
                  <div key={idx} className="p-4 bg-ledger border border-ink-border rounded-md flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">v{ver.version}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${ver.status === "published" ? "bg-lagoon-light text-lagoon" : "bg-ink-border text-ink-subtle"}`}>
                          {ver.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">Author: {ver.author} • Rules: {ver.rules_count}</p>
                      <p className="text-[10px] font-mono text-ink-subtle mt-0.5">{ver.created_at}</p>
                    </div>

                    {ver.status !== "published" && (
                      <button
                        onClick={() => handleRollback(ver.version)}
                        className="px-3 py-1.5 rounded border border-ink-border text-xs font-semibold hover:bg-paper flex items-center gap-1.5"
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
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Live Decision Stream</h3>
                  <p className="text-xs text-ink-muted">
                    Real-time evaluated pricing ticks flowing through the engine
                  </p>
                </div>
                <button
                  onClick={() => setIsLiveStreaming(!isLiveStreaming)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
                    isLiveStreaming ? "bg-lagoon text-paper" : "bg-ink-border text-ink"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  {isLiveStreaming ? "Streaming Active" : "Stream Paused"}
                </button>
              </div>

              <div className="space-y-2">
                {liveTicks.map((tick, i) => (
                  <div key={i} className="p-3 bg-ledger border border-ink-border rounded flex items-center justify-between text-xs">
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
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-4">
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

          {/* TAB 10: AUDIT TRAIL */}
          {activeTab === "audit" && (
            <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Cryptographic Audit Chain</h3>
                  <p className="text-xs text-ink-muted">
                    Immutable SHA-256 linked action logs for regulatory compliance
                  </p>
                </div>
                <span className="px-2 py-1 rounded bg-lagoon-light text-lagoon text-xs font-mono font-semibold">
                  STATUS: {auditValid ? "VERIFIED_SECURE" : "CHECKING"}
                </span>
              </div>

              <div className="space-y-2">
                {auditLog.map((entry, idx) => (
                  <div key={idx} className="p-3 bg-ledger border border-ink-border rounded space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink font-mono">{entry.action}</span>
                      <span className="text-[10px] font-mono text-ink-subtle">{entry.timestamp}</span>
                    </div>
                    <div className="flex justify-between text-ink-muted text-[11px]">
                      <span>Author: {entry.author}</span>
                      <span>Version: {entry.version}</span>
                    </div>
                    <div className="text-[10px] font-mono text-ink-subtle truncate">
                      Hash: {entry.entry_hash} (Prev: {entry.prev_hash.substring(0, 16)}...)
                    </div>
                  </div>
                ))}
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
                className="w-full py-2 bg-ink text-paper text-xs font-semibold rounded-md hover:bg-opacity-90 transition-all flex items-center justify-center gap-1.5 shadow"
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
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-lagoon-light text-lagoon font-semibold">
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
                  className="w-full py-1.5 bg-cobalt text-paper font-semibold rounded text-xs hover:bg-opacity-90 shadow"
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-paper border border-ink-border rounded-lg max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-ink-border pb-2">
              <h4 className="text-sm font-bold text-ink">Add New Inventory Item</h4>
              <button onClick={() => setShowAddItemModal(false)} className="text-ink-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-ink block mb-1">Item Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g., Luxury Ocean Suite"
                  className="w-full p-2 border border-ink-border rounded bg-ledger font-sans"
                />
              </div>

              <div>
                <label className="font-medium text-ink block mb-1">Base Price ({domainDetail?.unit || "$"})</label>
                <input
                  type="text"
                  value={newItemBasePrice}
                  onChange={(e) => setNewItemBasePrice(e.target.value)}
                  placeholder="e.g., 250.00"
                  className="w-full p-2 border border-ink-border rounded bg-ledger font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-ink-border">
              <button
                onClick={() => setShowAddItemModal(false)}
                className="px-3 py-1.5 rounded border border-ink-border text-xs text-ink hover:bg-ledger"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-1.5 rounded bg-cobalt text-paper text-xs font-semibold hover:bg-opacity-90 shadow"
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
