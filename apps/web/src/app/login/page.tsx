"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseAuth } from "../../lib/supabaseClient";
import { logUserLogin } from "../../lib/authAuditService";
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2, Sparkles, AlertCircle, UserCheck } from "lucide-react";

import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, setAuthSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@monetize360.com";
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "DemoPassword123!";

  // Authoritative redirect: If already authenticated, navigate to Overview ONCE
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  const executeLogin = async (loginEmail: string, loginPass: string, isDemo = false) => {
    if (isLoading) return; // Prevent duplicate submissions while loading
    setErrorMsg(null);

    if (!loginEmail.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!loginPass.trim()) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabaseAuth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPass,
      });

      if (error) {
        setErrorMsg(error.message || "Invalid credentials. Please verify your email and password.");
        setIsLoading(false);
        return;
      }

      if (data?.user && data?.session) {
        // 1. Update single authoritative auth state BEFORE navigating
        setAuthSession(data.session);

        // 2. Record persistent user_login audit event via centralized authAuditService
        await logUserLogin(data.user, {
          domainId: "hospitality",
          loginMethod: isDemo ? "demo_account" : "email authentication",
        });

        // 3. Single authoritative navigation to Home
        router.replace("/");
      } else if (data?.user) {
        setAuthSession({ user: data.user } as any);
        await logUserLogin(data.user, {
          domainId: "hospitality",
          loginMethod: isDemo ? "demo_account" : "email authentication",
        });
        router.replace("/");
      } else {
        setErrorMsg("Failed to establish session. Please try again.");
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred during login. Please try again.");
      setIsLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    executeLogin(email, password, email.trim().toLowerCase() === demoEmail.toLowerCase());
  };

  const handleDemoLogin = () => {
    if (isLoading) return;
    setEmail(demoEmail);
    setPassword(demoPassword);
    executeLogin(demoEmail, demoPassword, true);
  };

  return (
    <div className="min-h-screen bg-ledger flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans text-ink">
      {/* Subtle curved background lines */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0">
        <svg
          className="absolute -top-24 -right-24 w-[700px] h-[700px] text-cobalt/5"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M0,0 C30,40 70,60 100,100 L100,0 Z" fill="currentColor" />
        </svg>
        <svg
          className="absolute -bottom-24 -left-24 w-[600px] h-[600px] text-sidebar/5"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M0,100 C40,70 60,30 100,0 L0,0 Z" fill="currentColor" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sidebar text-white shadow-md mb-1 border border-sidebar-border">
            <span className="font-mono text-xl font-bold tracking-tight">M</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink font-sans">
            MONETIZE360
          </h1>
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider font-mono">
            Dynamic Pricing Intelligence
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-paper border border-ink-border rounded-2xl p-7 shadow-card space-y-5">
          <div className="border-b border-ink-border pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">Sign In to Workspace</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cobalt-light text-cobalt font-semibold border border-cobalt/20">
              Supabase Auth
            </span>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-3 bg-coral-light/70 border border-coral/30 rounded-xl flex items-start gap-2.5 text-xs text-coral animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-ink-muted" />
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-ink-border bg-ledger/60 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt font-sans transition-all text-ink placeholder:text-ink-subtle"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-ink-muted" />
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-ink-border bg-ledger/60 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt font-sans transition-all text-ink placeholder:text-ink-subtle"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-cobalt hover:bg-cobalt-hover text-paper text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Log In
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-ink-border/70" />
            </div>
            <span className="relative bg-paper px-2 text-[11px] font-mono text-ink-subtle uppercase tracking-wider">
              or
            </span>
          </div>

          {/* Hackathon Demo Account Card & 1-Click Action */}
          <div className="p-3.5 rounded-xl border border-lagoon/30 bg-lagoon-light/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-lagoon" />
                Demo Account
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-lagoon/15 text-lagoon font-bold border border-lagoon/30">
                Revenue Director
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span>Persona: <strong className="text-ink">Monetize360 Demo</strong></span>
              <span className="font-mono text-[10px]">{demoEmail}</span>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full py-2 rounded-xl bg-paper hover:bg-ledger border border-ink-border hover:border-lagoon text-xs font-semibold text-ink flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-70"
            >
              <UserCheck className="w-3.5 h-3.5 text-lagoon" />
              Use Demo Account
            </button>
          </div>

          {/* Create Account Navigation Link */}
          <div className="pt-1 text-center text-xs text-ink-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-cobalt hover:underline cursor-pointer"
            >
              Create one
            </Link>
          </div>

          {/* Configuration Status Footer */}
          <div className="pt-3 border-t border-ink-border/60 flex items-center justify-between text-[11px] text-ink-subtle">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-lagoon" />
              Role-Based Access
            </span>
            <span className="font-mono text-[10px]">
              {supabaseAuth.isConfigured ? "Connected: Live Supabase" : "Config Ready • Pending Keys"}
            </span>
          </div>
        </div>

        {/* Informational Guidance */}
        <p className="text-center text-[11px] text-ink-subtle">
          Protected enterprise pricing operations platform with deterministic audit trails.
        </p>
      </div>
    </div>
  );
}
