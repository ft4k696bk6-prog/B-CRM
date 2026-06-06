"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  ChevronDown,
  Database,
  FileDown,
  FileSignature,
  FolderKanban,
  Inbox,
  ListChecks,
  PhoneCall,
  RefreshCw,
  Search,
  Trophy,
  UserCheck
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LeadTable } from "@/components/lead-table";
import { LoadingScreen } from "@/components/loading-screen";
import { RegionFields } from "@/components/region-fields";
import { StatTile } from "@/components/stat-tile";
import { Alert, PageHeader, SectionHeader } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { endOfDay, escapeCsv, needsNextAction, startOfDay } from "@/lib/admin-leads";
import { LEAD_STATUSES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { canManageLeads, isManagerRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { AdminLeadFilters, Lead, LeadStatus, Profile, SortOption } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

const initialFilters: AdminLeadFilters = {
  createdFrom: "",
  createdTo: "",
  updatedFrom: "",
  updatedTo: "",
  openedFrom: "",
  openedTo: "",
  postalCode: "",
  voivodeship: "",
  county: "",
  status: "",
  assignedTo: ""
};

const sortOptions: Array<SortOption & { label: string }> = [
  { label: "Dodane: najnowsze", column: "created_at", direction: "desc" },
  { label: "Dodane: najstarsze", column: "created_at", direction: "asc" },
  { label: "Modyfikacja: najnowsza", column: "updated_at", direction: "desc" },
  { label: "Ostatnie otwarcie", column: "last_opened_at", direction: "desc" },
  { label: "Imię i nazwisko", column: "full_name", direction: "asc" },
  { label: "Kod pocztowy", column: "postal_code", direction: "asc" },
  { label: "Status", column: "status", direction: "asc" }
];

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

export default function AdminDashboardPage() {
  const { loading, profile } = useAuth(["owner", "admin", "menadzer", "finance", "viewer"]);
  const { language } = useLanguage();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salespeople, setSalespeople] = useState<Profile[]>([]);
  const [salespeopleLoaded, setSalespeopleLoaded] = useState(false);
  const [filters, setFilters] = useState<AdminLeadFilters>(initialFilters);
  const [sort, setSort] = useState<SortOption>(sortOptions[0]);
  const [showFilters, setShowFilters] = useState(false);
  const [showTeamResults, setShowTeamResults] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    all: 0,
    unassigned: 0,
    assigned: 0,
    callbacks: 0,
    meetings: 0,
    contracts: 0,
    resignations: 0,
    noNextAction: 0
  });

  const isManager = isManagerRole(profile?.role);
  const profileId = profile?.id;
  const crmEnvironment = profile?.crm_environment;
  const canAssignLeads = canManageLeads(profile?.role);
  const canExportCurrentView = hasPermission(profile?.role, "data:export");
  const isEnglish = language === "en";
  const debouncedFilters = useDebouncedValue(filters, 250);
  const salespersonScopeKey = isManager ? salespeople.map((person) => person.id).join(",") : "";
  const salespeopleReady = !isManager || salespeopleLoaded;

  const loadSalespeople = useCallback(async () => {
    if (!crmEnvironment) return;

    setSalespeopleLoaded(false);

    let query = supabase
      .from("profiles")
      .select("*")
      .in("role", ["handlowiec", "sales"])
      .eq("crm_environment", crmEnvironment)
      .order("full_name", { ascending: true });

    if (isManager && profileId) query = query.eq("manager_id", profileId);

    const { data } = await query;

    setSalespeople((data || []) as Profile[]);
    setSalespeopleLoaded(true);
  }, [crmEnvironment, isManager, profileId]);

  const loadStats = useCallback(async () => {
    if (!crmEnvironment) return;

    let query = supabase
      .from("leads")
      .select("id,status,assigned_to,meeting_at,callback_at")
      .eq("crm_environment", crmEnvironment);

    if (isManager) {
      query = query.or(salespersonScopeKey ? `assigned_to.in.(${salespersonScopeKey}),assigned_to.is.null` : "assigned_to.is.null");
    }

    const { data } = await query;

    const nextStats = {
      all: 0,
      unassigned: 0,
      assigned: 0,
      callbacks: 0,
      meetings: 0,
      contracts: 0,
      resignations: 0,
      noNextAction: 0
    };

    for (const lead of (data || []) as Pick<Lead, "id" | "status" | "assigned_to" | "meeting_at" | "callback_at">[]) {
      nextStats.all += 1;
      if (!lead.assigned_to && lead.status !== "Zwrot") nextStats.unassigned += 1;
      if (lead.assigned_to) nextStats.assigned += 1;
      if (lead.status === "Call back") nextStats.callbacks += 1;
      if (lead.status === "Spotkanie" || lead.meeting_at) nextStats.meetings += 1;
      if (lead.status === "Umowa") nextStats.contracts += 1;
      if (lead.status === "Rezygnacja") nextStats.resignations += 1;
      if (needsNextAction(lead)) nextStats.noNextAction += 1;
    }

    setStats(nextStats);
  }, [crmEnvironment, isManager, salespersonScopeKey]);

  const loadLeads = useCallback(async () => {
    if (!crmEnvironment) return;

    setBusy(true);
    setError("");

    let query = supabase
      .from("leads")
      .select(
        "*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)"
      )
      .eq("crm_environment", crmEnvironment)
      .order(sort.column, { ascending: sort.direction === "asc", nullsFirst: false })
      .limit(1000);

    if (debouncedFilters.createdFrom) query = query.gte("created_at", startOfDay(debouncedFilters.createdFrom));
    if (debouncedFilters.createdTo) query = query.lte("created_at", endOfDay(debouncedFilters.createdTo));
    if (debouncedFilters.updatedFrom) query = query.gte("updated_at", startOfDay(debouncedFilters.updatedFrom));
    if (debouncedFilters.updatedTo) query = query.lte("updated_at", endOfDay(debouncedFilters.updatedTo));
    if (debouncedFilters.openedFrom) query = query.gte("last_opened_at", startOfDay(debouncedFilters.openedFrom));
    if (debouncedFilters.openedTo) query = query.lte("last_opened_at", endOfDay(debouncedFilters.openedTo));
    if (debouncedFilters.postalCode) query = query.ilike("postal_code", `%${debouncedFilters.postalCode}%`);
    if (debouncedFilters.voivodeship) query = query.ilike("voivodeship", `%${debouncedFilters.voivodeship}%`);
    if (debouncedFilters.county) query = query.ilike("county", `%${debouncedFilters.county}%`);
    if (debouncedFilters.status) query = query.eq("status", debouncedFilters.status as LeadStatus);

    if (isManager && !debouncedFilters.assignedTo) {
      query = query.or(salespersonScopeKey ? `assigned_to.in.(${salespersonScopeKey}),assigned_to.is.null` : "assigned_to.is.null");
    }

    if (debouncedFilters.assignedTo === "__unassigned") {
      query = query.is("assigned_to", null).neq("status", "Zwrot");
    } else if (debouncedFilters.assignedTo === "__returned") {
      query = query.eq("status", "Zwrot");
      if (isManager) {
        query = query.or(salespersonScopeKey ? `assigned_to.in.(${salespersonScopeKey}),assigned_to.is.null` : "assigned_to.is.null");
      }
    } else if (debouncedFilters.assignedTo) {
      query = query.eq("assigned_to", debouncedFilters.assignedTo);
    }

    const { data, error: leadsError } = await query;

    if (leadsError) {
      setError(leadsError.message);
    } else {
      setLeads((data || []) as Lead[]);
      setSelectedIds([]);
    }

    setBusy(false);
  }, [crmEnvironment, debouncedFilters, isManager, salespersonScopeKey, sort]);

  useEffect(() => {
    loadSalespeople();
  }, [loadSalespeople]);

  useEffect(() => {
    if (!salespeopleReady) return;
    loadStats();
  }, [loadStats, salespeopleReady]);

  useEffect(() => {
    if (!salespeopleReady) return;
    loadLeads();
  }, [loadLeads, salespeopleReady]);

  const selectedCount = selectedIds.length;

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  const teamPerformance = useMemo(
    () => {
      const now = Date.now();
      const totals = new Map(
        salespeople.map((person) => [
          person.id,
          { leads: 0, meetings: 0, contracts: 0, overdueCallbacks: 0, noNextAction: 0 }
        ])
      );

      for (const lead of leads) {
        if (!lead.assigned_to) continue;
        const row = totals.get(lead.assigned_to);
        if (!row) continue;

        row.leads += 1;
        if (lead.status === "Spotkanie" || lead.meeting_at) row.meetings += 1;
        if (lead.status === "Umowa") row.contracts += 1;
        if (lead.status === "Call back" && lead.callback_at && new Date(lead.callback_at).getTime() < now) {
          row.overdueCallbacks += 1;
        }
        if (needsNextAction(lead)) row.noNextAction += 1;
      }

      return salespeople
        .map((person) => ({ person, ...totals.get(person.id)! }))
        .sort((a, b) => b.contracts - a.contracts || b.meetings - a.meetings || b.leads - a.leads);
    },
    [leads, salespeople]
  );

  function updateFilter(key: keyof AdminLeadFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleLead(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  function toggleAllVisible() {
    const allVisibleIds = leads.map((lead) => lead.id);
    const allSelected = allVisibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : allVisibleIds);
  }

  function exportCurrentView() {
    const headers = [
      "Imię i nazwisko",
      "Telefon",
      "Kod pocztowy",
      "Województwo",
      "Powiat",
      "Status",
      "Handlowiec",
      "Call-back",
      "Spotkanie",
      "Źródło",
      "Utworzony",
      "Zaktualizowany"
    ];
    const rows = leads.map((lead) => [
      lead.full_name,
      lead.phone,
      lead.postal_code,
      lead.voivodeship,
      lead.county,
      lead.status,
      lead.assigned_profile?.full_name || "Nieprzypisany",
      lead.callback_at,
      lead.meeting_at,
      lead.source,
      lead.created_at,
      lead.updated_at
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `b-crm-leady-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function assignSelected() {
    if (!profile || !selectedSalesperson || selectedIds.length === 0) return;

    setBusy(true);
    setError("");

    const { error: assignError } = await supabase
      .from("leads")
      .update({
        assigned_to: selectedSalesperson,
        status: "Przypisany"
      })
      .eq("crm_environment", profile.crm_environment)
      .in("id", selectedIds);

    if (assignError) {
      setError(assignError.message);
    } else {
      setSelectedIds([]);
      setSelectedSalesperson("");
      await Promise.all([loadStats(), loadLeads()]);
    }

    setBusy(false);
  }

  if (loading || !profile) return <LoadingScreen />;

  const dashboardCopy = isEnglish
    ? {
        managerDescription: "Team leads, lead pool and current statuses.",
        adminDescription: "All leads, assignments and current statuses.",
        exportCsv: "Export CSV",
        refresh: "Refresh",
        stats: {
          all: "All",
          unassigned: "Unassigned",
          assigned: "Assigned",
          callbacks: "Call-back",
          meetings: "Meetings",
          contracts: "Contracts",
          resignations: "Resignations",
          noNextAction: "No action"
        },
        operationsTitle: "Post-contract operations",
        operationsDescription: "Documents, accounting, logistics, installation and annex generation in one place.",
        openOperations: "Open operations",
        teamTitle: "Team results",
        teamDescription: `${teamPerformance.length} salespeople in the current view. Details stay collapsed so the dashboard stays focused.`,
        showTeam: "Show results",
        hideTeam: "Hide results",
        salesperson: "Salesperson",
        leads: "Leads",
        meetings: "Meetings",
        contracts: "Contracts",
        overdueCallbacks: "Overdue call-backs",
        noAction: "No action"
      }
    : {
        managerDescription: "Leady zespołu, baza do rozdania i bieżące statusy.",
        adminDescription: "Wszystkie leady, przypisania i bieżące statusy.",
        exportCsv: "Eksport CSV",
        refresh: "Odśwież",
        stats: {
          all: "Wszystkie",
          unassigned: "Nieprzypisane",
          assigned: "Przypisane",
          callbacks: "Call-back",
          meetings: "Spotkania",
          contracts: "Umowy",
          resignations: "Rezygnacje",
          noNextAction: "Bez akcji"
        },
        operationsTitle: "Realizacja po umowie",
        operationsDescription: "Dokumenty, księgowość, logistyka, montaż i generator aneksu w jednym miejscu.",
        openOperations: "Otwórz realizację",
        teamTitle: "Wyniki zespołu",
        teamDescription: `${teamPerformance.length} handlowców w aktualnym widoku. Szczegóły są schowane, żeby dashboard został zwarty.`,
        showTeam: "Pokaż wyniki",
        hideTeam: "Ukryj wyniki",
        salesperson: "Handlowiec",
        leads: "Leady",
        meetings: "Spotkania",
        contracts: "Umowy",
        overdueCallbacks: "Zaległe call-backi",
        noAction: "Bez akcji"
      };

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div data-tour-id="tour-dashboard">
          <PageHeader
            title={
              isEnglish
                ? profile.role === "menadzer"
                  ? "Manager dashboard"
                  : profile.role === "finance"
                    ? "Finance dashboard"
                    : profile.role === "viewer"
                      ? "Viewer dashboard"
                      : "Admin dashboard"
                : `Panel ${
                    profile.role === "menadzer"
                      ? "menadżera"
                      : profile.role === "finance"
                        ? "finansowy"
                        : profile.role === "viewer"
                          ? "podglądu"
                          : "admina"
                  }`
            }
            description={
              isManager
                ? dashboardCopy.managerDescription
                : dashboardCopy.adminDescription
            }
            actions={
              <>
              {canExportCurrentView ? (
                <button type="button" onClick={exportCurrentView} className="btn-secondary">
                  <FileDown className="h-4 w-4" aria-hidden="true" />
                  {dashboardCopy.exportCsv}
                </button>
              ) : null}
              <button type="button" onClick={loadLeads} className="btn-secondary">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {dashboardCopy.refresh}
              </button>
              </>
            }
          />
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label={dashboardCopy.stats.all} value={stats.all} icon={Database} tone="sky" />
          <StatTile label={dashboardCopy.stats.unassigned} value={stats.unassigned} icon={Inbox} tone="solar" />
          <StatTile label={dashboardCopy.stats.assigned} value={stats.assigned} icon={UserCheck} tone="leaf" />
          <StatTile label={dashboardCopy.stats.callbacks} value={stats.callbacks} icon={PhoneCall} tone="warn" />
          <StatTile label={dashboardCopy.stats.meetings} value={stats.meetings} icon={CalendarDays} tone="leaf" />
          <StatTile label={dashboardCopy.stats.contracts} value={stats.contracts} icon={FileSignature} tone="leaf" />
          <StatTile label={dashboardCopy.stats.resignations} value={stats.resignations} icon={Ban} tone="danger" />
          <StatTile label={dashboardCopy.stats.noNextAction} value={stats.noNextAction} icon={ListChecks} tone="warn" />
        </section>

        <section className="app-card">
          <SectionHeader
            icon={FolderKanban}
            title={dashboardCopy.operationsTitle}
            description={dashboardCopy.operationsDescription}
            actions={<Link href="/realizacja" className="btn-primary">{dashboardCopy.openOperations}</Link>}
          />
        </section>

        {teamPerformance.length > 0 ? (
          <section className={showTeamResults ? "app-card" : "rounded-lg border border-line bg-white px-4 py-3 shadow-sm"}>
            <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${showTeamResults ? "mb-4" : ""}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="app-icon bg-sky/10 text-sky">
                  <Trophy className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-ink">{dashboardCopy.teamTitle}</h2>
                  {showTeamResults ? (
                    <p className="mt-1 text-sm leading-6 text-muted">{dashboardCopy.teamDescription}</p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {teamPerformance.length} {isEnglish ? "people" : "osób"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowTeamResults((value) => !value)}
                  className="btn-secondary"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition ${showTeamResults ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                  {showTeamResults ? dashboardCopy.hideTeam : dashboardCopy.showTeam}
                </button>
              </div>
            </div>
            {showTeamResults ? (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="app-table min-w-[720px]">
                    <thead>
                      <tr>
                        <th className="px-3 py-3">{dashboardCopy.salesperson}</th>
                        <th className="px-3 py-3">{dashboardCopy.leads}</th>
                        <th className="px-3 py-3">{dashboardCopy.meetings}</th>
                        <th className="px-3 py-3">{dashboardCopy.contracts}</th>
                        <th className="px-3 py-3">{dashboardCopy.overdueCallbacks}</th>
                        <th className="px-3 py-3">{dashboardCopy.noAction}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamPerformance.map((row) => (
                        <tr key={row.person.id}>
                          <td className="px-3 py-3 font-semibold text-ink">{row.person.full_name}</td>
                          <td className="px-3 py-3 text-muted">{row.leads}</td>
                          <td className="px-3 py-3 text-muted">{row.meetings}</td>
                          <td className="px-3 py-3 font-semibold text-leaf">{row.contracts}</td>
                          <td className="px-3 py-3 text-danger">{row.overdueCallbacks}</td>
                          <td className="px-3 py-3 text-warn">{row.noNextAction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 md:hidden">
                  {teamPerformance.map((row) => (
                    <article key={row.person.id} className="rounded-lg border border-line bg-[#f8fafc] p-4">
                      <div className="font-black text-ink">{row.person.full_name}</div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md bg-white p-3">
                          <div className="text-xs font-bold text-muted">{dashboardCopy.leads}</div>
                          <div className="mt-1 font-black text-ink">{row.leads}</div>
                        </div>
                        <div className="rounded-md bg-white p-3">
                          <div className="text-xs font-bold text-muted">{dashboardCopy.contracts}</div>
                          <div className="mt-1 font-black text-leaf">{row.contracts}</div>
                        </div>
                        <div className="rounded-md bg-white p-3">
                          <div className="text-xs font-bold text-muted">{dashboardCopy.meetings}</div>
                          <div className="mt-1 font-black text-ink">{row.meetings}</div>
                        </div>
                        <div className="rounded-md bg-white p-3">
                          <div className="text-xs font-bold text-muted">{dashboardCopy.noAction}</div>
                          <div className="mt-1 font-black text-warn">{row.noNextAction}</div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="app-card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-ink">Filtry i sortowanie</h2>
              <p className="mt-1 text-sm text-muted">
                {isEnglish ? "Active filters" : "Aktywne filtry"}: {activeFilterCount}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((value) => !value)}
                className="btn-primary"
              >
                <ChevronDown
                  className={`h-4 w-4 transition ${showFilters ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
                {showFilters ? "Ukryj filtry" : "Pokaż filtry"}
              </button>
              <button
                type="button"
                onClick={() => setFilters({ ...initialFilters, assignedTo: "__unassigned" })}
                className="btn-secondary"
              >
                Baza leadów
              </button>
              <button
                type="button"
                onClick={() => setFilters({ ...initialFilters, assignedTo: "__returned" })}
                className="btn-secondary"
              >
                Zwrócone
              </button>
              <button
                type="button"
                onClick={() => setFilters(initialFilters)}
                className="btn-secondary"
              >
                Wyczyść
              </button>
            </div>
          </div>

          {showFilters ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="label">Dodane od</span>
              <input
                className="field"
                type="date"
                value={filters.createdFrom}
                onChange={(event) => updateFilter("createdFrom", event.target.value)}
              />
            </label>
            <label>
              <span className="label">Dodane do</span>
              <input
                className="field"
                type="date"
                value={filters.createdTo}
                onChange={(event) => updateFilter("createdTo", event.target.value)}
              />
            </label>
            <label>
              <span className="label">Modyfikacja od</span>
              <input
                className="field"
                type="date"
                value={filters.updatedFrom}
                onChange={(event) => updateFilter("updatedFrom", event.target.value)}
              />
            </label>
            <label>
              <span className="label">Modyfikacja do</span>
              <input
                className="field"
                type="date"
                value={filters.updatedTo}
                onChange={(event) => updateFilter("updatedTo", event.target.value)}
              />
            </label>
            <label>
              <span className="label">Otwarcie od</span>
              <input
                className="field"
                type="date"
                value={filters.openedFrom}
                onChange={(event) => updateFilter("openedFrom", event.target.value)}
              />
            </label>
            <label>
              <span className="label">Otwarcie do</span>
              <input
                className="field"
                type="date"
                value={filters.openedTo}
                onChange={(event) => updateFilter("openedTo", event.target.value)}
              />
            </label>
            <label>
              <span className="label">Kod pocztowy</span>
              <input
                className="field"
                value={filters.postalCode}
                onChange={(event) => updateFilter("postalCode", event.target.value)}
                placeholder="np. 30-001"
              />
            </label>
            <RegionFields
              className="md:col-span-2"
              voivodeship={filters.voivodeship}
              county={filters.county}
              onVoivodeshipChange={(value) => updateFilter("voivodeship", value)}
              onCountyChange={(value) => updateFilter("county", value)}
            />
            <label>
              <span className="label">Status</span>
              <select
                className="field"
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
              >
                <option value="">Wszystkie</option>
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Handlowiec</span>
              <select
                className="field"
                value={filters.assignedTo}
                onChange={(event) => updateFilter("assignedTo", event.target.value)}
              >
                <option value="">Wszyscy</option>
                <option value="__unassigned">Nieprzypisane</option>
                <option value="__returned">Zwrócone</option>
                {salespeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Sortowanie</span>
              <select
                className="field"
                value={`${sort.column}:${sort.direction}`}
                onChange={(event) => {
                  const [column, direction] = event.target.value.split(":");
                  setSort({ column: column as SortOption["column"], direction: direction as "asc" | "desc" });
                }}
              >
                {sortOptions.map((option) => (
                  <option
                    key={`${option.column}:${option.direction}`}
                    value={`${option.column}:${option.direction}`}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          ) : null}
        </section>

        {canAssignLeads ? (
        <section className="app-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-ink">Masowe przypisanie</h2>
              <p className="mt-1 text-sm text-muted">
                {isEnglish ? "Selected leads" : "Zaznaczone leady"}: {selectedCount}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[260px_auto]">
              <select
                className="field"
                value={selectedSalesperson}
                onChange={(event) => setSelectedSalesperson(event.target.value)}
              >
                <option value="">Wybierz handlowca</option>
                {salespeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={assignSelected}
                disabled={busy || !selectedSalesperson || selectedIds.length === 0}
                className="btn-primary"
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                Przypisz
              </button>
            </div>
          </div>
        </section>
        ) : null}

        {error ? (
          <Alert tone="danger">{error}</Alert>
        ) : null}

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">Leady</h2>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Search className="h-4 w-4" aria-hidden="true" />
              {busy ? (isEnglish ? "Refreshing" : "Odświeżanie") : `${leads.length} ${isEnglish ? "records" : "rekordów"}`}
            </div>
          </div>
          <LeadTable
            leads={leads}
            selectable={canAssignLeads}
            selectedIds={selectedIds}
            onToggle={toggleLead}
            onToggleAll={toggleAllVisible}
            showAssignee
          />
        </section>
      </div>
    </AppShell>
  );
}
