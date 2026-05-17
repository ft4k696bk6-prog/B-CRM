"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BriefcaseBusiness, Calculator, Hammer, LogIn, ShieldCheck, Truck, UsersRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { homePathForRole, normalizeRole } from "@/lib/roles";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const demoAccounts: Record<string, { email: string; password: string }> = {
  demo: { email: "demo@example.com", password: "demo-admin" },
  "demo-ksiegowy": {
    email: "demo-ksiegowy@example.com",
    password: "demo-ksiegowy"
  },
  "demo-handlowiec": {
    email: "demo-handlowiec@example.com",
    password: "demo-handlowiec"
  },
  "demo-logistyk": {
    email: "demo-logistyk@example.com",
    password: "demo-logistyk"
  },
  "demo-monter": {
    email: "demo-monter@example.com",
    password: "demo-monter"
  },
  "demo-menadzer": {
    email: "demo-menadzer@example.com",
    password: "demo-menadzer"
  }
};

const demoRoles = [
  { key: "demo", label: "Admin", description: "Pełny widok CRM", icon: ShieldCheck },
  { key: "demo-menadzer", label: "Menadżer", description: "Zespół i akceptacje", icon: UsersRound },
  { key: "demo-handlowiec", label: "Handlowiec", description: "Leady i umowy", icon: BriefcaseBusiness },
  { key: "demo-ksiegowy", label: "Księgowość", description: "Faktury, aneksy, KSeF", icon: Calculator },
  { key: "demo-logistyk", label: "Logistyka", description: "Zamówienia i kompletacja", icon: Truck },
  { key: "demo-monter", label: "Monter", description: "Terminy montażu", icon: Hammer }
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  async function signInWithCredentials(signInEmail: string, signInPassword: string) {
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

    router.replace(homePathForRole(normalizeRole(profile?.role, profile?.email)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await signInWithCredentials(email.trim().toLowerCase(), password);
  }

  async function signInDemo(key: string) {
    const account = demoAccounts[key];
    if (!account || loading) return;
    await signInWithCredentials(account.email, account.password);
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

        {error ? (
          <div className="mb-4 flex gap-3 rounded-md border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="mb-4 rounded-lg border border-line bg-[#f9fbfd] p-3">
          <button
            type="button"
            onClick={() => setShowDemo((current) => !current)}
            disabled={loading || !isSupabaseConfigured}
            className="btn-secondary w-full"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Wypróbuj demo
          </button>

          {showDemo ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {demoRoles.map((role) => {
                const Icon = role.icon;

                return (
                  <button
                    key={role.key}
                    type="button"
                    onClick={() => signInDemo(role.key)}
                    disabled={loading || !isSupabaseConfigured}
                    className="min-h-20 rounded-md border border-line bg-white p-3 text-left transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <span className="flex items-center gap-2 text-sm font-black text-ink">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {role.label}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-muted">{role.description}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

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

          <button type="submit" disabled={loading || !isSupabaseConfigured} className="btn-primary">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {loading ? "Logowanie" : "Zaloguj"}
          </button>
        </form>
      </section>
    </main>
  );
}
