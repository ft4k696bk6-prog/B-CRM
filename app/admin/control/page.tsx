"use client";

import { useEffect, useMemo, useState } from "react";
import { GitBranch, RefreshCw, Save, ShieldOff, SlidersHorizontal, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, PageHeader, SectionHeader } from "@/components/ui";
import { VOIVODESHIPS } from "@/lib/poland-regions";
import { ROLE_LABELS } from "@/lib/roles";
import type { Profile } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type ControlSettings = {
  mandatoryQueueEnabled: boolean;
  operationsModulesEnabled: boolean;
  updatedAt: string | null;
};

type RoutingRule = {
  id: string;
  voivodeship: string;
  salesperson_id: string;
  weight: number;
  active: boolean;
  salesperson?: { id: string; full_name: string; email: string | null; role: string } | null;
};

type PricingDraft = { company: string; sales: string; commission: string };

function regionLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function percent(weight: number, total: number) {
  return total > 0 ? `${Math.round((weight / total) * 1000) / 10}%` : "0%";
}

export default function ControlCenterPage() {
  const { loading, profile, session } = useAuth(["owner", "admin"]);
  const [settings, setSettings] = useState<ControlSettings>({
    mandatoryQueueEnabled: true,
    operationsModulesEnabled: false,
    updatedAt: null,
  });
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, PricingDraft>>({});
  const [voivodeship, setVoivodeship] = useState("lubelskie");
  const [routingDraft, setRoutingDraft] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [migrationRequired, setMigrationRequired] = useState(false);

  const salespeople = useMemo(() => users.filter((user) => user.role === "handlowiec"), [users]);
  const currentRules = useMemo(
    () => routingRules.filter((rule) => rule.voivodeship.toLowerCase() === voivodeship.toLowerCase()),
    [routingRules, voivodeship],
  );
  const totalWeight = useMemo(
    () => Object.values(routingDraft).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0),
    [routingDraft],
  );

  async function loadAll() {
    if (!session?.access_token) return;
    setError("");
    setMigrationRequired(false);

    const [controlResponse, usersResponse] = await Promise.all([
      fetch("/api/admin/control", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      }),
      fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      }),
    ]);

    const controlBody = await controlResponse.json().catch(() => ({}));
    const usersBody = await usersResponse.json().catch(() => ({}));

    if (!controlResponse.ok) {
      if (controlBody.code === "CONTROL_CENTER_MIGRATION_REQUIRED") setMigrationRequired(true);
      else setError(controlBody.error || "Nie udało się pobrać ustawień kontroli.");
    } else {
      setSettings(controlBody.settings);
      setRoutingRules(controlBody.routingRules || []);
    }

    if (!usersResponse.ok) {
      setError(usersBody.error || "Nie udało się pobrać użytkowników.");
      return;
    }

    const nextUsers = (usersBody.users || []) as Profile[];
    setUsers(nextUsers);
    setPricingDrafts(
      Object.fromEntries(
        nextUsers.map((user) => [
          user.id,
          {
            company: String(user.company_margin_net ?? 10000),
            sales: String(user.sales_margin_net ?? 5000),
            commission: String(user.commission_percent ?? 0),
          },
        ]),
      ),
    );
  }

  useEffect(() => {
    void loadAll();
  }, [session?.access_token]);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const salesperson of salespeople) {
      const existing = currentRules.find((rule) => rule.salesperson_id === salesperson.id);
      next[salesperson.id] = existing?.weight || 0;
    }
    setRoutingDraft(next);
  }, [voivodeship, currentRules, salespeople]);

  if (loading || !profile) return <LoadingScreen />;

  async function saveQueueSetting(nextEnabled: boolean) {
    if (!session?.access_token || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    const response = await fetch("/api/admin/control", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "settings",
        mandatoryQueueEnabled: nextEnabled,
        operationsModulesEnabled: settings.operationsModulesEnabled,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (body.code === "CONTROL_CENTER_MIGRATION_REQUIRED") setMigrationRequired(true);
      else setError(body.error || "Nie udało się zmienić blokady CRM.");
    } else {
      setSettings(body.settings);
      setSuccess(nextEnabled ? "Włączono obowiązkową kolejkę." : "Zdjęto blokadę obowiązkowej kolejki dla handlowców.");
    }
    setBusy(false);
  }

  async function saveRouting() {
    if (!session?.access_token || busy) return;
    const entries = Object.entries(routingDraft)
      .filter(([, weight]) => Number(weight) > 0)
      .map(([salespersonId, weight]) => ({ salespersonId, weight: Math.round(Number(weight)) }));

    setBusy(true);
    setError("");
    setSuccess("");
    const response = await fetch("/api/admin/control", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: "routing", voivodeship, entries }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (body.code === "CONTROL_CENTER_MIGRATION_REQUIRED") setMigrationRequired(true);
      else setError(body.error || "Nie udało się zapisać podziału leadów.");
    } else {
      setSuccess(`Zapisano automatyczny podział dla: ${regionLabel(voivodeship)}.`);
      await loadAll();
    }
    setBusy(false);
  }

  async function savePricing(person: Profile) {
    if (!session?.access_token || busy) return;
    const draft = pricingDrafts[person.id];
    if (!draft) return;
    setBusy(true);
    setError("");
    setSuccess("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        id: person.id,
        role: person.role,
        managerId: person.manager_id,
        companyMarginNet: Number(draft.company),
        salesMarginNet: Number(draft.sales),
        commissionPercent: Number(draft.commission),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || "Nie udało się zapisać rozliczeń.");
    else {
      setSuccess(`Zapisano rozliczenia: ${person.full_name}.`);
      await loadAll();
    }
    setBusy(false);
  }

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title="Kontrola CRM"
          description="Jedno miejsce do blokad handlowców, automatycznego przydziału leadów i rozliczeń użytkowników."
          actions={
            <button type="button" className="btn-secondary" onClick={loadAll} disabled={busy}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />Odśwież
            </button>
          }
        />

        {migrationRequired ? (
          <Alert tone="warning" title="Wymagana aktualizacja bazy">
            Kod Panelu Kontrola jest gotowy, ale przed użyciem trzeba zastosować migrację `supabase/24_control_center_routing.sql` na produkcyjnym Supabase.
          </Alert>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <section className="app-card">
          <SectionHeader
            icon={ShieldOff}
            title="Blokada pracy handlowca"
            description="Obowiązkowa kolejka wymusza najpierw obsługę zaległych call-backów i spotkań. Możesz ją zdjąć globalnie jednym kliknięciem."
            tone={settings.mandatoryQueueEnabled ? "warn" : "leaf"}
          />
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-[#f8fafc] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black text-ink">
                {settings.mandatoryQueueEnabled ? "Blokada jest WŁĄCZONA" : "Blokada jest WYŁĄCZONA"}
              </div>
              <div className="mt-1 text-sm text-muted">
                {settings.mandatoryQueueEnabled
                  ? "Handlowiec musi najpierw obsłużyć zaległą obowiązkową kolejkę."
                  : "Handlowiec może pracować na dowolnym swoim leadzie."}
              </div>
            </div>
            <button
              type="button"
              className={settings.mandatoryQueueEnabled ? "btn-danger" : "btn-primary"}
              disabled={busy || migrationRequired}
              onClick={() => saveQueueSetting(!settings.mandatoryQueueEnabled)}
            >
              <ShieldOff className="h-4 w-4" aria-hidden="true" />
              {settings.mandatoryQueueEnabled ? "Zdejmij blokadę" : "Włącz blokadę"}
            </button>
          </div>
        </section>

        <section className="app-card">
          <SectionHeader
            icon={GitBranch}
            title="Automatyczny przydział województw"
            description="Ustaw kilku handlowców dla jednego województwa i ich wagę. CRM wylicza procent i automatycznie przypisuje nowe leady."
            tone="sky"
          />

          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <label>
              <span className="label">Województwo</span>
              <select className="field" value={voivodeship} onChange={(event) => setVoivodeship(event.target.value)}>
                {VOIVODESHIPS.map((item) => <option key={item} value={item}>{regionLabel(item)}</option>)}
              </select>
              <span className="mt-2 block text-xs leading-5 text-muted">Wpisz `0`, aby handlowiec nie dostawał leadów z tego województwa.</span>
            </label>

            <div className="grid gap-2">
              {salespeople.map((person) => {
                const weight = Math.max(0, Number(routingDraft[person.id]) || 0);
                return (
                  <div key={person.id} className="grid gap-3 rounded-xl border border-line bg-[#f8fafc] p-3 sm:grid-cols-[minmax(180px,1fr)_110px_90px] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-ink">{person.full_name}</div>
                      <div className="truncate text-xs text-muted">{person.email}</div>
                    </div>
                    <label>
                      <span className="label sm:sr-only">Waga</span>
                      <input
                        className="field min-h-10"
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={routingDraft[person.id] ?? 0}
                        onChange={(event) => setRoutingDraft((current) => ({ ...current, [person.id]: Math.max(0, Number(event.target.value) || 0) }))}
                      />
                    </label>
                    <div className="text-right text-lg font-black tabular-nums text-sky">{percent(weight, totalWeight)}</div>
                  </div>
                );
              })}
              {salespeople.length === 0 ? <Alert tone="warning">Brak użytkowników z rolą Handlowiec.</Alert> : null}
              <div className="mt-2 flex justify-end">
                <button type="button" className="btn-primary" onClick={saveRouting} disabled={busy || migrationRequired || salespeople.length === 0}>
                  <Save className="h-4 w-4" aria-hidden="true" />Zapisz podział
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="app-card">
          <SectionHeader
            icon={UsersRound}
            title="Marże i prowizje użytkowników"
            description="Te same ustawienia co w Użytkownikach, zebrane tutaj jako panel kontrolny. Nie ma drugiej logiki rozliczeń."
            tone="leaf"
          />
          <div className="grid gap-2.5">
            {users.map((person) => {
              const draft = pricingDrafts[person.id] || { company: "10000", sales: "5000", commission: "0" };
              const commission = (Math.max(0, Number(draft.sales) || 0) * Math.min(100, Math.max(0, Number(draft.commission) || 0))) / 100;
              return (
                <article key={person.id} className="grid gap-3 rounded-xl border border-line bg-[#f8fafc] p-3 lg:grid-cols-[minmax(180px,1fr)_150px_150px_150px_120px] lg:items-end">
                  <div className="min-w-0">
                    <div className="truncate font-black text-ink">{person.full_name}</div>
                    <div className="text-xs text-muted">{ROLE_LABELS[person.role]}</div>
                    <div className="mt-1 text-xs font-bold text-leaf">Prowizja: {commission.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł netto / umowę</div>
                  </div>
                  <label><span className="label">Marża firmy</span><input className="field" type="number" min="0" step="100" value={draft.company} onChange={(event) => setPricingDrafts((current) => ({ ...current, [person.id]: { ...draft, company: event.target.value } }))} /></label>
                  <label><span className="label">Marża handlowca</span><input className="field" type="number" min="0" step="100" value={draft.sales} onChange={(event) => setPricingDrafts((current) => ({ ...current, [person.id]: { ...draft, sales: event.target.value } }))} /></label>
                  <label><span className="label">Prowizja %</span><input className="field" type="number" min="0" max="100" step="0.1" value={draft.commission} onChange={(event) => setPricingDrafts((current) => ({ ...current, [person.id]: { ...draft, commission: event.target.value } }))} /></label>
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => savePricing(person)}><Save className="h-4 w-4" />Zapisz</button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="app-card">
          <SectionHeader icon={SlidersHorizontal} title="Moduły operacyjne" description="Księgowość, logistyka i monter są na razie ukryte z głównej nawigacji. Nie usuwam danych ani kodu, żeby można było wrócić do nich bez odbudowy systemu." tone="ink" />
        </section>
      </div>
    </AppShell>
  );
}
