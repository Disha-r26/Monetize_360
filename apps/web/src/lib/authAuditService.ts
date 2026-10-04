import { User } from "@supabase/supabase-js";

export interface AuthAuditEventPayload {
  author: string;
  action: "user_login" | "user_logout";
  event_type: "user_login" | "user_logout";
  display_title: "User Logged In" | "User Logged Out";
  category: "user_actions";
  actor: string;
  actor_name: string;
  actor_email: string;
  actor_user_id?: string;
  description: string;
  domain_id?: string;
  details?: Record<string, unknown>;
}

export interface AuthAuditResponse {
  success: boolean;
  entry?: any;
  error?: string;
}

/**
 * Resolves user display name from metadata, persona, or email prefix.
 */
export function resolveUserDisplayName(user: User | null | undefined): string {
  if (!user) return "Authenticated User";

  // Check user metadata for full_name or name
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
  if (fullName && typeof fullName === "string" && fullName.trim().length > 0) {
    return fullName.trim();
  }

  // Check if demo user
  const email = user.email?.toLowerCase() || "";
  if (email.includes("demo")) {
    return "Monetize360 Demo";
  }

  // Fallback to humanized email prefix
  if (user.email) {
    const prefix = user.email.split("@")[0];
    if (prefix) {
      return prefix
        .split(/[._-]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return user.email;
  }

  return "Authenticated User";
}

/**
 * Resolves user email from User object
 */
export function resolveUserEmail(user: User | null | undefined): string {
  return user?.email || "unknown@monetize360.io";
}

/**
 * Records a real user login audit event to the unified persistent audit trail.
 * Called immediately upon successful signInWithPassword() or direct account creation.
 */
export async function logUserLogin(
  user: User,
  options?: {
    domainId?: string;
    loginMethod?: string;
  }
): Promise<AuthAuditResponse> {
  const actor = resolveUserDisplayName(user);
  const actorEmail = resolveUserEmail(user);
  const domainId = options?.domainId || "hospitality";
  const loginMethod = options?.loginMethod || "email authentication";

  const description = `${actor} signed in via email authentication`;

  const payload: AuthAuditEventPayload = {
    author: actor,
    action: "user_login",
    event_type: "user_login",
    display_title: "User Logged In",
    category: "user_actions",
    actor,
    actor_name: actor,
    actor_email: actorEmail,
    actor_user_id: user.id,
    description,
    domain_id: domainId,
    details: {
      event_type: "user_login",
      display_title: "User Logged In",
      category: "user_actions",
      actor,
      actor_name: actor,
      actor_email: actorEmail,
      actor_user_id: user.id,
      description,
      email: actorEmail,
      login_method: loginMethod,
    },
  };

  try {
    const res = await fetch("/api/governance/audit-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Failed to record login audit event:", res.status, errText);
      return { success: false, error: errText };
    }

    const data = await res.json();
    return { success: true, entry: data.entry };
  } catch (err: any) {
    console.warn("Network error recording login audit event:", err?.message);
    return { success: false, error: err?.message };
  }
}

/**
 * Records a real user logout audit event to the unified persistent audit trail.
 * IMPORTANT: Captured BEFORE session destruction so user identity is preserved.
 */
export async function logUserLogout(
  user: User | null | undefined,
  options?: {
    domainId?: string;
  }
): Promise<AuthAuditResponse> {
  const actor = resolveUserDisplayName(user);
  const actorEmail = resolveUserEmail(user);
  const domainId = options?.domainId || "hospitality";

  const description = `${actor} terminated session`;

  const payload: AuthAuditEventPayload = {
    author: actor,
    action: "user_logout",
    event_type: "user_logout",
    display_title: "User Logged Out",
    category: "user_actions",
    actor,
    actor_name: actor,
    actor_email: actorEmail,
    actor_user_id: user?.id,
    description,
    domain_id: domainId,
    details: {
      event_type: "user_logout",
      display_title: "User Logged Out",
      category: "user_actions",
      actor,
      actor_name: actor,
      actor_email: actorEmail,
      actor_user_id: user?.id,
      description,
      email: actorEmail,
    },
  };

  try {
    const res = await fetch("/api/governance/audit-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Failed to record logout audit event:", res.status, errText);
      return { success: false, error: errText };
    }

    const data = await res.json();
    return { success: true, entry: data.entry };
  } catch (err: any) {
    console.warn("Network error recording logout audit event:", err?.message);
    return { success: false, error: err?.message };
  }
}
