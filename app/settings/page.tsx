"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileText, KeyRound, Paintbrush2, Save, Settings } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { useTheme } from "@/components/theme-provider";
import { Alert, PageHeader, SectionHeader } from "@/components/ui";
import { usePricingSettings } from "@/lib/pricing-settings";
import { themePacks } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";

export default function SettingsPage() {
  const { loading, profile, session } = useAuth();
  const { theme, setTheme } = useTheme();
  const { settings, setSettings } = usePricingSettings(profile);
  const [adminMargin, setAdminMargin] = useState(settings.adminMargin);
  const [salesMargin, setSalesMargin] = useState(settings.salesMargin);
  const [businessPhone, setBusinessPhone] = useState("");
  const [saved, setSaved] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    setAdminMargin(settings.adminMargin);
    setSalesMargin(settings.salesMargin);
  }, [settings.adminMargin, settings.salesMargin]);

  useEffect(() => {
    setBusinessPhone(profile?.business_phone || "");
  }, [profile?.business_phone]);

  if (loading || !profile) return <LoadingScreen />;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettings({
      adminMargin,
      salesMargin
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }


  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user.email) return;

    setPasswordError("");
    setPasswordSaved(false);

    if (newPassword.length < 8) {
      setPasswordError("Nowe hasło musi mieć minimum 8 znaków.");
      return;
    }

    if (newPassword !== repeatPassword) {
      setPasswordError("Nowe hasła nie są takie same.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword
    });

    if (signInError) {
      setPasswordError("Aktualne hasło jest niepoprawne.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordError(error.message || "Nie udało się zmienić hasła.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setRepeatPassword("");
    setPasswordSaved(true);
    window.setTimeout(() => setPasswordSaved(false), 2500);
  }

  async function saveBusinessPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    setPhoneError("");
    setPhoneSaved(false);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ businessPhone })
    });
    const body = await response.json();

    if (!response.ok) {
      setPhoneError(body.error || "Nie udało się zapisać numeru.");
      return;
    }

    setBusinessPhone(body.business_phone || "");
    setPhoneSaved(true);
    window.setTimeout(() => setPhoneSaved(false), 2500);
  }

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title="Ustawienia"
          description="Wygląd interfejsu i preferencje używane przy ofertach."
        />

        <section className="app-card">
          <SectionHeader
            icon={Paintbrush2}
            title="Wygląd CRM"
            description="Gotowe pakiety kolorystyczne dla interfejsu."
            tone="sky"
            className="mb-4"
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {themePacks.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => setTheme(pack.id)}
                className={`rounded-lg border p-4 text-left transition hover:-translate-y-px ${
                  theme === pack.id
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-[#f9fbfd] text-ink hover:border-ink hover:bg-white hover:shadow-soft"
                }`}
              >
                <div className="mb-4 flex gap-2">
                  <span className="h-4 w-4 rounded-full bg-solar" />
                  <span className="h-4 w-4 rounded-full bg-sky" />
                  <span className="h-4 w-4 rounded-full bg-leaf" />
                </div>
                <div className="text-sm font-bold">{pack.name}</div>
                <div className={`mt-1 text-sm ${theme === pack.id ? "text-white/72" : "text-muted"}`}>
                  {pack.description}
                </div>
              </button>
            ))}
          </div>
        </section>

        <form onSubmit={saveBusinessPhone} className="app-card max-w-2xl">
          <SectionHeader
            icon={FileText}
            title="Numer do ofert"
            description="Ten numer może być używany wyłącznie jako kontakt handlowca na ofertach i dokumentach."
            tone="sky"
            className="mb-4"
          />

          <label>
            <span className="label">Numer handlowca do ofert</span>
            <input
              className="field"
              value={businessPhone}
              onChange={(event) => setBusinessPhone(event.target.value)}
              placeholder="+48 600 000 000"
            />
          </label>

          {phoneError ? (
            <Alert tone="danger" className="mt-4">
              {phoneError}
            </Alert>
          ) : null}

          {phoneSaved ? (
            <Alert tone="success" className="mt-4">
              Zapisano numer do ofert.
            </Alert>
          ) : null}

          <button type="submit" className="btn-primary mt-4">
            <Save className="h-4 w-4" aria-hidden="true" />
            Zapisz numer do ofert
          </button>
        </form>

        <form onSubmit={changePassword} className="app-card max-w-2xl">
          <SectionHeader
            icon={KeyRound}
            title="Zmiana hasła"
            description="Handlowiec i każdy użytkownik może sam ustawić nowe hasło po podaniu obecnego hasła."
            tone="leaf"
            className="mb-4"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="label">Obecne hasło</span>
              <input
                className="field"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              <span className="label">Nowe hasło</span>
              <input
                className="field"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label>
              <span className="label">Powtórz nowe hasło</span>
              <input
                className="field"
                type="password"
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          </div>

          {passwordError ? (
            <Alert tone="danger" className="mt-4">
              {passwordError}
            </Alert>
          ) : null}

          {passwordSaved ? (
            <Alert tone="success" className="mt-4">
              Zmieniono hasło.
            </Alert>
          ) : null}

          <button type="submit" className="btn-primary mt-4">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Zmień hasło
          </button>
        </form>

        <form onSubmit={save} className="app-card max-w-2xl">
          <SectionHeader
            icon={Settings}
            title="Ustawienia oferty"
            description="Wartości techniczne nie są widoczne w ofercie dla klienta."
            tone="ink"
            className="mb-4"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {profile.role === "owner" || profile.role === "admin" ? (
              <label>
                <span className="label">Marża bazowa firmy netto</span>
                <input
                  className="field"
                  type="number"
                  value={adminMargin}
                  min={0}
                  onChange={(event) => setAdminMargin(Number(event.target.value))}
                />
              </label>
            ) : null}

            <label>
              <span className="label">Moja marża ofertowa netto</span>
              <input
                className="field"
                type="number"
                value={salesMargin}
                min={0}
                onChange={(event) => setSalesMargin(Number(event.target.value))}
              />
            </label>
          </div>

          {saved ? (
            <Alert tone="success" className="mt-4">
              Zapisano ustawienia.
            </Alert>
          ) : null}

          <button type="submit" className="btn-primary mt-4">
            <Save className="h-4 w-4" aria-hidden="true" />
            Zapisz
          </button>
        </form>
      </div>
    </AppShell>
  );
}
