"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgePercent,
  Check,
  CircleOff,
  Gauge,
  MapPinned,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UsersRound
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type ControlUser = {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  company_margin_net: number;
  sales_margin_net: number;
  commission_percent: number;
  mandatory_queue_snoozed_until: string | null;
};

type LockState = {
  profileId: string;
  fullName: string;
  mandatoryCount: number;
  snoozedUntil: string | null;
  blocked: boolean;
};

type RoutingRule = {
  id: string;
  voivodeship: string;
  voivodeship_key: string;
  profile_id: string;
  weight: number;
  sort_order: number;
  is_active: boolean;
};

type ControlResponse = {
  users: ControlUser[];
  salespeople: ControlUser[];
  locks: LockState[];
  routingRules: RoutingRule[];
  voivodeships: string[];
};

type DraftPricing = Record<string, { companyMarginNet: number; salesMarginNet: number; commissionPercent: number }>;
type RoutingAssignment = { profileId: string; weight: number };

function formatRegion(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function ControlPage() {
  const { loading, profile, session } = useAuth(["owner", "admin"]);
  const [data, setData] = useState<ControlResponse | null>(null);
  const [pricing, setPricing] = useState<DraftPricing>({});
  const [selectedRegion, setSelectedRegion] = useState("");
  const [routingDraft, setRoutingDraft] = useState<RoutingAssignment[]>([]);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`
  }), [session?.access_token]);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setError("");
    const response = await fetch("/api/admin/control", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store"
    });
    const body = (await response.json().catch(() => ({}))) as ControlResponse & { error?: string };
    if (!response.ok) {
      setError(body.error || "Nie udało się pobrać panelu Kontrola.");
      return;
    }
    setData(body);
    setPricing(Object.fromEntries(body.users.map((user) => [
      user.id,
      {
        companyMarginNet: Number(user.company_margin_net) || 0,
        salesMarginNet: Number(user.sales_margin_net) || 0,
        commissionPercent: Number(user.commission_percent) || 0
      }
    ])));
    setSelectedRegion((current) => current || body.voivodeships[0] || "");
  }, [session?.access_token]);

  useEffect(() => { void load(); }, [load]);

  const rulesByRegion = useMemo(() => {
    const map = new Map<string, RoutingRule[]>();
    for (const rule of data?.routingRules || []) {
      const current = map.get(rule.voivodeship) || [];
      current.push(rule);
      map.set(rule.voivodeship, current);
    }
    return map;
  }, [data?.routingRules]);

  useEffect(() => {
    if (!selectedRegion || !data) return;
    const existing = (data.routingRules || [])
      .filter((rule) => rule.voivodeship === selectedRegion)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((rule) => ({ profileId: rule.profile_id, weight: Number(rule.weight) || 0 }));
    setRoutingDraft(existing.length ? existing : [{ profileId: data.salespeople[0]?.id || "", weight: 100 }]);
  }, [data, selectedRegion]);

  async function changeQueue(profileId: string, unlock: boolean) {
    if (!session?.access_token) return;
    const key = `lock:${profileId}`;
    setBusyKey(key);
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/control", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ action: unlock ? "unlock_queue" : "restore_queue", profileId, hours: 24 })
    });
    const body = await response.json().catch(() => ({}));
    setBusyKey("");
    if (!response.ok) {
      setError(body.error || "Nie udało się zmienić blokady.");
      return;
    }
    setNotice(unlock ? "Zdjęto blokadę na 24 godziny." : "Przywrócono działanie obowiązkowej kolejki.");
    await load();
  }

  async function savePricing(user: ControlUser) {
    if (!session?.access_token) return;
    const next = pricing[user.id];
    if (!next) return;
    const key = `pricing:${user.id}`;
    setBusyKey(key);
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        id: user.id,
        role: user.role,
        companyMarginNet: next.companyMarginNet,
        salesMarginNet: next.salesMarginNet,
        commissionPercent: next.commissionPercent
      })
    });
    const body = await response.json().catch(() => ({}));
    setBusyKey("");
    if (!response.ok) {
      setError(body.error || "Nie udało się zapisać rozliczeń użytkownika.");
      return;
    }
    setNotice(`Zapisano rozliczenia: ${user.full_name}.`);
    await load();
  }

  function updateRouting(index: number, patch: Partial<RoutingAssignment>) {
    setRoutingDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addRoutingPerson() {
    if (!data) return;
    const used = new Set(routingDraft.map((item) => item.profileId));
    const next = data.salespeople.find((person) => !used.has(person.id));
    if (!next) return;
    setRoutingDraft((current) => [...current, { profileId: next.id, weight: 0 }]);
  }

  async function saveRouting(clear = false) {
    if (!session?.access_token || !selectedRegion) return;
    const assignments = clear ? [] : routingDraft.filter((item) => item.profileId && item.weight > 0);
    const key = `routing:${selectedRegion}`;
    setBusyKey(key);
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/control", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ action: "save_routing", voivodeship: selectedRegion, assignments })
    });
    const body = await response.json().catch(() => ({}));
    setBusyKey("");
    if (!response.ok) {
      setError(body.error || "Nie udało się zapisać routingu leadów.");
      return;
    }
    setNotice(clear ? `Usunięto automatyczny routing: ${formatRegion(selectedRegion)}.` : `Zapisano routing: ${formatRegion(selectedRegion)}.`);
    await load();
  }

  if (loading || !profile || !data) return <LoadingScreen label="Otwieranie panelu Kontrola" />;

  const routingTotal = routingDraft.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const activeRoutingRegions = [...rulesByRegion.keys()].sort();

  return (
    <AppShell profile={profile}>
      <div className="grid min-w-0 gap-5">
        <PageHeader
          title="Kontrola"
          description="Awaryjne sterowanie CRM, rozliczenia użytkowników i automatyczny podział nowych leadów."
          actions={
            <>
              <Link href="/admin" className="btn-secondary">Wróć do leadów</Link>
              <button type="button" className="btn-secondary" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />Odśwież
              </button>
            </>
          }
        />

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <section className="app-card min-w-0">
          <SectionHeader
            icon={ShieldCheck}
            title="Blokady pracy handlowców"
            description="Awaryjnie możesz zdjąć obowiązkową kolejkę na 24 godziny. Zaległe zadania nie są usuwane."
            tone="warn"
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.locks.map((item) => {
              const snoozed = Boolean(item.snoozedUntil && new Date(item.snoozedUntil).getTime() > Date.now());
              return (
                <article key={item.profileId} className="min-w-0 rounded-xl border border-line bg-[#f8fafc] p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-black text-ink">{item.fullName}</div>
                      <div className="mt-1 text-xs font-semibold text-muted">Zaległe wymagające obsługi: {item.mandatoryCount}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${snoozed ? "border-solar/30 bg-solar/10 text-[#8a5a00]" : item.blocked ? "border-danger/25 bg-danger/10 text-danger" : "border-leaf/25 bg-leaf/10 text-leaf"}`}>
                      {snoozed ? "ODBLOKOWANY" : item.blocked ? "BLOKADA" : "OK"}
                    </span>
                  </div>
                  {snoozed ? <div className="mt-3 text-xs font-semibold text-muted">Do: {formatDateTime(item.snoozedUntil)}</div> : null}
                  <button
                    type="button"
                    className={snoozed ? "btn-secondary mt-4 w-full" : "btn-primary mt-4 w-full"}
                    onClick={() => void changeQueue(item.profileId, !snoozed)}
                    disabled={busyKey === `lock:${item.profileId}`}
                  >
                    {snoozed ? <Check className="h-4 w-4" /> : <CircleOff className="h-4 w-4" />}
                    {busyKey === `lock:${item.profileId}` ? "Zapisywanie…" : snoozed ? "Przywróć blokadę" : "Zdejmij blokadę na 24 h"}
                  </button>
                </article>
              );
            })}
            {!data.locks.length ? <EmptyState title="Brak handlowców" description="Nie ma użytkowników sprzedażowych w tym środowisku CRM." /> : null}
          </div>
        </section>

        <section className="app-card min-w-0">
          <SectionHeader
            icon={MapPinned}
            title="Automatyczny podział leadów po województwach"
            description="Nowy nieprzypisany lead z danym województwem trafi automatycznie do wskazanego handlowca. Kilka osób możesz rozdzielić procentowo."
            tone="sky"
          />

          <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <div className="min-w-0">
              <label>
                <span className="label">Województwo</span>
                <select className="field" value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)}>
                  {data.voivodeships.map((region) => <option key={region} value={region}>{formatRegion(region)}</option>)}
                </select>
              </label>

              <div className="mt-4 rounded-xl border border-line bg-[#f8fafc] p-3 text-sm">
                <div className="font-black text-ink">Aktywne województwa: {activeRoutingRegions.length}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeRoutingRegions.map((region) => (
                    <button key={region} type="button" onClick={() => setSelectedRegion(region)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:border-sky">
                      {formatRegion(region)}
                    </button>
                  ))}
                  {!activeRoutingRegions.length ? <span className="text-xs font-semibold text-muted">Jeszcze nie ustawiono reguł.</span> : null}
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-line bg-[#f8fafc] p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-black text-ink">{formatRegion(selectedRegion)}</div>
                  <div className={`mt-1 text-xs font-bold ${routingTotal === 100 ? "text-leaf" : "text-warn"}`}>Suma udziałów: {routingTotal}%</div>
                </div>
                <button type="button" className="btn-secondary" onClick={addRoutingPerson} disabled={routingDraft.length >= data.salespeople.length}>
                  <Plus className="h-4 w-4" />Dodaj handlowca
                </button>
              </div>

              <div className="grid gap-2.5">
                {routingDraft.map((item, index) => (
                  <div key={`${item.profileId}-${index}`} className="grid min-w-0 gap-2 rounded-xl border border-line bg-white p-3 sm:grid-cols-[minmax(0,1fr)_110px_44px] sm:items-end">
                    <label className="min-w-0">
                      <span className="label">Handlowiec</span>
                      <select className="field" value={item.profileId} onChange={(event) => updateRouting(index, { profileId: event.target.value })}>
                        <option value="">Wybierz</option>
                        {data.salespeople.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="label">Udział %</span>
                      <input className="field" type="number" min={0} max={100} step={1} value={item.weight} onChange={(event) => updateRouting(index, { weight: Number(event.target.value) })} />
                    </label>
                    <button type="button" className="btn-icon text-danger" onClick={() => setRoutingDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Usuń handlowca">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="btn-secondary" onClick={() => void saveRouting(true)} disabled={busyKey === `routing:${selectedRegion}`}>
                  Wyczyść routing
                </button>
                <button type="button" className="btn-primary" onClick={() => void saveRouting(false)} disabled={routingTotal !== 100 || !routingDraft.length || busyKey === `routing:${selectedRegion}`}>
                  <Save className="h-4 w-4" />{busyKey === `routing:${selectedRegion}` ? "Zapisywanie…" : "Zapisz podział"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="app-card min-w-0">
          <SectionHeader
            icon={BadgePercent}
            title="Marże i prowizje użytkowników"
            description="Jedno miejsce do ustawienia marży firmy, marży użytkownika i procentu prowizji."
            tone="solar"
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {data.users.map((user) => {
              const draft = pricing[user.id];
              if (!draft) return null;
              const commission = Math.round(draft.salesMarginNet * (draft.commissionPercent / 100) * 100) / 100;
              return (
                <article key={user.id} className="min-w-0 rounded-xl border border-line bg-[#f8fafc] p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-black text-ink">{user.full_name}</div>
                      <div className="mt-1 truncate text-xs font-semibold text-muted">{ROLE_LABELS[user.role]} · {user.email || "bez e-maila"}</div>
                    </div>
                    <UsersRound className="h-4 w-4 flex-none text-muted" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label>
                      <span className="label">Marża firmy netto</span>
                      <input className="field" type="number" min={0} value={draft.companyMarginNet} onChange={(event) => setPricing((current) => ({ ...current, [user.id]: { ...draft, companyMarginNet: Number(event.target.value) } }))} />
                    </label>
                    <label>
                      <span className="label">Marża użytkownika netto</span>
                      <input className="field" type="number" min={0} value={draft.salesMarginNet} onChange={(event) => setPricing((current) => ({ ...current, [user.id]: { ...draft, salesMarginNet: Number(event.target.value) } }))} />
                    </label>
                    <label>
                      <span className="label">Prowizja %</span>
                      <input className="field" type="number" min={0} max={100} step={0.1} value={draft.commissionPercent} onChange={(event) => setPricing((current) => ({ ...current, [user.id]: { ...draft, commissionPercent: Number(event.target.value) } }))} />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs font-bold text-muted">Prowizja przy tych ustawieniach: <span className="text-ink">{commission.toLocaleString("pl-PL")} zł netto / umowę</span></div>
                    <button type="button" className="btn-primary" onClick={() => void savePricing(user)} disabled={busyKey === `pricing:${user.id}`}>
                      <Save className="h-4 w-4" />{busyKey === `pricing:${user.id}` ? "Zapisywanie…" : "Zapisz"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="app-icon bg-ink text-white"><Gauge className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="font-black text-ink">Jak działa routing</div>
              <p className="mt-1 text-sm leading-6 text-muted">
                Reguła działa tylko dla nowych leadów bez przypisanego handlowca. Jeśli nie ustawisz województwa, lead zostaje w puli. Podział procentowy jest wykonywany w bazie i jest bezpieczny również przy równoczesnym imporcie wielu leadów.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
