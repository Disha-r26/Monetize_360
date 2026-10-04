"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabaseAuth } from "../lib/supabaseClient";

export type AuthState = "LOADING" | "AUTHENTICATED" | "UNAUTHENTICATED";

export interface AuthContextType {
  authState: AuthState;
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuthSession: (session: Session | null) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("LOADING");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // Initial authoritative session check - Runs ONCE at the application root
  const initSession = useCallback(async () => {
    try {
      const { data } = await supabaseAuth.getSession();
      if (data?.session?.user) {
        setSession(data.session);
        setUser(data.session.user);
        setAuthState("AUTHENTICATED");
        return;
      }
      setSession(null);
      setUser(null);
      setAuthState("UNAUTHENTICATED");
    } catch (err) {
      console.warn("[AUTH] Initial session check error:", err);
      setSession(null);
      setUser(null);
      setAuthState("UNAUTHENTICATED");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Run authoritative session initialization
    initSession();

    // 2. Realtime listener: ONLY updates state, NEVER redirects or performs side-effects
    const { data: { subscription } } = supabaseAuth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          setAuthState("AUTHENTICATED");
        }
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setAuthState("UNAUTHENTICATED");
      }
      // Note: We intentionally ignore INITIAL_SESSION with null to prevent premature unauthenticated flips
      // before getSession() completes.
    });

    // 3. Finite safety timeout: Never allow "LOADING" to persist beyond 2.5 seconds
    const timeout = setTimeout(() => {
      if (isMounted) {
        setAuthState((current) => {
          if (current === "LOADING") {
            console.warn("[AUTH] Session verification reached timeout limit; defaulting to UNAUTHENTICATED");
            return "UNAUTHENTICATED";
          }
          return current;
        });
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, [initSession]);

  const setAuthSession = useCallback((newSession: Session | null) => {
    if (newSession?.user) {
      setSession(newSession);
      setUser(newSession.user);
      setAuthState("AUTHENTICATED");
    } else {
      setSession(null);
      setUser(null);
      setAuthState("UNAUTHENTICATED");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabaseAuth.signOut();
    } finally {
      setSession(null);
      setUser(null);
      setAuthState("UNAUTHENTICATED");
    }
  }, []);

  const value = useMemo(
    () => ({
      authState,
      user,
      session,
      isAuthenticated: authState === "AUTHENTICATED",
      isLoading: authState === "LOADING",
      setAuthSession,
      logout,
      refreshSession: initSession,
    }),
    [authState, user, session, setAuthSession, logout, initSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
