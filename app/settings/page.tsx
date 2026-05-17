"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Save, Settings } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { usePricingSettings } from "@/lib/pricing-settings";
import { applyTheme, isThemeId, THEME_OPTIONS, THEME_STORAGE_KEY, type ThemeId } from "@/lib/theme";
import { useAuth } from "@/lib/use-auth";

export default function SettingsPage() {
  const { loading, profile } = useAuth();
  const { settings, setSettings } = usePricingSettings(profile?.role);
  const [adminMargin, setAdminMargin] = useState(settings.adminMargin);
  const [salesMargin, setSalesMargin] = useState(settings.salesMargin);
  const [themeId, setThemeId] = useState<ThemeId>("default");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAdminMargin(settings.adminMargin);
    setSalesMargin(settings.salesMargin);
  }, [settings.adminMargin, settings.salesMargin]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    setThemeId(isThemeId(storedTheme) ? storedTheme : "default");
  }, []);

  if (loading || !profile) return <LoadingScreen />;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettings({
      adminMargin,
      salesMargin
    });
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyTheme(themeId);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div>
          <h1 className="section-title">Ustawienia</h1>
          <p className="mt-1 text-sm text-muted">Oferta i wygląd panelu.</p>
        </div>

        <form onSubmit={save} className="max-w-4xl rounded-lg border border-line bg-panel p-5 shadow-sm">
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

          <div className="mt-6 border-t border-line pt-5">
            <div className="mb-3">
              <h3 className="text-sm font-black text-ink">Wygląd panelu</h3>
              <p className="mt-1 text-sm text-muted">Gotowe pakiety kolorystyczne bez rozbudowanych ustawień.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {THEME_OPTIONS.map((theme) => {
                const active = themeId === theme.id;

                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      setThemeId(theme.id);
                      applyTheme(theme.id);
                    }}
                    className={`min-h-28 rounded-lg border p-3 text-left transition ${
                      active ? "border-ink ring-2 ring-ink ring-offset-2" : "border-line hover:border-ink"
                    }`}
                  >
                    <span className="flex gap-1">
                      {theme.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className="h-7 w-7 rounded-full border border-line"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </span>
                    <span className="mt-3 block text-sm font-black text-ink">{theme.name}</span>
                    <span className="mt-1 block text-xs font-semibold text-muted">{theme.description}</span>
                  </button>
                );
              })}
            </div>
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
