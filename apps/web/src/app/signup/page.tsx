"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseAuth } from "../../lib/supabaseClient";
import { logUserLogin } from "../../lib/authAuditService";
import {
  ShieldCheck,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

export default function SignUpPage() {
  const router = useRouter();
  const { isAuthenticated, setAuthSession } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  // Authoritative redirect: If already authenticated, redirect to Overview ONCE
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation 1: Full name
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    // Validation 2: Email format
    const cleanEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    // Validation 3: Password length
    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    // Validation 4: Passwords match
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error, requiresEmailConfirmation } = await supabaseAuth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
            role: "Pricing Analyst",
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || "Unable to create your account right now. Please try again.");
        setIsLoading(false);
        return;
      }

      // If auto-confirmed with immediate session, record login audit event and navigate to Overview
      if (data?.session?.user) {
        setAuthSession(data.session);
        await logUserLogin(data.session.user, {
          domainId: "hospitality",
          loginMethod: "signup_direct",
        });
        router.replace("/");
        return;
      }

      // Supabase requires email verification
      setIsLoading(false);
      setIsSubmittedSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred during account creation. Please try again.");
      setIsLoading(false);
    }
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

        {/* Card Container */}
        <div className="bg-paper border border-ink-border rounded-2xl p-7 shadow-card space-y-5">
          {isSubmittedSuccess ? (
            /* Email Confirmation Notification Card */
            <div className="space-y-5 text-center py-2 animate-fade-in">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-bold text-ink">Account Created Successfully</h2>
                <p className="text-xs text-ink-muted leading-relaxed">
                  We have registered your account for <span className="font-mono font-medium text-ink">{email}</span>.
                </p>
                <div className="p-3 bg-cobalt-light/50 border border-cobalt/20 rounded-xl text-xs text-cobalt font-medium text-left">
                  Please check your email to confirm your account before signing in. Once confirmed, you can log in to access your workspace.
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="w-full py-2.5 rounded-xl bg-cobalt hover:bg-cobalt-hover text-paper text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  Back to Sign In
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Signup Form */
            <>
              <div className="border-b border-ink-border pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-ink">Create Your Workspace Account</h2>
                  <p className="text-[11px] text-ink-muted">Set up your pricing analyst credentials</p>
                </div>
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

              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-ink-muted" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-ink-border bg-ledger/60 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt font-sans transition-all text-ink placeholder:text-ink-subtle"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-ink-muted" />
                    Work Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@company.com"
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
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-ink-border bg-ledger/60 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt font-sans transition-all text-ink placeholder:text-ink-subtle"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-ink-muted" />
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-ink-border bg-ledger/60 focus:outline-none focus:ring-2 focus:ring-cobalt/30 focus:border-cobalt font-sans transition-all text-ink placeholder:text-ink-subtle"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-cobalt hover:bg-cobalt-hover text-paper text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-3"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Navigation back to login */}
              <div className="pt-2 text-center text-xs text-ink-muted">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-cobalt hover:underline cursor-pointer"
                >
                  Log in
                </Link>
              </div>

              {/* Status Footer */}
              <div className="pt-3 border-t border-ink-border/60 flex items-center justify-between text-[11px] text-ink-subtle">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-lagoon" />
                  Deterministic Pricing Engine
                </span>
                <span className="font-mono text-[10px]">
                  {supabaseAuth.isConfigured ? "Supabase Live" : "Local Gateway"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Informational Guidance */}
        <p className="text-center text-[11px] text-ink-subtle">
          Protected enterprise pricing operations platform with deterministic audit trails.
        </p>
      </div>
    </div>
  );
}
