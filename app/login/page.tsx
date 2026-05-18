"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Calculator,
  Hammer,
  LogIn,
  ShieldCheck,
  Sparkles,
  Truck,
  UsersRound
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Alert } from "@/components/ui";
import { homePathForRole, normalizeRole } from "@/lib/roles";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const demoModeEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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

function getDemoAccount(key: string) {
  return demoOptions.find((account) => account.key === key);
}

function resolveCredentials(identifier: string, typedPassword: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const demoAccount = getDemoAccount(normalizedIdentifier);

  if (!demoAccount) {
    return { email: normalizedIdentifier, password: typedPassword };
  }

  return {
    email: demoAccount.email,
    password: typedPassword === "demo" ? demoAccount.password : typedPassword
  };
}

export default function LoginPage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  async function finishLogin(signInEmail: string, signInPassword: string) {
    setError("");
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPassword
    });

    if (signInError || !data.user) {
      setLoading(false);
      setError(t("loginError"));
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,email")
      .eq("id", data.user.id)
      .single();

    setLoading(false);
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credentials = resolveCredentials(email, password);
    await finishLogin(credentials.email, credentials.password);
  }

  async function onDemoLogin(key: DemoAccountKey) {
    const account = getDemoAccount(key);
    if (!account) return;
    await finishLogin(account.email, account.password);
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:py-10">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-5 lg:grid-cols-[0.9fr_1fr]">
        <div className="hidden rounded-lg border border-line bg-[#111722] p-7 text-white shadow-soft lg:block">
          <BrandMark />
          <h2 className="mt-8 text-3xl font-black tracking-tight">B-CRM</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
            Profesjonalny panel CRM do obsługi leadów, procesów po umowie i pracy zespołów operacyjnych.
          </p>
          <div className="mt-8 grid gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="font-black">Leady i statusy</div>
              <div className="mt-1 text-white/65">Czytelny pipeline od kontaktu do umowy.</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="font-black">Role i odpowiedzialność</div>
              <div className="mt-1 text-white/65">Widoki dopasowane do zespołów i uprawnień.</div>
            </div>
          </div>
        </div>

        <div className="w-full rounded-lg border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <h1 className="text-xl font-bold text-ink">B-CRM</h1>
              <p className="text-sm text-muted">{t("loginSubtitle")}</p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        {!isSupabaseConfigured ? (
          <Alert tone="warning" className="mb-4">{t("supabaseMissing")}</Alert>
        ) : null}

        {demoModeEnabled ? (
          <Alert tone="info" className="mb-4">{t("demoIntro")}</Alert>
        ) : null}

        {error ? (
          <Alert tone="danger" className="mb-4">{error}</Alert>
        ) : null}

        <form onSubmit={onSubmit} className="grid gap-4">
          <label>
            <span className="label">{t("email")}</span>
            <input
              className="field"
              type="text"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            <span className="label">{t("password")}</span>
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading || !isSupabaseConfigured}
            className="btn-primary"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {loading ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <div className="mt-5 border-t border-line pt-5">
          <button
            type="button"
            onClick={() => setShowDemoMenu((value) => !value)}
            disabled={loading || !isSupabaseConfigured}
            className="btn-secondary w-full"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {showDemoMenu ? t("hideDemo") : t("showDemo")}
          </button>

          {showDemoMenu ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {demoOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={loading || !isSupabaseConfigured}
                    onClick={() => onDemoLogin(option.key)}
                    className="flex min-h-[74px] items-center gap-3 rounded-md border border-line bg-[#f9fbfd] px-3 py-3 text-left transition hover:-translate-y-px hover:border-ink hover:bg-white hover:shadow-sm disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-white text-ink shadow-sm">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">
                        {language === "pl" ? option.labelPl : option.labelEn}
                      </span>
                      <span className="block truncate text-xs text-muted">{t(option.descriptionKey)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        </div>
      </section>
    </main>
  );
}
