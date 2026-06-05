"use client";

import { FormEvent, useEffect, useState } from "react";
import { IdCard, Paintbrush2, Save, Settings } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { useTheme } from "@/components/theme-provider";
import { Alert, PageHeader, SectionHeader } from "@/components/ui";
import { readOfferIdentity, writeOfferIdentity } from "@/lib/offer-identity";
import { usePricingSettings } from "@/lib/pricing-settings";
import { themePacks } from "@/lib/theme";
import { useAuth } from "@/lib/use-auth";

export default function SettingsPage() {
  const { loading, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { settings, setSettings } = usePricingSettings(profile?.role);
  const [adminMargin, setAdminMargin] = useState(settings.adminMargin);
  const [salesMargin, setSalesMargin] = useState(settings.salesMargin);
  const [offerFullName, setOfferFullName] = useState("");
  const [offerPhone, setOfferPhone] = useState("");
  const [saved, setSaved] = useState(false);
  const [offerIdentitySaved, setOfferIdentitySaved] = useState(false);

  useEffect(() => {
    setAdminMargin(settings.adminMargin);
    setSalesMargin(settings.salesMargin);
  }, [settings.adminMargin, settings.salesMargin]);

  useEffect(() => {
    if (!profile) return;
    const identity = readOfferIdentity(profile.full_name);
    setOfferFullName(identity.fullName);
    setOfferPhone(identity.phone);
  }, [profile]);

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

  function saveOfferIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    writeOfferIdentity({ fullName: offerFullName, phone: offerPhone });
    setOfferIdentitySaved(true);
    window.setTimeout(() => setOfferIdentitySaved(false), 2500);
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
            title="Wygląd panelu"
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

        <form onSubmit={saveOfferIdentity} className="app-card max-w-2xl">
          <SectionHeader
            icon={IdCard}
            title="Dane do oferty"
            description="Te dane pojawią się w wygenerowanej ofercie dla klienta."
            tone="sky"
            className="mb-4"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Imię i nazwisko na ofercie</span>
              <input
                className="field"
                value={offerFullName}
                onChange={(event) => setOfferFullName(event.target.value)}
                placeholder="np. Kacper Bernecki"
              />
            </label>
            <label>
              <span className="label">Telefon na ofercie</span>
              <input
                className="field"
                value={offerPhone}
                onChange={(event) => setOfferPhone(event.target.value)}
                placeholder="+48 600 000 000"
              />
            </label>
          </div>

          {offerIdentitySaved ? (
            <Alert tone="success" className="mt-4">
              Zapisano dane do oferty.
            </Alert>
          ) : null}

          <button type="submit" className="btn-primary mt-4">
            <Save className="h-4 w-4" aria-hidden="true" />
            Zapisz dane
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
