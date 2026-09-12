"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import type { ContractRecord } from "@/lib/contracts";
import { canManageContractWorkflow, isArchived, monthLabel, signingMonth } from "@/lib/contract-workflow";
import { formatDate } from "@/lib/date";
import { useAuth } from "@/lib/use-auth";

const money = (amount: number) => amount.toLocaleString("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 2 });

export function ContractsCommissions() {
  const { loading, profile, session } = useAuth();
  const [items, setItems] = useState<ContractRecord[]>([]);
  const [month, setMonth] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [error, setError] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setDataLoading(true); setError("");
    try {
      const response = await fetch("/api/contracts", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Nie udało się pobrać prowizji.");
      setItems(body.contracts || []);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Nie udało się pobrać prowizji."); }
    finally { setDataLoading(false); }
  }, [session?.access_token]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => items.filter((item) => item.submission_status === "submitted" && (!month || signingMonth(item.signed_at) === month) && (!salesperson || item.created_by === salesperson)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [items, month, salesperson]);
  const months = useMemo(() => [...new Set(items.map((item) => signingMonth(item.signed_at)))].filter((value) => value !== "unknown").sort().reverse(), [items]);
  const sellers = useMemo(() => [...new Map(items.map((item) => [item.created_by, item.creator?.full_name || "Nieprzypisane"])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pl")), [items]);
  const total = rows.reduce((sum, item) => sum + (Number(item.commission_amount) || 0), 0);
  const settled = rows.filter((item) => item.workflow?.settled).reduce((sum, item) => sum + (Number(item.commission_amount) || 0), 0);

  if (loading || !profile) return <LoadingScreen />;
  if (!canManageContractWorkflow(profile.role)) return <AppShell profile={profile}><Alert tone="danger">Ta zakładka jest dostępna tylko dla właściciela i administratorów.</Alert></AppShell>;

  return <AppShell profile={profile}><div className="grid min-w-0 gap-5">
    <PageHeader title="Prowizje" description="Prowizje zapisane na umowach. Widok prywatny dla właściciela i administratorów." actions={<div className="flex flex-wrap gap-2"><Link href="/realizacja/umowy" className="btn-secondary"><ArrowLeft className="h-4 w-4" />Umowy</Link><button type="button" className="btn-secondary" onClick={() => void load()} disabled={dataLoading}><RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} />Odśwież</button></div>} />
    {error ? <Alert tone="danger">{error}</Alert> : null}
    <section className="app-card !p-4"><div className="grid gap-3 sm:grid-cols-3"><label><span className="label">Miesiąc podpisania</span><select className="field" value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Wszystkie miesiące</option>{months.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}</select></label><label><span className="label">Handlowiec</span><select className="field" value={salesperson} onChange={(event) => setSalesperson(event.target.value)}><option value="">Wszyscy</option>{sellers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="rounded-xl border border-line bg-white p-3"><p className="text-xs text-muted">Umowy</p><p className="mt-1 text-xl font-black">{rows.length}</p></div><div className="rounded-xl border border-line bg-white p-3"><p className="text-xs text-muted">Prowizja łącznie</p><p className="mt-1 text-xl font-black">{money(total)}</p></div><div className="rounded-xl border border-line bg-white p-3"><p className="text-xs text-muted">Z rozliczonych</p><p className="mt-1 text-xl font-black text-leaf">{money(settled)}</p></div><div className="rounded-xl border border-line bg-white p-3"><p className="text-xs text-muted">Nierozliczone</p><p className="mt-1 text-xl font-black text-warn">{money(total - settled)}</p></div></div></section>
    <section className="app-card min-w-0 !p-0"><div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead className="border-b border-line bg-[#f8fafc] text-xs text-muted"><tr><th className="min-w-[190px] px-4 py-3">Klient / umowa</th><th className="px-3 py-3">Handlowiec</th><th className="px-3 py-3">Podpisana</th><th className="px-3 py-3 text-right">Brutto</th><th className="px-3 py-3 text-right">Marża netto</th><th className="px-3 py-3 text-right">%</th><th className="px-3 py-3 text-right">Prowizja</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="border-b border-line last:border-b-0"><td className="px-4 py-3"><Link href={`/realizacja/${item.id}`} className="font-bold text-ink hover:text-sky hover:underline">{item.customer_name}</Link><p className="text-xs text-muted">{item.contract_number}</p></td><td className="px-3 py-3">{item.creator?.full_name || "Nieprzypisane"}</td><td className="whitespace-nowrap px-3 py-3 text-xs">{formatDate(item.signed_at)}</td><td className="whitespace-nowrap px-3 py-3 text-right">{money(Number(item.gross_amount) || 0)}</td><td className="whitespace-nowrap px-3 py-3 text-right">{money(Number(item.commission_margin_net) || 0)}</td><td className="px-3 py-3 text-right">{Number(item.commission_percent) || 0}%</td><td className="whitespace-nowrap px-3 py-3 text-right font-bold">{money(Number(item.commission_amount) || 0)}</td><td className="px-3 py-3"><span className={`rounded-md px-2 py-1 text-xs font-bold ${isArchived(item) ? item.archive_reason === "resigned" ? "bg-danger/10 text-danger" : "bg-leaf/10 text-leaf" : "bg-sky/10 text-sky"}`}>{isArchived(item) ? item.archive_reason === "resigned" ? "Rezygnacja" : "Rozliczona" : item.workflow?.settled ? "Rozliczona, bieżąca" : "Bieżąca"}</span></td></tr>)}</tbody></table></div>{dataLoading && !items.length ? <div className="p-5"><LoadingScreen label="Pobieranie prowizji" /></div> : !rows.length ? <div className="p-5"><EmptyState title="Brak prowizji w tym filtrze" description="Zmień miesiąc lub handlowca." /></div> : null}</section>
  </div></AppShell>;
}
