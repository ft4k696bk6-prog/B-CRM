"use client";

import { useEffect } from "react";
import { applyTheme, isThemeId, THEME_STORAGE_KEY } from "@/lib/theme";

export function ThemeProvider() {
  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    applyTheme(isThemeId(storedTheme) ? storedTheme : "default");
  }, []);

  return null;
}
