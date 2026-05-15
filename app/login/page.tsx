"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LogIn } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { homePathForRole } from "@/lib/roles";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const demoAliases: Record<string, string> = {
  demo: "demo@example.com",
  "demo-handlowiec": "demo-handlowiec@example.com",
  "demo-menadzer": "demo-menadzer@example.com"
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const normalizedLogin = email.trim().toLowerCase();
    const signInEmail = demoAliases[normalizedLogin] || normalizedLogin;

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password
    });

    if (signInError || !data.user) {
      setLoading(false);
      setError("Nie udało się zalogować. Sprawdź e-mail i hasło.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    router.replace(homePathForRole(profile?.role));
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#06110f] px-4 py-8">
      <section className="w-full max-w-md rounded-xl border border-line bg-panel/95 p-6 shadow-soft">
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

        <form onSubmit={onSubmit} className="grid gap-4">
          <label>
              <span className="label">E-mail lub login demo</span>
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

        <div className="mt-5 rounded-lg border border-line bg-white/5 p-3 text-xs leading-5 text-muted">
          Demo: <span className="font-semibold text-ink">demo</span>,{" "}
          <span className="font-semibold text-ink">demo-handlowiec</span>,{" "}
          <span className="font-semibold text-ink">demo-menadzer</span>. Hasło:{" "}
          <span className="font-semibold text-ink">demo</span>.
        </div>
      </section>
    </main>
  );
}
