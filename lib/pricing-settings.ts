"use client";

import { useEffect, useState } from "react";
import { DEFAULT_ADMIN_MARGIN_NET, DEFAULT_SALES_MARGIN_NET } from "@/lib/pricing";
import type { UserRole } from "@/lib/types";

const SETTINGS_KEY = "bcrm-pricing-settings";

export type PricingSettings = {
  adminMargin: number;
  salesMargin: number;
};

const defaultSettings: PricingSettings = {
  adminMargin: DEFAULT_ADMIN_MARGIN_NET,
  salesMargin: DEFAULT_SALES_MARGIN_NET
};

function readSettings(): PricingSettings {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<PricingSettings>;

    return {
      adminMargin: Number.isFinite(parsed.adminMargin) ? Number(parsed.adminMargin) : defaultSettings.adminMargin,
      salesMargin: Number.isFinite(parsed.salesMargin) ? Number(parsed.salesMargin) : defaultSettings.salesMargin
    };
  } catch {
    return defaultSettings;
  }
}

function writeSettings(settings: PricingSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function usePricingSettings(role?: UserRole) {
  const [settings, setSettingsState] = useState<PricingSettings>(defaultSettings);

  useEffect(() => {
    setSettingsState(readSettings());
  }, []);

  function setSettings(next: PricingSettings) {
    const normalized = {
      adminMargin: role === "admin" ? Math.max(Number(next.adminMargin) || 0, 0) : settings.adminMargin,
      salesMargin: Math.max(Number(next.salesMargin) || 0, 0)
    };
    setSettingsState(normalized);
    writeSettings(normalized);
  }

  return { settings, setSettings };
}

