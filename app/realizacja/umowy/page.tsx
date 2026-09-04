"use client";

import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, CirclePause, GripVertical, RefreshCw, Search, UserRoundX } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import { ACTIVE_CONTRACT_STATUSES, contractStatusLabel, type ContractRecord, type ContractStatus } from "@/lib/contracts";
import { useAuth } from "@/lib/use-auth";

const PIPELINE_STATUSES: ContractStatus[] = [...ACTIVE_CONTRACT_STATUSES, "settled"];
const tone: Record<ContractStatus, string> = {
  incomplete: "bg-slate-400", verification: "bg-sky", equipment_to_order: "bg-violet-500",
  installation_to_schedule: "bg-solar", installation_scheduled: "bg-amber-500",
  installation_confirmation: "bg-cyan-500", settlement: "bg-emerald-500", settled: "bg-leaf",
  resigned: "bg-danger", paused: "bg-slate-500",
};

function ContractCard({ contract, canMove, onMove }: { contract: ContractRecord; canMove: boolean; onMove: (contract: ContractRecord, status: ContractStatus) => void }) {
  const status = contract.process_status || "verification";
  const statusIndex = PIPELINE_STATUSES.indexOf(status);
  const nextStatus = statusIndex >= 0 ? PIPELINE_STATUSES[statusIndex + 1] : undefined;
  return <article draggable={canMove} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/contract-id", contract.id); }} className="group rounded-xl border border-line bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sky/40 hover:shadow-md active:scale-[.985]">
    <div className="flex items-start gap-2">{canMove ? <GripVertical className="mt-0.5 h-4 w-4 flex-none cursor-grab text-muted/50 group-active:cursor-grabbing" aria-hidden="true" /> : null}<Link href={`/realizacja/${contract.id}`} className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><h3 className="truncate font-black text-ink">{contract.customer_name}</h3><p className="mt-0.5 truncate text-xs text-muted">{contract.contract_number} · {contract.product_type}</p></Link></div>
    <div className="mt-3 flex items-end justify-between gap-2 border-t border-line/70 pt-3"><div className="min-w-0 text-xs text-muted"><div className="truncate">{contract.creator?.full_name || "Bez opiekuna"}</div><div>{contract.phone}</div></div>{canMove && nextStatus ? <button type="button" className="inline-flex min-h-9 flex-none items-center gap-1 rounded-lg px-2 text-xs font-bold text-sky transition hover:bg-sky/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky" onClick={() => onMove(contract, nextStatus)} aria-label={`Przenieś do etapu: ${contractStatusLabel(nextStatus)}`}>Dalej<ArrowRight className="h-3.5 w-3.5" /></button> : null}</div>
  </article>;
}

export default function AllContracts() {
  const { loading, profile, session } = useAuth();
  const [items, setItems] = useState<ContractRecord[]>([]); const [query, setQuery] = useState(""); const [dataLoading, setDataLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null); const [error, setError] = useState(""); const [exceptionsOpen, setExceptionsOpen] = useState(false);
  const canMove = Boolean(profile && ["owner", "admin", "menadzer"].includes(profile.role));
  const load = useCallback(async () => { if (!session?.access_token) return; setDataLoading(true); setError(""); const response = await fetch("/api/contracts", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" }); const body = await response.json(); if (response.ok) setItems(body.contracts || []); else setError(body.error || "Nie udało się pobrać umów."); setDataLoading(false); }, [session?.access_token]);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => items.filter((contract) => [contract.customer_name, contract.contract_number, contract.phone, contract.email].join(" ").toLocaleLowerCase("pl-PL").includes(query.toLocaleLowerCase("pl-PL"))), [items, query]);
  const submitted = visible.filter((contract) => contract.submission_status === "submitted"); const drafts = visible.filter((contract) => contract.submission_status !== "submitted");
  const exceptions = submitted.filter((contract) => ["paused", "resigned"].includes(contract.process_status || "verification"));
  async function move(contract: ContractRecord, nextStatus: ContractStatus) { if (!session?.access_token || !canMove || savingId) return; const previousStatus = contract.process_status; setSavingId(contract.id); setError(""); setItems((current) => current.map((item) => item.id === contract.id ? { ...item, process_status: nextStatus } : item)); const response = await fetch("/api/contracts", { method: "PATCH", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: contract.id, process_status: nextStatus }) }); const body = await response.json(); if (!response.ok) { setItems((current) => current.map((item) => item.id === contract.id ? { ...item, process_status: previousStatus } : item)); setError(body.error || "Nie udało się zmienić etapu umowy."); } else setItems((current) => current.map((item) => item.id === contract.id ? body.contract : item)); setSavingId(null); }
  function drop(event: DragEvent, status: ContractStatus) { event.preventDefault(); const contract = items.find((item) => item.id === event.dataTransfer.getData("text/contract-id")); if (contract && contract.process_status !== status) void move(contract, status); }
  if (loading || !profile) return <LoadingScreen />;
  return <AppShell profile={profile}><div className="grid gap-5">
    <PageHeader title="Lejek umów" description="Przesuwaj umowy między etapami i od razu widź, co wymaga działania." actions={<button type="button" className="btn-secondary min-h-11" onClick={() => void load()} disabled={dataLoading}><RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} />Odśwież</button>} />
    {error ? <Alert tone="danger">{error}</Alert> : null}
    <section className="app-card py-3"><label className="relative block max-w-xl"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted" /><span className="sr-only">Szukaj umowy</span><input className="field min-h-11 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Klient, numer umowy, telefon lub e-mail" /></label></section>
    {dataLoading ? <LoadingScreen label="Pobieranie umów" /> : <><section className="overflow-x-auto pb-3" aria-label="Etapy realizacji umów"><div className="flex min-w-max items-start gap-3">{PIPELINE_STATUSES.map((status) => { const contracts = submitted.filter((contract) => (contract.process_status || "verification") === status); return <div key={status} className="w-[292px] flex-none rounded-2xl border border-line bg-[#f5f7f9] p-2.5" onDragOver={(event) => { if (canMove) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => drop(event, status)}><header className="mb-2.5 flex items-center justify-between gap-2 px-1 py-1"><div className="flex min-w-0 items-center gap-2"><span className={`h-2.5 w-2.5 flex-none rounded-full ${tone[status]}`} /><h2 className="truncate text-sm font-black text-ink">{contractStatusLabel(status)}</h2></div><span className="rounded-full bg-white px-2 py-0.5 text-xs font-black tabular-nums text-muted shadow-sm">{contracts.length}</span></header><div className="grid min-h-24 gap-2.5">{contracts.map((contract) => <ContractCard key={contract.id} contract={contract} canMove={canMove && savingId !== contract.id} onMove={move} />)}{!contracts.length ? <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-line bg-white/60 px-4 text-center text-xs text-muted">Upuść umowę tutaj</div> : null}</div></div>; })}</div></section>
      <section className="app-card p-0"><button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-left" onClick={() => setExceptionsOpen((value) => !value)} aria-expanded={exceptionsOpen}><span className="flex items-center gap-2 font-black"><CirclePause className="h-4 w-4 text-muted" />Wstrzymane i rezygnacje <span className="rounded-full bg-[#f3f5f7] px-2 py-0.5 text-xs text-muted">{exceptions.length}</span></span><ChevronDown className={`h-4 w-4 transition-transform duration-200 ${exceptionsOpen ? "rotate-180" : ""}`} /></button>{exceptionsOpen ? <div className="grid gap-3 border-t border-line p-4 md:grid-cols-2 xl:grid-cols-3">{exceptions.map((contract) => <ContractCard key={contract.id} contract={contract} canMove={canMove} onMove={move} />)}{!exceptions.length ? <EmptyState title="Brak wstrzymanych umów i rezygnacji" description="Umowy wymagające osobnej uwagi pojawią się tutaj." /> : null}</div> : null}</section>
      {drafts.length ? <section className="app-card"><div className="mb-3 flex items-center gap-2"><UserRoundX className="h-4 w-4 text-muted" /><h2 className="font-black">Wersje robocze</h2><span className="text-xs text-muted">{drafts.length}</span></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{drafts.map((contract) => <ContractCard key={contract.id} contract={contract} canMove={false} onMove={move} />)}</div></section> : null}{!visible.length ? <EmptyState title="Brak umów" description="Nie znaleziono umów spełniających kryteria." /> : null}</>}
  </div></AppShell>;
}
