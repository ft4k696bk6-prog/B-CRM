"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  defaultTheme,
  isThemeName,
  THEME_STORAGE_KEY,
  userThemeStorageKey,
  type ThemeName,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readTheme(value: unknown): ThemeName | null {
  return typeof value === "string" && isThemeName(value) ? value : null;
}

function resolveTheme(theme: ThemeName, systemDark: boolean) {
  return theme === "system" ? (systemDark ? "dark" : "light") : theme;
}

function applyTheme(theme: ThemeName, systemDark: boolean) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.resolvedTheme = resolveTheme(theme, systemDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(defaultTheme);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncResolvedTheme = () => applyTheme(theme, media.matches);

    syncResolvedTheme();
    media.addEventListener("change", syncResolvedTheme);
    return () => media.removeEventListener("change", syncResolvedTheme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    const browserTheme = readTheme(window.localStorage.getItem(THEME_STORAGE_KEY)) ?? defaultTheme;
    setThemeState(browserTheme);

    function applyUserPreference(session: Session | null) {
      if (!mounted || !session?.user) return;

      const nextUserId = session.user.id;
      const metadataTheme = readTheme(session.user.user_metadata?.bcrm_appearance);
      const localUserTheme = readTheme(window.localStorage.getItem(userThemeStorageKey(nextUserId)));
      const nextTheme = metadataTheme ?? localUserTheme ?? browserTheme;

      setUserId(nextUserId);
      setThemeState(nextTheme);
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      window.localStorage.setItem(userThemeStorageKey(nextUserId), nextTheme);
    }

    void supabase.auth.getSession().then(({ data }) => applyUserPreference(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUserId(null);
        return;
      }
      applyUserPreference(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setTheme = useCallback((nextTheme: ThemeName) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

    if (userId) {
      window.localStorage.setItem(userThemeStorageKey(userId), nextTheme);
      void supabase.auth.updateUser({
        data: { bcrm_appearance: nextTheme },
      });
    }
  }, [userId]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
