"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { copy, LANGUAGE_STORAGE_KEY, type AppLanguage } from "@/lib/i18n";

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: keyof typeof copy.pl) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language: AppLanguage = "pl";

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "pl");
    document.documentElement.lang = "pl";
  }, []);

  function setLanguage() {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "pl");
    document.documentElement.lang = "pl";
  }

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: keyof typeof copy.pl) => copy.pl[key]
    }),
    []
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider.");
  return context;
}
