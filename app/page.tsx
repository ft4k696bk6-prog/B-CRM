"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";
import { homePathForRole, normalizeRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function routeUser() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role,email,crm_environment")
        .eq("id", session.user.id)
        .single();

      router.replace(
        homePathForRole(
          normalizeRole(
            profile?.role,
            profile?.email,
            typeof session.user.app_metadata?.role === "string" ? session.user.app_metadata.role : null
          )
        )
      );
    }

    routeUser();
  }, [router]);

  return <LoadingScreen />;
}
