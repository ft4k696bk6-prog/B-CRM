"use client";

import { languageOptions } from "@/lib/i18n";
import { useLanguage } from "@/components/language-provider";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex rounded-md border border-line bg-white p-1 shadow-sm" aria-label="Language">
      {languageOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLanguage(option.value)}
          className={`h-8 min-w-10 rounded px-3 text-xs font-black transition ${
            language === option.value ? "bg-ink text-white" : "text-muted hover:bg-[#eef3f8] hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
