"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
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
import { homePathForRole, normalizeRole } from "@/lib/roles";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const demoModeEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const demoOptions = [
  {
    key: "demo",
    email: "demo@example.com",
    password: "demo-admin",
    label: "Admin",
    description: "Pełny podgląd CRM",
    icon: ShieldCheck
  },
  {
    key: "demo-menadzer",
    email: "demo-menadzer@example.com",
    password: "demo-menadzer",
    label: "Menadżer",
    description: "Akceptacje i zespół",
    icon: UsersRound
  },
  {
    key: "demo-handlowiec",
    email: "demo-handlowiec@example.com",
    password: "demo-handlowiec",
    label: "Handlowiec",
    description: "Leady i umowy",
    icon: BriefcaseBusiness
  },
  {
    key: "demo-ksiegowy",
    email: "demo-ksiegowy@example.com",
    password: "demo-ksiegowy",
    label: "Księgowość",
    description: "Faktury, aneksy, KSeF",
    icon: Calculator
  },
  {
    key: "demo-logistyk",
    email: "demo-logistyk@example.com",
    password: "demo-logistyk",
    label: "Logistyka",
    description: "Zamówienia i kompletacja",
    icon: Truck
  },
  {
    key: "demo-monter",
    email: "demo-monter@example.com",
    password: "demo-monter",
    label: "Monter",
    description: "Terminy i montaż",
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
      setError("Nie udało się zalogować. Sprawdź e-mail i hasło.");
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
    <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark />
          <div>
            <h1 className="text-xl font-bold text-ink">B-CRM</h1>
            <p className="text-sm text-muted">Logowanie do panelu</p>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <div className="mb-4 flex gap-3 rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-[#8a4300]">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <span>Brakuje danych Supabase w pliku .env.local.</span>
          </div>
        ) : null}

        {demoModeEnabled ? (
          <div className="mb-4 rounded-md border border-sky/20 bg-sky/10 p-3 text-sm font-semibold text-sky">
            Demo: kliknij wybraną rolę albo wpisz alias, np. <strong>demo-handlowiec</strong>, z hasłem <strong>demo</strong>.
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 flex gap-3 rounded-md border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="grid gap-4">
          <label>
            <span className="label">E-mail</span>
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
            <span className="label">Hasło</span>
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
            {loading ? "Logowanie" : "Zaloguj"}
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
            {showDemoMenu ? "Ukryj demo" : "Wypróbuj demo"}
          </button>

          {showDemoMenu ? (
            <div className="mt-3 grid gap-2">
              {demoOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={loading || !isSupabaseConfigured}
                    onClick={() => onDemoLogin(option.key)}
                    className="flex items-center gap-3 rounded-md border border-line bg-[#f9fbfd] px-3 py-3 text-left transition hover:border-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-white text-ink shadow-sm">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">{option.label}</span>
                      <span className="block truncate text-xs text-muted">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
