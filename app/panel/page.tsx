"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, CalendarDays, PackageCheck, RefreshCw, Sun } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { contractStatusLabel, type ContractRecord } from "@/lib/contracts";
import { formatDateTime } from "@/lib/date";
import { useAuth } from "@/lib/use-auth";

function startOfDay(date: Date) { const next = new Date(date); next.setHours(0, 0, 0, 0); return next; }
function startOfWeek(date: Date) { const next = startOfDay(date); next.setDate(next.getDate() - ((next.getDay() + 6) % 7)); return next; }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function actionLabel(contract: ContractRecord) {
  switch (contract.process_status) {
    case "incomplete": return "Nowa umowa — uzupełnić załączniki";
    case "verification": return "Nowa umowa — do weryfikacji";
    case "equipment_to_order": return "Sprzęt trzeba zamówić";
    case "installation_to_schedule": return "Montaż trzeba umówić";
    case "installation_scheduled": return `Montaż umówiony${contract.installation_at ? `: ${formatDateTime(contract.installation_at)}` : ""}`;
    case "installation_confirmation": return "Potwierdzić wykonanie montażu";
    case "settlement": return "Umowa do rozliczenia";
    default: return contractStatusLabel(contract.process_status);
  }
}

export default function WorkPanelPage() {
  const { loading, profile, session } = useAuth();
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    if (!session?.access_token) return;
    setBusy(true); setError("");
    const response = await fetch("/api/contracts", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Nie udało się pobrać zadań.");
    else setContracts((body.contracts || []).filter((contract: ContractRecord) => !["settled", "resigned", "paused"].includes(contract.process_status || "verification")));
    setBusy(false);
  }
  useEffect(() => { load(); }, [session?.access_token]);
  const groups = useMemo(() => {
    const now = new Date(); const today = startOfDay(now); const week = startOfWeek(now); const month = startOfMonth(now);
    const sorted = [...contracts].sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at));
    return [
      { title: "Na dziś", description: "Najświeższe działania wymagające reakcji.", icon: Sun, items: sorted.filter((item) => new Date(item.updated_at || item.created_at) >= today) },
      { title: "W tym tygodniu", description: "Umowy zmienione od początku tygodnia.", icon: CalendarClock, items: sorted.filter((item) => new Date(item.updated_at || item.created_at) >= week) },
      { title: "W tym miesiącu", description: "Aktywne sprawy z bieżącego miesiąca.", icon: CalendarDays, items: sorted.filter((item) => new Date(item.updated_at || item.created_at) >= month) }
    ];
  }, [contracts]);
  if (loading || !profile) return <LoadingScreen />;
  return <AppShell profile={profile}><div className="grid gap-5">
    <PageHeader title="Panel" description="Najważniejsze działania przy umowach — bez pełnego kalendarza." actions={<button type="button" className="btn-secondary" onClick={load}><RefreshCw className="h-4 w-4" />Odśwież</button>} />
    {error ? <Alert tone="danger">{error}</Alert> : null}
    <section className="grid gap-4 xl:grid-cols-3">{groups.map(({ title, description, icon, items }) => <div className="app-card" key={title}>
      <SectionHeader icon={icon} title={`${title} · ${items.length}`} description={description} tone={title === "Na dziś" ? "solar" : "sky"} />
      <div className="grid gap-2">{items.slice(0, 20).map((contract) => <Link href={`/realizacja/${contract.id}`} key={contract.id} className="rounded-lg border border-line p-3 transition hover:border-sky hover:bg-sky/5">
        <div className="flex items-start gap-3"><span className="app-icon bg-solar/15 text-[#8a5a00]"><PackageCheck className="h-4 w-4" /></span><span className="min-w-0"><b className="block truncate">{contract.customer_name}</b><span className="mt-1 block text-sm font-semibold text-ink">{actionLabel(contract)}</span><small className="mt-1 block text-muted">{contract.contract_number} · {formatDateTime(contract.updated_at || contract.created_at)}</small></span></div>
      </Link>)}{!busy && !items.length ? <EmptyState title="Brak pilnych działań" description="W tym okresie nie ma aktywnych zmian w umowach." /> : null}{busy ? <div className="py-6 text-center text-sm font-semibold text-muted">Pobieranie…</div> : null}</div>
    </div>)}</section>
  </div></AppShell>;
}
