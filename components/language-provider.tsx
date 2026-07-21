"use client";

import { createContext, useContext, type ReactNode } from "react";
import { copy, type AppLanguage } from "@/lib/i18n";

type LanguageContextValue = {
  language: AppLanguage;
  t: (key: keyof typeof copy.pl) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language: AppLanguage = "pl";
  const value: LanguageContextValue = {
    language,
    t: (key) => copy.pl[key]
  };

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
