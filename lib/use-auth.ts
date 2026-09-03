"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile, UserRole } from "@/lib/types";
import { homePathForRole, normalizeRole } from "@/lib/roles";
import { normalizeCrmScope } from "@/lib/scope";

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
};

let authCache: AuthState | null = null;
let authRequest: Promise<AuthState> | null = null;

async function fetchAuthState(force = false): Promise<AuthState> {
  if (!force && authCache) return authCache;
  if (authRequest) return authRequest;

  authRequest = (async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) return { loading: false, session: null, profile: null };

    const { data: profile } = await supabase.from("profiles").select("id,email,full_name,role,manager_id,crm_environment,created_at,business_phone,can_view_lead_pool").eq("id", session.user.id).single();
    if (!profile) return { loading: false, session, profile: null };

    return {
      loading: false,
      session,
      profile: {
        ...profile,
        business_phone: profile.business_phone || null,
        role: normalizeRole(profile.role, profile.email, typeof session.user.app_metadata?.role === "string" ? session.user.app_metadata.role : null),
        crm_environment: normalizeCrmScope(profile.crm_environment, profile.email)
      } as Profile
    };
  })();

  const result = await authRequest;
  authCache = result;
  authRequest = null;
  return result;
}

export function useAuth(requiredRole?: UserRole | UserRole[]) {
  const router = useRouter();
  const requiredRoleKey = Array.isArray(requiredRole) ? requiredRole.join("|") : requiredRole || "";
  const [state, setState] = useState<AuthState>(() => authCache || { loading: true, session: null, profile: null });

  useEffect(() => {
    let mounted = true;

    async function load(force = false) {
      const nextState = await fetchAuthState(force);
      const { session, profile } = nextState;

      if (!session) {
        if (mounted) setState({ loading: false, session: null, profile: null });
        router.replace("/login");
        return;
      }

      if (!profile) {
        if (mounted) setState({ loading: false, session, profile: null });
        return;
      }

      const allowedRoles = requiredRoleKey ? (requiredRoleKey.split("|") as UserRole[]) : [];

      if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
        router.replace(homePathForRole(profile.role));
        return;
      }

      if (mounted) setState({ loading: false, session, profile });
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      authCache = null;
      load(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [requiredRoleKey, router]);

  return { ...state, loading: state.loading };
}
