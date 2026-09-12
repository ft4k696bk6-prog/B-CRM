"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, CalendarDays, ChevronRight, Folder, List, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import { ContractArchiveButton, ContractPublicProgress, useContractWorkflowActions, WorkflowCheckbox } from "@/components/contract-workflow-controls";
import { ContractViewToggle } from "@/components/contract-view-toggle";
import { LegacyContractsView } from "@/components/legacy-contracts-view";
import { useAuth } from "@/lib/use-auth";
import type { ContractRecord } from "@/lib/contracts";
import { buildContractStats, canManageContractWorkflow, isArchived, matchesContractFilters, monthLabel, needsScheduling, signingMonth, summarizeContracts, WORKFLOW_CHECKBOXES, type ContractFilters, type ContractStatsBucket } from "@/lib/contract-workflow";
import { formatDate, formatDateTime } from "@/lib/date";

const PAGE_SIZE = 25;
const money = (amount: number) => amount.toLocaleString("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 2 });

export function ContractsWorkspace({ archive = false }: { archive?: boolean }) {
  const { loading, profile, session } = useAuth();
  const [items, setItems] = useState<ContractRecord[]>([]);
  const [buckets, setBuckets] = useState<ContractStatsBucket[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ContractFilters>({ month: "", team: "", salesperson: "" });
  const [archiveYear, setArchiveYear] = useState("");
  const [showDrafts, setShowDrafts] = useState(false);
  const [onlyUnscheduled, setOnlyUnscheduled] = useState(false);
  const [page, setPage] = useState(0);
  const [showingLegacy, setShowingLegacy] = useState(false);
  const canManage = canManageContractWorkflow(profile?.role || "");

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setDataLoading(true); setError("");
    try {
      const response = await fetch("/api/contracts", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Nie udało się pobrać umów.");
      setItems(body.contracts || []); setBuckets(body.stats || []);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Nie udało się pobrać umów."); }
    finally { setDataLoading(false); }
  }, [session?.access_token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (archive) return;
    setShowingLegacy(window.localStorage.getItem("bcrm-contract-view") === "legacy");
  }, [archive]);
  useEffect(() => { setPage(0); }, [filters, query, showDrafts, onlyUnscheduled, archiveYear]);

  const workflow = useContractWorkflowActions({
    accessToken: session?.access_token || "",
    onUpdated(contract) {
      const updated = items.map((item) => item.id === contract.id ? contract : item);
      setItems(updated); setBuckets(buildContractStats(updated));
    },
    onStale: () => { void load(); },
  });

  const sellers = useMemo(() => [...new Map(items.map((item) => [item.created_by || "unassigned", {
    id: item.created_by || "unassigned", name: item.creator?.full_name || "Nieprzypisane", managerId: item.creator?.manager_id,
  }])).values()].sort((a, b) => a.name.localeCompare(b.name, "pl")), [items]);
  const teams = useMemo(() => [...new Map(items.map((item) => {
    const id = item.creator?.manager_id || item.created_by || "unassigned";
    return [id, { id, name: item.creator?.manager_id ? item.creator.manager_name || "Zespół menadżera" : item.creator?.full_name || "Nieprzypisane" }];
  })).values()].sort((a, b) => a.name.localeCompare(b.name, "pl")), [items]);
  const months = useMemo(() => [...new Set(buckets.map((bucket) => bucket.month))].sort().reverse(), [buckets]);
  const overall = useMemo(() => summarizeContracts(buckets, { ...filters, month: "" }), [buckets, filters]);
  const scopeItems = useMemo(() => items.filter((item) => matchesContractFilters(item, { ...filters, month: "" })), [items, filters]);
  const archiveItems = scopeItems.filter(isArchived);
  const activeCount = scopeItems.filter((item) => item.submission_status === "submitted" && !isArchived(item)).length;
  const draftCount = scopeItems.filter((item) => item.submission_status === "draft" && !isArchived(item)).length;
  const summary = summarizeContracts(archive && archiveYear && !filters.month
    ? buckets.filter((bucket) => bucket.month.startsWith(`${archiveYear}-`)) : buckets, filters);

  const visible = useMemo(() => items.filter((item) => {
    if (!matchesContractFilters(item, filters)) return false;
    if (archive ? !isArchived(item) : isArchived(item)) return false;
    if (!archive && (showDrafts ? item.submission_status !== "draft" : item.submission_status !== "submitted")) return false;
    if (archive && archiveYear && !signingMonth(item.signed_at).startsWith(`${archiveYear}-`)) return false;
    if (!archive && onlyUnscheduled && !needsScheduling(item)) return false;
    const normalized = query.trim().toLocaleLowerCase("pl");
    return !normalized || [item.customer_name, item.contract_number, item.phone, item.city, item.creator?.full_name]
      .some((value) => value?.toLocaleLowerCase("pl").includes(normalized));
  }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id)),
  [items, filters, archive, archiveYear, showDrafts, onlyUnscheduled, query]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const rows = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const folders = archive && !filters.month && !query.trim();
  const folderKeys = [...new Set(archiveItems.map((item) => signingMonth(item.signed_at))
    .filter((month) => !archiveYear || month.startsWith(`${archiveYear}-`))
    .map((month) => archiveYear || month === "unknown" ? month : month.slice(0, 4)))].sort().reverse();

  function selectMonth(month: string) {
    setFilters((current) => ({ ...current, month }));
    if (archive) setArchiveYear(month && month !== "unknown" ? month.slice(0, 4) : "");
  }

  if (loading || !profile) return <LoadingScreen />;
  if (!archive && showingLegacy && session) return <LegacyContractsView profile={profile} session={session} onSwitch={() => { window.localStorage.setItem("bcrm-contract-view", "new"); setShowingLegacy(false); }} />;
  return <AppShell profile={profile}><div className="grid min-w-0 gap-5">
    <PageHeader title={archive ? "Archiwum umów" : "Umowy"}
      description={archive ? "Rozliczone umowy i rezygnacje według daty podpisania." : "Bieżące umowy i realizacja."}
      actions={<div className="flex flex-wrap gap-2">{!archive ? <ContractViewToggle showingLegacy={false} onToggle={() => { window.localStorage.setItem("bcrm-contract-view", "legacy"); setShowingLegacy(true); }} /> : null}<button type="button" className="btn-secondary" onClick={() => void load()} disabled={dataLoading || workflow.busy}><RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} />Odśwież</button></div>} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Widok umów" className="flex flex-wrap gap-2">
        <Link href="/realizacja/umowy" className={!archive && !showDrafts ? "btn-primary" : "btn-secondary"} onClick={() => setShowDrafts(false)}><List className="h-4 w-4" />Bieżące {activeCount}</Link>
        <Link href="/realizacja/archiwum" className={archive ? "btn-primary" : "btn-secondary"}><Archive className="h-4 w-4" />Archiwum {archiveItems.length}</Link>
        {!archive && draftCount > 0 ? <button className={showDrafts ? "btn-primary" : "btn-secondary"} onClick={() => setShowDrafts((value) => !value)}>Wersje robocze {draftCount}</button> : null}
      </nav>
      <div className="flex items-center gap-2 rounded-xl border border-sky/20 bg-sky/10 px-4 py-2 text-sky"><CalendarDays className="h-5 w-5" /><div><b>Do montażu: {overall.toInstall}</b><span className="block text-[11px]">Łącznie we wszystkich miesiącach</span></div></div>
    </div>
    {error || workflow.error ? <Alert tone="danger">{error || workflow.error}</Alert> : null}
    <section className="app-card !p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className="label">Miesiąc podpisania</span><select className="field" value={filters.month} onChange={(event) => selectMonth(event.target.value)}><option value="">Wszystkie miesiące</option>{months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select></label>
        {profile.role !== "handlowiec" ? <>
          <label><span className="label">Zespół</span><select className="field" value={filters.team} onChange={(event) => setFilters((current) => ({ ...current, team: event.target.value, salesperson: "" }))}><option value="">{profile.role === "menadzer" ? "Cały mój zespół" : "Wszystkie zespoły"}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <label><span className="label">Handlowiec</span><select className="field" value={filters.salesperson} onChange={(event) => setFilters((current) => ({ ...current, salesperson: event.target.value }))}><option value="">Wszyscy</option>{sellers.filter((seller) => !filters.team || seller.managerId === filters.team || seller.id === filters.team).map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>
        </> : null}
      </div>
      <p className="mt-3 text-xs text-muted">{filters.month ? monthLabel(filters.month) : archive && archiveYear ? `Rok ${archiveYear}` : "Wszystkie okresy"} · Rozliczenia i rezygnacje liczone do miesiąca podpisania.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Podpisane umowy", summary.signed, "Łącznie z późniejszymi rezygnacjami"], ["Do montażu", summary.toInstall, "Po weryfikacji, bieżące i nierozliczone"], ["Rozliczone", summary.settled, "Klient zapłacił całość"], ["Rezygnacje", summary.resigned, "Wyłączone z wartości sprzedaży"], ["Wartość brutto", money(summary.grossAmount), "Bez rezygnacji"]].map(([label, value, caption]) => <div key={String(label)} className="rounded-xl border border-line bg-white p-3"><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-1 text-xl font-black tabular-nums tracking-tight">{value}</p><p className="mt-1 text-[11px] leading-4 text-muted">{caption}</p></div>)}
      </div>
      {summary.missingAmount > 0 ? <p className="mt-3 text-xs text-warn">Niepełna wartość sprzedaży: {summary.missingAmount} umów bez wpisanej kwoty lub z kwotą 0 zł.</p> : null}
    </section>
    <section className="app-card min-w-0 !p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          {archive ? <nav aria-label="Folder archiwum" className="flex flex-wrap items-center gap-1 text-sm font-bold">
            <button className="min-h-10 rounded-md px-2 hover:bg-sky/10" onClick={() => { setArchiveYear(""); selectMonth(""); setQuery(""); }}>Archiwum</button>
            {archiveYear ? <><ChevronRight className="h-4 w-4 text-muted" /><button className="min-h-10 rounded-md px-2 hover:bg-sky/10" onClick={() => { setFilters((current) => ({ ...current, month: "" })); setQuery(""); }}>{archiveYear}</button></> : null}
            {filters.month ? <><ChevronRight className="h-4 w-4 text-muted" /><span className="px-2">{monthLabel(filters.month)}</span></> : null}
          </nav> : <h2 className="font-bold">{showDrafts ? "Wersje robocze" : "Praca bieżąca"}</h2>}
          {!archive && canManage && !showDrafts ? <button type="button" className={`min-h-10 rounded-lg border px-3 text-xs font-bold ${onlyUnscheduled ? "border-warn bg-warn/10 text-warn" : "border-line text-muted"}`} onClick={() => setOnlyUnscheduled((value) => !value)} aria-pressed={onlyUnscheduled}>Bez terminu po weryfikacji</button> : null}
        </div>
        <label className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" /><input className="field pl-9" aria-label="Szukaj umowy" placeholder="Klient, numer, telefon, miejscowość…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </div>
      {dataLoading && !items.length ? <div className="p-5 text-sm text-muted" role="status">Pobieranie umów…</div> : folders ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {folderKeys.map((key) => <button key={key} type="button" className="flex min-h-24 items-center gap-4 rounded-xl border border-line p-4 text-left transition hover:border-sky hover:bg-sky/5" onClick={() => key.length === 4 ? setArchiveYear(key) : selectMonth(key)}><Folder className="h-9 w-9 shrink-0 text-solar" /><span><b className="block capitalize">{key.length === 4 ? key : monthLabel(key)}</b><span className="text-xs text-muted">Umowy: {archiveItems.filter((item) => key.length === 4 ? signingMonth(item.signed_at).startsWith(`${key}-`) : signingMonth(item.signed_at) === key).length}</span></span></button>)}
        {!folderKeys.length ? <EmptyState title="Archiwum jest puste" description="Rozliczone umowy i rezygnacje pojawią się tutaj po archiwizacji." className="col-span-full" /> : null}
      </div> : <>
        <div className="overflow-x-auto overscroll-x-contain"><table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-line bg-[#f8fafc] text-xs text-muted"><tr>
            <th className="sticky left-0 z-10 min-w-[200px] bg-[#f8fafc] px-4 py-3">Klient / umowa</th><th className="min-w-[135px] px-3 py-3">Miejscowość</th><th className="min-w-[145px] px-3 py-3">Handlowiec</th><th className="min-w-[120px] px-3 py-3">Podpisana</th><th className="px-3 py-3">Instalacja</th><th className="min-w-[125px] px-3 py-3 text-right">Brutto</th>
            {canManage && !showDrafts ? WORKFLOW_CHECKBOXES.map(([key, label]) => <th key={key} className="min-w-[100px] px-2 py-3 text-center">{label}</th>) : null}
            <th className="min-w-[170px] px-3 py-3">{canManage ? "Termin montażu" : "Realizacja"}</th>{archive ? <th className="px-3 py-3">Zakończenie</th> : null}{canManage ? <th className="px-3 py-3">Działania</th> : null}
          </tr></thead>
          <tbody>{rows.map((contract) => <tr key={contract.id} className={`border-b border-line last:border-b-0 ${canManage && needsScheduling(contract) ? "bg-warn/5" : "bg-white"}`}>
            <td className="sticky left-0 z-[1] min-w-[200px] border-r border-line bg-white px-4 py-3"><Link className="font-bold text-ink hover:text-sky hover:underline" href={contract.submission_status === "draft" ? `/realizacja/nowa?contractId=${contract.id}` : `/realizacja/${contract.id}`}>{contract.customer_name}</Link><p className="mt-0.5 text-xs text-muted">{contract.contract_number}</p>{contract.phone ? <a className="mt-1 inline-block text-xs text-sky" href={`tel:${contract.phone}`}>{contract.phone}</a> : null}{canManage && needsScheduling(contract) ? <p className="mt-1 text-[11px] font-bold text-warn">Do umówienia montażu</p> : null}</td>
            <td className="px-3 py-3">{contract.city || "—"}</td><td className="px-3 py-3">{contract.creator?.full_name || "Nieprzypisane"}</td><td className="whitespace-nowrap px-3 py-3 text-xs">{formatDate(contract.signed_at)}</td><td className="px-3 py-3">{String(contract.product_type) === "other" ? "—" : contract.product_type}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{Number(contract.gross_amount) > 0 ? money(Number(contract.gross_amount)) : <span className="text-xs font-normal text-warn">Brak kwoty</span>}</td>
            {canManage && !showDrafts ? WORKFLOW_CHECKBOXES.map(([key, label]) => <td key={key} className="px-2 py-2 text-center"><WorkflowCheckbox contract={contract} field={key} label={label} busy={workflow.busy} onChange={workflow.setField} /></td>) : null}
            <td className="px-3 py-3">{canManage ? <><span className="whitespace-nowrap text-xs">{contract.installation_scheduled ? formatDateTime(contract.installation_at) : "Nie umówiono"}</span>{!isArchived(contract) && contract.installation_scheduled ? <button className="mt-1 block min-h-8 text-xs font-semibold text-sky" disabled={workflow.busy} onClick={() => workflow.openSchedule(contract)}>Zmień termin</button> : null}</> : <ContractPublicProgress contract={contract} />}</td>
            {archive ? <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ${contract.archive_reason === "resigned" ? "bg-danger/10 text-danger" : "bg-leaf/10 text-leaf"}`}>{contract.archive_reason === "resigned" ? "Rezygnacja" : "Rozliczona"}</span></td> : null}
            {canManage ? <td className="px-3 py-3"><ContractArchiveButton contract={contract} busy={workflow.busy} onArchive={workflow.openArchive} onRestore={workflow.restore} /></td> : null}
          </tr>)}</tbody>
        </table></div>
        {!rows.length ? <div className="p-4"><EmptyState title="Brak umów w tym widoku" description="Zmień okres, filtry lub wyszukiwanie." /></div> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-muted"><span>{visible.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, visible.length)} z ${visible.length}` : "0 umów"} · Najnowsze dodane na górze</span><div className="flex items-center gap-2"><button className="btn-secondary text-xs" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Poprzednia</button><span>{currentPage + 1} / {pages}</span><button className="btn-secondary text-xs" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Następna</button></div></div>
      </>}
    </section>
    {workflow.dialogs}
  </div></AppShell>;
}
