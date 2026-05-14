"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LogIn } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

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

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
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

    router.replace(profile?.role === "admin" ? "/admin" : "/sales");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark />
          <div>
            <h1 className="text-xl font-bold text-ink">B-CRM</h1>
            <p className="text-sm text-muted">Logowanie</p>
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
            <span className="label">E-mail</span>
            <input
              className="field"
              type="email"
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
