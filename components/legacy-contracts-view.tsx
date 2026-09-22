"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, List, RefreshCw } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";
import { ContractViewToggle } from "@/components/contract-view-toggle";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import type { ContractRecord } from "@/lib/contracts";
import { contractProgress, contractStatusLabel } from "@/lib/contracts";
import { isArchived } from "@/lib/contract-workflow";
import type { Profile } from "@/lib/types";
import { formatDateTime } from "@/lib/date";

export function LegacyContractsView({ profile, session, onSwitch }: { profile: Profile; session: Session; onSwitch: () => void }) {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [error, setError] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  async function load() {
    setDataLoading(true);
    setError("");
    try {
      const response = await fetch("/api/contracts", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Nie udało się pobrać umów.");
      setContracts(body.contracts || []);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Nie udało się pobrać umów.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => { void load(); }, [session.access_token]);

  const active = contracts.filter((contract) => contract.submission_status === "submitted" && !isArchived(contract) && contract.is_process_visible !== false && contract.process_status !== "paused");

  return <AppShell profile={profile}><div className="grid gap-5">
    <PageHeader title="Umowy i procesy" description="Poprzedni widok umów z przebiegiem realizacji." actions={<div className="flex flex-wrap gap-2"><ContractViewToggle showingLegacy onToggle={onSwitch} /><button className="btn-secondary" onClick={() => void load()} disabled={dataLoading}><RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} />Odśwież</button></div>} />
    {error ? <Alert tone="danger">{error}</Alert> : null}
    <section className="app-card"><div className="mb-4"><h2 className="text-lg font-black">Klienci w procesie</h2><p className="text-sm text-muted">Kliknij klienta, aby zobaczyć szczegóły umowy.</p></div>
      <div className="grid gap-3">{active.slice(0, 30).map((contract) => { const progress = contractProgress(contract); const scheduled = Boolean(contract.installation_scheduled && contract.installation_at); return <Link key={contract.id} href={`/realizacja/${contract.id}`} className="group grid gap-4 rounded-xl border border-line border-l-4 border-l-sky bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky hover:shadow-md md:grid-cols-[minmax(220px,1fr)_160px_180px_190px] md:items-center"><div><div className="font-black group-hover:text-sky">{contract.customer_name}</div><div className="mt-1 text-xs text-muted">{contract.contract_number} · {contract.product_type}</div><div className="mt-2 flex items-center gap-2"><span className="rounded-full bg-sky/10 px-2 py-1 text-[11px] font-bold text-sky">{contractStatusLabel(contract.process_status)}</span><span className="text-xs text-muted">{progress}% procesu</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-to-r from-sky to-leaf transition-all" style={{ width: `${progress}%` }} /></div></div><div className="text-sm"><span className="block text-xs text-muted">Telefon</span><span className="font-semibold">{contract.phone || "—"}</span></div><div className="text-sm"><span className="block text-xs text-muted">Handlowiec</span><span className="font-semibold">{contract.creator?.full_name || "—"}</span></div><div className={scheduled ? "rounded-lg bg-leaf/10 p-3 text-sm text-leaf" : "rounded-lg bg-warn/10 p-3 text-sm text-warn"}><span className="flex items-center gap-1 text-xs font-bold"><CalendarDays className="h-4 w-4" />Termin montażu</span><b className="mt-1 block">{scheduled ? formatDateTime(contract.installation_at) : "Nie umówiono"}</b></div></Link>; })}{dataLoading ? <LoadingScreen label="Pobieranie procesów" /> : !active.length ? <EmptyState title="Brak aktywnych procesów" description="Nowe umowy pojawią się tutaj automatycznie." /> : null}</div>
    </section>
    <Link href="/realizacja/umowy" className="btn-secondary justify-self-start"><List className="h-4 w-4" />Pełna lista umów</Link>
  </div></AppShell>;
}
