"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
}

function readTheme(value: unknown): ThemeName | null {
  return typeof value === "string" && isThemeName(value) ? value : null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(defaultTheme);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const browserTheme = readTheme(window.localStorage.getItem(THEME_STORAGE_KEY)) ?? defaultTheme;
    setThemeState(browserTheme);
    applyTheme(browserTheme);

    function applyUserPreference(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
      if (!mounted || !session?.user) return;

      const nextUserId = session.user.id;
      const metadataTheme = readTheme(session.user.user_metadata?.bcrm_appearance);
      const localUserTheme = readTheme(window.localStorage.getItem(userThemeStorageKey(nextUserId)));
      const nextTheme = metadataTheme ?? localUserTheme ?? browserTheme;

      setUserId(nextUserId);
      setThemeState(nextTheme);
      applyTheme(nextTheme);
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

  function setTheme(nextTheme: ThemeName) {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

    if (userId) {
      window.localStorage.setItem(userThemeStorageKey(userId), nextTheme);
      void supabase.auth.updateUser({
        data: { bcrm_appearance: nextTheme },
      });
    }
  }

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
