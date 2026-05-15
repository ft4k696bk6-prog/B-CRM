"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Save, Settings } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { usePricingSettings } from "@/lib/pricing-settings";
import { useAuth } from "@/lib/use-auth";

export default function SettingsPage() {
  const { loading, profile } = useAuth();
  const { settings, setSettings } = usePricingSettings(profile?.role);
  const [adminMargin, setAdminMargin] = useState(settings.adminMargin);
  const [salesMargin, setSalesMargin] = useState(settings.salesMargin);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAdminMargin(settings.adminMargin);
    setSalesMargin(settings.salesMargin);
  }, [settings.adminMargin, settings.salesMargin]);

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

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div>
          <h1 className="section-title">Ustawienia</h1>
          <p className="mt-1 text-sm text-muted">Preferencje używane przy przygotowaniu ofert.</p>
        </div>

        <form onSubmit={save} className="max-w-2xl rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white">
              <Settings className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Ustawienia oferty</h2>
              <p className="mt-1 text-sm text-muted">
                Te wartości nie są pokazywane w widoku oferty dla klienta.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {profile.role === "admin" ? (
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
            <div className="mt-4 flex items-center gap-2 rounded-md border border-leaf/20 bg-leaf/10 p-3 text-sm font-semibold text-leaf">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Zapisano ustawienia.
            </div>
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
