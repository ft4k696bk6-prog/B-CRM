"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile, UserRole } from "@/lib/types";
import { homePathForRole, normalizeRole } from "@/lib/roles";

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
};

export function useAuth(requiredRole?: UserRole | UserRole[]) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    profile: null
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        if (mounted) setState({ loading: false, session: null, profile: null });
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (!profile) {
        if (mounted) setState({ loading: false, session, profile: null });
        return;
      }

      const normalizedProfile = {
        ...profile,
        role: normalizeRole(profile.role)
      };

      const allowedRoles = Array.isArray(requiredRole) ? requiredRole : requiredRole ? [requiredRole] : [];

      if (allowedRoles.length > 0 && !allowedRoles.includes(normalizedProfile.role)) {
        router.replace(homePathForRole(normalizedProfile.role));
        return;
      }

      if (mounted) setState({ loading: false, session, profile: normalizedProfile });
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [requiredRole, router]);

  return { ...state, loading: state.loading };
}
