"use client";

import { useEffect, useState } from "react";
import { DEFAULT_ADMIN_MARGIN_NET, DEFAULT_SALES_MARGIN_NET } from "@/lib/pricing";
import type { Profile } from "@/lib/types";
import { supabase } from "@/lib/supabase";

export type PricingSettings = {
  adminMargin: number;
  salesMargin: number;
};

const defaultSettings: PricingSettings = {
  adminMargin: DEFAULT_ADMIN_MARGIN_NET,
  salesMargin: DEFAULT_SALES_MARGIN_NET
};

export function usePricingSettings(profile?: Pick<Profile,"id"|"role"|"full_name"|"company_margin_net"|"sales_margin_net"> | null) {
  const [settings, setSettingsState] = useState<PricingSettings>(defaultSettings);

  useEffect(() => {
    const preferred = /krystian|wiktoria/i.test(profile?.full_name || "");
    setSettingsState({ adminMargin: profile?.company_margin_net ?? (preferred ? 5000 : DEFAULT_ADMIN_MARGIN_NET), salesMargin: profile?.sales_margin_net ?? (preferred ? 10000 : DEFAULT_SALES_MARGIN_NET) });
  }, [profile?.company_margin_net, profile?.sales_margin_net, profile?.full_name]);

  function setSettings(next: PricingSettings) {
    if (profile?.role !== "owner" && profile?.role !== "admin") return;
    const normalized = {
      adminMargin: Math.max(Number(next.adminMargin) || 0, 0),
      salesMargin: Math.max(Number(next.salesMargin) || 0, 0)
    };
    setSettingsState(normalized);
    if (profile?.id) void supabase.from("profiles").update({ company_margin_net: normalized.adminMargin, sales_margin_net: normalized.salesMargin }).eq("id", profile.id);
  }

  return { settings, setSettings };
}
