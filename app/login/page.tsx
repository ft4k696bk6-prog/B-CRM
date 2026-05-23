"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogIn,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useLanguage } from "@/components/language-provider";
import { Alert } from "@/components/ui";
import { homePathForRole, normalizeRole } from "@/lib/roles";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      .select("role,email,crm_environment")
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
    await finishLogin(email.trim().toLowerCase(), password);
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center">
        <div className="w-full rounded-lg border border-line bg-white p-5 shadow-soft sm:p-6">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <h1 className="text-xl font-bold text-ink">B-CRM Energy</h1>
                <p className="text-sm text-muted">{t("loginSubtitle")}</p>
              </div>
            </div>
          </div>

          {!isSupabaseConfigured ? (
            <Alert tone="warning" className="mb-4">{t("supabaseMissing")}</Alert>
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
        </div>
      </section>
    </main>
  );
}
