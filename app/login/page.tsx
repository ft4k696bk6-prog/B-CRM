"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Calculator,
  Hammer,
  ShieldCheck,
  Truck,
  UsersRound
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useLanguage } from "@/components/language-provider";
import { Alert } from "@/components/ui";
import { homePathForRole, normalizeRole } from "@/lib/roles";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const demoOptions = [
  {
    key: "demo",
    email: "demo@example.com",
    password: "demo-admin",
    labelPl: "Administrator",
    labelEn: "Admin",
    descriptionKey: "fullAccess",
    icon: ShieldCheck
  },
  {
    key: "demo-menadzer",
    email: "demo-menadzer@example.com",
    password: "demo-menadzer",
    labelPl: "Menadżer",
    labelEn: "Manager",
    descriptionKey: "managerDemo",
    icon: UsersRound
  },
  {
    key: "demo-handlowiec",
    email: "demo-handlowiec@example.com",
    password: "demo-handlowiec",
    labelPl: "Handlowiec",
    labelEn: "Sales",
    descriptionKey: "salespersonDemo",
    icon: BriefcaseBusiness
  },
  {
    key: "demo-ksiegowy",
    email: "demo-ksiegowy@example.com",
    password: "demo-ksiegowy",
    labelPl: "Księgowość",
    labelEn: "Accounting",
    descriptionKey: "accountingDemo",
    icon: Calculator
  },
  {
    key: "demo-logistyk",
    email: "demo-logistyk@example.com",
    password: "demo-logistyk",
    labelPl: "Logistyka",
    labelEn: "Logistics",
    descriptionKey: "logisticsDemo",
    icon: Truck
  },
  {
    key: "demo-monter",
    email: "demo-monter@example.com",
    password: "demo-monter",
    labelPl: "Monter",
    labelEn: "Installer",
    descriptionKey: "installerDemo",
    icon: Hammer
  }
] as const;

type DemoAccountKey = (typeof demoOptions)[number]["key"];

export default function LoginPage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [error, setError] = useState("");
  const [loadingKey, setLoadingKey] = useState<DemoAccountKey | null>(null);

  async function onDemoLogin(key: DemoAccountKey) {
    const account = demoOptions.find((item) => item.key === key);
    if (!account) return;

    setError("");
    setLoadingKey(key);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password
    });

    if (signInError || !data.user) {
      setLoadingKey(null);
      setError(t("loginError"));
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,email,crm_environment")
      .eq("id", data.user.id)
      .single();

    setLoadingKey(null);
    router.replace(
      homePathForRole(
        normalizeRole(
          profile?.role,
          profile?.email,
          typeof data.user.app_metadata?.role === "string" ? data.user.app_metadata.role : null
        )
      )
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center">
        <div className="w-full rounded-lg border border-line bg-white p-5 shadow-soft sm:p-6">
          <div className="mb-6 flex items-center gap-3">
            <BrandMark />
            <div>
              <h1 className="text-xl font-bold text-ink">B-CRM DEMO</h1>
              <p className="text-sm text-muted">
                {language === "pl" ? "Wybierz konto demo" : "Choose a demo account"}
              </p>
            </div>
          </div>

          {!isSupabaseConfigured ? (
            <Alert tone="warning" className="mb-4">{t("supabaseMissing")}</Alert>
          ) : null}

          {error ? (
            <Alert tone="danger" className="mb-4">{error}</Alert>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            {demoOptions.map((option) => {
              const Icon = option.icon;
              const loading = loadingKey === option.key;

              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={loadingKey !== null || !isSupabaseConfigured}
                  onClick={() => onDemoLogin(option.key)}
                  className="flex min-h-[82px] items-center gap-3 rounded-md border border-line bg-[#f9fbfd] px-3 py-3 text-left transition hover:-translate-y-px hover:border-ink hover:bg-white hover:shadow-sm disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-white text-ink shadow-sm">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink">
                      {language === "pl" ? option.labelPl : option.labelEn}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {loading
                        ? (language === "pl" ? "Otwieranie konta…" : "Opening account…")
                        : t(option.descriptionKey)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
