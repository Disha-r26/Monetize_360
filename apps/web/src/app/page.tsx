"use client";

import React, { useState } from "react";
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
  ChevronDown
} from "lucide-react";

export default function Home() {
  const [activeDomain, setActiveDomain] = useState("Hospitality");
  const [demandMultiplier, setDemandMultiplier] = useState(1.35);
  const [competitorDiff, setCompetitorDiff] = useState(-5);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  // Dynamic pricing calculation preview
  const basePrice = activeDomain === "Banking" ? 4.5 : activeDomain === "Ride-hailing" ? 14.0 : 180.0;
  const demandAdj = (demandMultiplier - 1.0) * basePrice * 0.75;
  const compAdj = (competitorDiff / 100) * basePrice * 0.4;
  const rawPrice = basePrice + demandAdj + compAdj;
  const roundedPrice = activeDomain === "Banking" 
    ? Math.max(2.5, Math.min(18.0, rawPrice)).toFixed(2)
    : Math.max(10, Math.round(rawPrice * 100) / 100).toFixed(2);

  const handleDemandChange = (val: number) => {
    setIsAnimating(true);
    setDemandMultiplier(val);
    setTimeout(() => setIsAnimating(false), 600);
  };

  const domains = [
    { id: "hospitality", name: "Hospitality", desc: "Hotel rooms & seasonal surge", unit: "$" },
    { id: "travel", name: "Travel", desc: "Flight seats & capacity curves", unit: "$" },
    { id: "banking", name: "Banking", desc: "Loan prime rates & risk offsets", unit: "% APR" },
    { id: "ecommerce", name: "E-Commerce", desc: "Cart value & stock velocity", unit: "$" },
    { id: "ridehailing", name: "Ride-Hailing", desc: "Distance, time & driver supply", unit: "$" },
    { id: "cinema", name: "Cinema / EV", desc: "Peak shows & kW/h charging", unit: "$" }
  ];

  return (
    <div className="flex min-h-screen bg-ledger">
      {/* Primary Sidebar */}
      <aside className="w-64 border-r border-ink-border bg-paper flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-6">
          {/* Logo / Header */}
          <div className="px-2 py-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-ink text-paper flex items-center justify-center font-mono font-bold rounded-sm text-sm">
                M
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-ink">MONETIZE360</h1>
                <p className="text-[10px] uppercase font-mono tracking-wider text-ink-subtle">
                  Dynamic Pricing OS
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-4 text-xs">
            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                Workspace
              </p>
              <a
                href="#"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-cobalt-light text-cobalt font-medium"
              >
                <LayoutDashboard className="w-4 h-4" />
                Home
              </a>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                1 Set Up
              </p>
              <div className="space-y-0.5">
                <a
                  href="#items"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger hover:text-ink transition-colors"
                >
                  <Boxes className="w-4 h-4" />
                  Items
                </a>
                <a
                  href="#factors"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger hover:text-ink transition-colors"
                >
                  <Sliders className="w-4 h-4" />
                  Factors
                </a>
              </div>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                2 Build
              </p>
              <a
                href="#strategy"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger hover:text-ink transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Strategy
              </a>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                3 Test
              </p>
              <a
                href="#simulation"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger hover:text-ink transition-colors"
              >
                <FlaskConical className="w-4 h-4" />
                Simulation
              </a>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                4 Go Live
              </p>
              <div className="space-y-0.5">
                <a
                  href="#publish"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger hover:text-ink transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Publish
                </a>
                <a
                  href="#versions"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger hover:text-ink transition-colors"
                >
                  <History className="w-4 h-4" />
                  Versions
                </a>
              </div>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                5 Monitor
              </p>
              <a
                href="#live-console"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger hover:text-ink transition-colors"
              >
                <Activity className="w-4 h-4" />
                Live Console
              </a>
            </div>

            <div>
              <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-1">
                Understand
              </p>
              <div className="space-y-0.5">
                <a
                  href="#explain"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger hover:text-ink transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                  Explain
                </a>
                <a
                  href="#audit"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-ink-muted hover:bg-ledger hover:text-ink transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Audit
                </a>
              </div>
            </div>
          </nav>
        </div>

        {/* Bottom System Status */}
        <div className="border-t border-ink-border pt-3 space-y-2 text-[11px]">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-lagoon"></span>
              API Online
            </span>
            <span className="font-mono text-[10px]">v1.0.0</span>
          </div>
          <div className="text-[10px] text-ink-subtle">
            Engine: Pure Decimal • Agnostic
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-ink-border bg-paper px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-muted">Domain:</span>
              <div className="relative">
                <select
                  value={activeDomain}
                  onChange={(e) => setActiveDomain(e.target.value)}
                  className="appearance-none bg-ledger border border-ink-border rounded-md px-3 py-1 pr-7 text-xs font-semibold text-ink cursor-pointer focus:outline-none focus:ring-1 focus:ring-cobalt"
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-ink-muted absolute right-2 top-2 pointer-events-none" />
              </div>
            </div>

            <div className="h-4 w-px bg-ink-border"></div>

            {/* Workflow Progress Bar */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="flex items-center gap-1 text-lagoon font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Set up
              </span>
              <ChevronRight className="w-3 h-3 text-ink-subtle" />
              <span className="flex items-center gap-1 text-lagoon font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Build
              </span>
              <ChevronRight className="w-3 h-3 text-ink-subtle" />
              <span className="flex items-center gap-1 text-marigold font-medium">
                <Clock className="w-3.5 h-3.5" /> Test (1 pending)
              </span>
              <ChevronRight className="w-3 h-3 text-ink-subtle" />
              <span className="text-ink-subtle">Go live</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-3 py-1.5 rounded-md border border-ink-border text-xs font-medium text-ink hover:bg-ledger transition-colors flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-marigold" />
              Copilot (Ctrl+K)
            </button>
            <button className="px-4 py-1.5 rounded-md bg-cobalt text-paper text-xs font-semibold hover:bg-opacity-95 transition-all flex items-center gap-1.5 shadow-sm">
              Continue strategy
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Welcome Banner */}
          <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-ink tracking-tight">
                  {activeDomain} Dynamic Pricing Strategy
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-lagoon-light text-lagoon border border-lagoon/20">
                  Active Draft v1.2
                </span>
              </div>
              <p className="text-sm text-ink-muted">
                Universal deterministic pricing engine active. Zero domain branches in core logic.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowExplain(!showExplain)}
                className="px-3 py-2 rounded-md border border-ink-border text-xs font-semibold text-ink hover:bg-ledger transition-colors flex items-center gap-1.5"
              >
                <HelpCircle className="w-4 h-4 text-cobalt" />
                Why this price?
              </button>
              <button className="px-4 py-2 rounded-md bg-cobalt text-paper text-xs font-semibold hover:bg-opacity-90 transition-all flex items-center gap-1.5">
                Simulate Scenarios
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Signature Price Strip + Waterfall Component */}
          <div className="bg-paper border border-ink-border rounded-lg p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-ink-border pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink font-mono">
                  Real-time Price Strip & Waterfall
                </h3>
                <p className="text-xs text-ink-muted">
                  Drag the demand factor slider to observe deterministic 600ms recalculation
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
                  {activeDomain === "Banking" ? `${roundedPrice}% APR` : `$${roundedPrice}`}
                </div>
              </div>
            </div>

            {/* Interactive Signal Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-ledger p-4 rounded-md border border-ink-border">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-ink">Demand Index (Surge Factor)</span>
                  <span className="font-mono text-cobalt font-semibold">{demandMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.80"
                  max="2.50"
                  step="0.05"
                  value={demandMultiplier}
                  onChange={(e) => handleDemandChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-ink-border rounded-lg appearance-none cursor-pointer accent-cobalt"
                />
                <div className="flex justify-between text-[10px] text-ink-subtle font-mono">
                  <span>0.80x (Low)</span>
                  <span>1.00x (Neutral)</span>
                  <span>2.50x (Surge)</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-ink">Competitor Variance Offset</span>
                  <span className="font-mono text-coral font-semibold">{competitorDiff}%</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={competitorDiff}
                  onChange={(e) => handleDemandChange(demandMultiplier)}
                  className="w-full h-1.5 bg-ink-border rounded-lg appearance-none cursor-pointer accent-coral"
                />
                <div className="flex justify-between text-[10px] text-ink-subtle font-mono">
                  <span>-20% Undercut</span>
                  <span>0% Match</span>
                  <span>+20% Premium</span>
                </div>
              </div>
            </div>

            {/* The Price Waterfall */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-ink-muted">Evaluation Waterfall Journey</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-ledger p-3 rounded-md border border-ink-border text-center">
                  <span className="text-[10px] uppercase font-mono text-ink-subtle block">Base Rate</span>
                  <span className="text-base font-bold font-mono text-ink tabular-nums">
                    {activeDomain === "Banking" ? `${basePrice}%` : `$${basePrice}`}
                  </span>
                </div>

                <div className="bg-lagoon-light/60 p-3 rounded-md border border-lagoon/20 text-center">
                  <span className="text-[10px] uppercase font-mono text-lagoon block">Demand Uplift</span>
                  <span className="text-base font-bold font-mono text-lagoon tabular-nums">
                    +{demandAdj >= 0 ? demandAdj.toFixed(2) : "0.00"}
                  </span>
                </div>

                <div className="bg-coral-light/60 p-3 rounded-md border border-coral/20 text-center">
                  <span className="text-[10px] uppercase font-mono text-coral block">Comp Adjust</span>
                  <span className="text-base font-bold font-mono text-coral tabular-nums">
                    {compAdj.toFixed(2)}
                  </span>
                </div>

                <div className="bg-marigold-light/60 p-3 rounded-md border border-marigold/20 text-center">
                  <span className="text-[10px] uppercase font-mono text-marigold block">Guardrails</span>
                  <span className="text-xs font-mono text-ink font-medium mt-1 block">Active (Floor/Cap)</span>
                </div>

                <div className="bg-cobalt-light/60 p-3 rounded-md border border-cobalt/30 text-center">
                  <span className="text-[10px] uppercase font-mono text-cobalt block">Final Evaluated</span>
                  <span className="text-base font-bold font-mono text-cobalt tabular-nums">
                    {activeDomain === "Banking" ? `${roundedPrice}%` : `$${roundedPrice}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Why This Price Drawer */}
            {showExplain && (
              <div className="mt-4 p-4 bg-ledger border border-ink-border rounded-md space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-cobalt" />
                    <h4 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                      Audit Trace Breakdown ("Why this price?")
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-ink-subtle">
                    Decision Hash: 7a8f9c2d...3b1e
                  </span>
                </div>

                <div className="space-y-2 text-xs text-ink-muted">
                  <div className="flex justify-between py-1 border-b border-ink-border/50">
                    <span>1. Base Reference Definition</span>
                    <span className="font-mono text-ink">${basePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-ink-border/50">
                    <span>2. Rule [SURGE_TIER_A]: Demand factor {demandMultiplier.toFixed(2)}x &gt; 1.20</span>
                    <span className="font-mono text-lagoon">+{demandAdj.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-ink-border/50">
                    <span>3. Rule [COMP_OFFSET]: Competitor differential applied</span>
                    <span className="font-mono text-coral">{compAdj.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-ink-border/50">
                    <span>4. Guardrail [FLOOR_CONSTRAINT]: Asserts price &gt;= minimum margin floor</span>
                    <span className="font-mono text-marigold">PASS (within bounds)</span>
                  </div>
                  <div className="flex justify-between py-1 font-semibold text-ink">
                    <span>5. Rounding Policy: Half-up 2 decimal places</span>
                    <span className="font-mono text-cobalt">${roundedPrice}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics & Health */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-paper border border-ink-border rounded-lg p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-ink-subtle">
                <span className="font-mono uppercase tracking-wider">Engine Latency</span>
                <TrendingUp className="w-3.5 h-3.5 text-lagoon" />
              </div>
              <div className="text-2xl font-bold font-mono text-ink">1.82 ms</div>
              <p className="text-[11px] text-ink-muted">P99 evaluation latency across test suite</p>
            </div>

            <div className="bg-paper border border-ink-border rounded-lg p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-ink-subtle">
                <span className="font-mono uppercase tracking-wider">Deterministic Hash Match</span>
                <ShieldCheck className="w-3.5 h-3.5 text-lagoon" />
              </div>
              <div className="text-2xl font-bold font-mono text-ink">100.0%</div>
              <p className="text-[11px] text-ink-muted">Reproducible replay on identical context</p>
            </div>

            <div className="bg-paper border border-ink-border rounded-lg p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-ink-subtle">
                <span className="font-mono uppercase tracking-wider">Active Domain Packs</span>
                <Layers className="w-3.5 h-3.5 text-cobalt" />
              </div>
              <div className="text-2xl font-bold font-mono text-ink">6 Industries</div>
              <p className="text-[11px] text-ink-muted">Hospitality, Travel, Banking, Retail, Rides, Cinema</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
