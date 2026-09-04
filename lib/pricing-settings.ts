"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_ADMIN_MARGIN_NET,
  DEFAULT_SALES_MARGIN_NET,
} from "@/lib/pricing";
import type { Profile } from "@/lib/types";
import { supabase } from "@/lib/supabase";

export type PricingSettings = {
  adminMargin: number;
  salesMargin: number;
  commissionPercent: number;
};

const defaultSettings: PricingSettings = {
  adminMargin: DEFAULT_ADMIN_MARGIN_NET,
  salesMargin: DEFAULT_SALES_MARGIN_NET,
  commissionPercent: 0,
};

export function usePricingSettings(
  profile?: Pick<
    Profile,
    "id" | "role" | "full_name" | "company_margin_net" | "sales_margin_net"
  > | null,
) {
  const [settings, setSettingsState] =
    useState<PricingSettings>(defaultSettings);

  useEffect(() => {
    setSettingsState(defaultSettings);
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.access_token) return;
      const response = await fetch("/api/pricing-settings", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      const body = (await response
        .json()
        .catch(() => ({}))) as Partial<PricingSettings> & {
        totalMarginNet?: number;
      };
      if (
        response.ok &&
        Number.isFinite(body.adminMargin) &&
        Number.isFinite(body.salesMargin)
      ) {
        setSettingsState({
          adminMargin: Number(body.adminMargin),
          salesMargin: Number(body.salesMargin),
          commissionPercent: Number(body.commissionPercent) || 0,
        });
      } else if (response.ok && Number.isFinite(body.totalMarginNet)) {
        setSettingsState({
          adminMargin: Number(body.totalMarginNet),
          salesMargin: 0,
          commissionPercent: 0,
        });
      }
    });
  }, [
    profile?.company_margin_net,
    profile?.sales_margin_net,
    profile?.full_name,
    profile?.id,
    profile?.role,
  ]);

  function setSettings(next: PricingSettings) {
    if (profile?.role !== "owner" && profile?.role !== "admin") return;
    const normalized = {
      adminMargin: Math.max(Number(next.adminMargin) || 0, 0),
      salesMargin: Math.max(Number(next.salesMargin) || 0, 0),
      commissionPercent: Math.min(
        Math.max(Number(next.commissionPercent) || 0, 0),
        100,
      ),
    };
    setSettingsState(normalized);
    if (profile?.id)
      void supabase.auth.getSession().then(({ data }) => {
        if (!data.session?.access_token) return;
        return fetch("/api/pricing-settings", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify(normalized),
        });
      });
  }

  return { settings, setSettings };
}
