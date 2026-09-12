"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { List, RefreshCw } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";
import { ContractViewToggle } from "@/components/contract-view-toggle";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import type { ContractRecord } from "@/lib/contracts";
import { contractProgress, contractStatusLabel } from "@/lib/contracts";
import { isArchived } from "@/lib/contract-workflow";
import type { Profile } from "@/lib/types";

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
      <div className="grid gap-2">{active.slice(0, 30).map((contract) => { const progress = contractProgress(contract); return <Link key={contract.id} href={`/realizacja/${contract.id}`} className="grid gap-3 rounded-lg border border-line p-4 transition hover:border-sky md:grid-cols-[1fr_180px_180px_100px] md:items-center"><div><div className="font-black">{contract.customer_name}</div><div className="text-xs text-muted">{contract.contract_number} · {contractStatusLabel(contract.process_status)} · {contract.product_type}</div></div><div className="text-sm">{contract.phone}</div><div className="text-sm">{contract.creator?.full_name || "—"}</div><div><div className="font-black">{progress}%</div><div className="mt-1 h-1.5 rounded bg-line"><div className="h-full rounded bg-leaf" style={{ width: `${progress}%` }} /></div></div></Link>; })}{dataLoading ? <LoadingScreen label="Pobieranie procesów" /> : !active.length ? <EmptyState title="Brak aktywnych procesów" description="Nowe umowy pojawią się tutaj automatycznie." /> : null}</div>
    </section>
    <Link href="/realizacja/umowy" className="btn-secondary justify-self-start"><List className="h-4 w-4" />Pełna lista umów</Link>
  </div></AppShell>;
}
