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
import {
  ASSIGNMENT_BATCH_SIZES,
  endOfDay,
  escapeCsv,
  needsNextAction,
  postgrestInValues,
  startOfDay,
  voivodeshipFilterTerms
} from "@/lib/admin-leads";
import { LEAD_STATUSES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { canManageLeads, isManagerRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { AdminLeadFilters, Lead, LeadStatus, Profile, SortOption } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

const initialFilters: AdminLeadFilters = {
  search: "",
  createdFrom: "",
  createdTo: "",
  postalCode: "",
  voivodeship: "",
  county: "",
  status: [],
  assignedTo: "__unassigned"
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
  const { loading, profile, session } = useAuth(["owner", "admin", "menadzer", "finance", "viewer"]);
  const { language } = useLanguage();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeadCount, setTotalLeadCount] = useState(0);
  const [loadedLeadCount, setLoadedLeadCount] = useState(0);
  const [salespeople, setSalespeople] = useState<Profile[]>([]);
  const [salespeopleLoaded, setSalespeopleLoaded] = useState(false);
  const [filters, setFilters] = useState<AdminLeadFilters>(initialFilters);
  const [sort, setSort] = useState<SortOption>(sortOptions[0]);
  const [showFilters, setShowFilters] = useState(false);
  const [showTeamResults, setShowTeamResults] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState("");
  const [assignmentBatchSize, setAssignmentBatchSize] = useState<number>(25);
  const [leadBucket, setLeadBucket] = useState<"all" | "active" | "resignations" | "contracts">("active");
  const [busy, setBusy] = useState(true);
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

    const query = supabase
      .from("profiles")
      .select("*")
      .in("role", ["handlowiec", "sales", "menadzer"])
      .eq("crm_environment", crmEnvironment)
      .order("full_name", { ascending: true });

    const { data } = await query;
    const assignablePeople =
      isManager && profileId
        ? ((data || []) as Profile[]).filter((person) => person.id === profileId || person.manager_id === profileId)
        : ((data || []) as Profile[]);
    const peopleWithManager =
      isManager && profile && !assignablePeople.some((person) => person.id === profile.id)
        ? [...assignablePeople, profile].sort((a, b) => a.full_name.localeCompare(b.full_name, "pl"))
        : assignablePeople;

    setSalespeople(peopleWithManager);
    setSalespeopleLoaded(true);
  }, [crmEnvironment, isManager, profile, profileId]);

  const loadStats = useCallback(async () => {
    if (!crmEnvironment) return;

    const statRows: Pick<Lead, "id" | "status" | "assigned_to" | "meeting_at" | "callback_at">[] = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
      let query = supabase
        .from("leads")
        .select("id,status,assigned_to,meeting_at,callback_at")
        .eq("crm_environment", crmEnvironment)
        .range(from, from + pageSize - 1);

      if (isManager) {
        query = query.or(salespersonScopeKey ? `assigned_to.in.(${salespersonScopeKey}),assigned_to.is.null` : "assigned_to.is.null");
      }

      const { data, error: statsError } = await query;

      if (statsError) {
        setError(statsError.message);
        break;
      }

      statRows.push(...((data || []) as Pick<Lead, "id" | "status" | "assigned_to" | "meeting_at" | "callback_at">[]));

      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

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

    for (const lead of statRows) {
      nextStats.all += 1;
      if (!lead.assigned_to) nextStats.unassigned += 1;
      if (lead.assigned_to) nextStats.assigned += 1;
      if (lead.status === "Call back") nextStats.callbacks += 1;
      if (lead.status === "Spotkanie") nextStats.meetings += 1;
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
    setTotalLeadCount(0);
    setLoadedLeadCount(0);

    // Supabase projects commonly cap a single response at 1000 rows. Use
    // smaller pages and the exact filtered count so that the UI never treats
    // that API limit as the actual number of leads.
    const pageSize = 500;
    const allLeads: Lead[] = [];
    let from = 0;
    let expectedCount: number | null = null;

    while (true) {
      let query = supabase
        .from("leads")
        .select(
          "*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)",
          { count: "exact" }
        )
        .eq("crm_environment", crmEnvironment)
        .order(sort.column, { ascending: sort.direction === "asc", nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (debouncedFilters.search.trim()) {
        const search = debouncedFilters.search.trim().replace(/[,%]/g, " ");
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,address.ilike.%${search}%,meeting_address.ilike.%${search}%`);
      }
      if (debouncedFilters.createdFrom) query = query.gte("created_at", startOfDay(debouncedFilters.createdFrom));
      if (debouncedFilters.createdTo) query = query.lte("created_at", endOfDay(debouncedFilters.createdTo));
      if (debouncedFilters.postalCode) query = query.ilike("postal_code", `%${debouncedFilters.postalCode}%`);
      if (debouncedFilters.voivodeship) query = query.or(voivodeshipFilterTerms(debouncedFilters.voivodeship));
      if (debouncedFilters.county) query = query.ilike("county", `%${debouncedFilters.county}%`);
      if (debouncedFilters.status.length) query = query.in("status", debouncedFilters.status);
      else {
        if (leadBucket === "active") query = query.not("status", "in", postgrestInValues(["Umowa", "Rezygnacja"]));
        if (leadBucket === "contracts") query = query.eq("status", "Umowa");
        if (leadBucket === "resignations") query = query.eq("status", "Rezygnacja");
      }

      if (isManager && !debouncedFilters.assignedTo) {
        query = query.or(salespersonScopeKey ? `assigned_to.in.(${salespersonScopeKey}),assigned_to.is.null` : "assigned_to.is.null");
      }

      if (debouncedFilters.assignedTo === "__unassigned") {
        query = query.is("assigned_to", null);
      } else if (debouncedFilters.assignedTo) {
        query = query.eq("assigned_to", debouncedFilters.assignedTo);
      }

      const { data, error: leadsError, count } = await query;

      if (leadsError) {
        setError(leadsError.message);
        setBusy(false);
        return;
      }

      const page = (data || []) as Lead[];
      if (expectedCount === null && count !== null) {
        expectedCount = count;
        setTotalLeadCount(expectedCount);
      }
      allLeads.push(...page);
      setLoadedLeadCount(allLeads.length);
      // Renderuj pierwszą paczkę natychmiast, a pozostałe rekordy dobieraj w tle.
      // Dzięki temu panel jest użyteczny po pierwszym zapytaniu zamiast czekać na całą bazę.
      setLeads([...allLeads]);
      if (from === 0) setBusy(false);

      if ((expectedCount !== null && allLeads.length >= expectedCount) || page.length < pageSize) break;
      from = allLeads.length;
    }

    setLeads(allLeads);
    setTotalLeadCount(expectedCount ?? allLeads.length);
    setSelectedIds([]);

    setBusy(false);
  }, [crmEnvironment, debouncedFilters, isManager, leadBucket, salespersonScopeKey, sort]);

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
  const assignmentCandidateCount = leads.filter(
    (lead) => !lead.assigned_to
  ).length;

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)).length,
    [filters]
  );

  const teamPerformance = useMemo(
    () => {
      const now = Date.now();
      const totals = new Map(
        salespeople.map((person) => [
          person.id,
          {
            leadKeys: new Set<string>(),
            meetingKeys: new Set<string>(),
            contractKeys: new Set<string>(),
            overdueCallbackKeys: new Set<string>(),
            noNextActionKeys: new Set<string>()
          }
        ])
      );

      for (const lead of leads) {
        if (!lead.assigned_to) continue;
        const row = totals.get(lead.assigned_to);
        if (!row) continue;
        const phoneKey = lead.phone.replace(/\D/g, "").slice(-9) || lead.id;

        row.leadKeys.add(phoneKey);
        if (lead.status === "Spotkanie") row.meetingKeys.add(phoneKey);
        if (lead.status === "Umowa") row.contractKeys.add(phoneKey);
        if (lead.status === "Call back" && lead.callback_at && new Date(lead.callback_at).getTime() < now) {
          row.overdueCallbackKeys.add(phoneKey);
        }
        if (needsNextAction(lead)) row.noNextActionKeys.add(phoneKey);
      }

      return salespeople
        .map((person) => {
          const row = totals.get(person.id)!;
          return {
            person,
            leads: row.leadKeys.size,
            meetings: row.meetingKeys.size,
            contracts: row.contractKeys.size,
            overdueCallbacks: row.overdueCallbackKeys.size,
            noNextAction: row.noNextActionKeys.size
          };
        })
        .sort((a, b) => b.contracts - a.contracts || b.meetings - a.meetings || b.leads - a.leads);
    },
    [leads, salespeople]
  );

  function updateFilter(key: keyof AdminLeadFilters, value: string | LeadStatus[]) {
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

  async function assignSelected(takeBack = false) {
    if (!profile || !session?.access_token || (!takeBack && !selectedSalesperson)) return;

    const leadIds = takeBack
      ? selectedIds
      : selectedIds.length > 0
      ? selectedIds
      : leads.filter((lead) => !lead.assigned_to).slice(0, assignmentBatchSize).map((lead) => lead.id);
    if (leadIds.length === 0) return;

    setBusy(true);
    setError("");

    const response = await fetch("/api/leads/assign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        leadIds,
        assignedTo: takeBack ? null : selectedSalesperson
      })
    });

    const result = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(result.error || (takeBack ? "Nie udało się odebrać leadów." : "Nie udało się przypisać leadów."));
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
                onClick={() => { setLeadBucket("active"); setFilters({ ...initialFilters, assignedTo: "__unassigned" }); }}
                className="btn-secondary"
              >
                Baza leadów
              </button>
              <button
                type="button"
                onClick={() => { setLeadBucket("active"); setFilters({ ...initialFilters, assignedTo: "" }); }}
                className={leadBucket === "active" ? "btn-primary" : "btn-secondary"}
              >
                Bieżąca praca
              </button>
              <button
                type="button"
                onClick={() => { setLeadBucket("resignations"); setFilters({ ...initialFilters, assignedTo: "" }); }}
                className={leadBucket === "resignations" ? "btn-primary" : "btn-secondary"}
              >
                Rezygnacje ({stats.resignations})
              </button>
              <button
                type="button"
                onClick={() => { setLeadBucket("contracts"); setFilters({ ...initialFilters, assignedTo: "" }); }}
                className={leadBucket === "contracts" ? "btn-primary" : "btn-secondary"}
              >
                Umowy ({stats.contracts})
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeadBucket("all");
                  setFilters({ ...initialFilters, assignedTo: "" });
                }}
                className="btn-secondary"
              >
                Wyczyść
              </button>
            </div>
          </div>

          {showFilters ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="md:col-span-2 xl:col-span-4">
              <span className="label">Szukaj klienta</span>
              <input
                className="field"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Imię i nazwisko, telefon albo adres"
              />
            </label>
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
            <fieldset className="rounded-lg border border-line p-3 md:col-span-2">
              <legend className="label px-1">Statusy ({filters.status.length || "wszystkie"})</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LEAD_STATUSES.map((status) => <label key={status} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.status.includes(status)} onChange={() => updateFilter("status", filters.status.includes(status) ? filters.status.filter(item => item !== status) : [...filters.status,status])}/>{status}</label>)}
              </div>
              <div className="mt-3 flex gap-2"><button type="button" className="btn-secondary" onClick={()=>updateFilter("status",[...LEAD_STATUSES])}>Zaznacz wszystkie</button><button type="button" className="btn-secondary" onClick={()=>updateFilter("status",[])}>Wyczyść</button></div>
            </fieldset>
            <label>
              <span className="label">Handlowiec</span>
              <select
                className="field"
                value={filters.assignedTo}
                onChange={(event) => updateFilter("assignedTo", event.target.value)}
              >
                <option value="">Wszyscy</option>
                <option value="__unassigned">Nieprzypisane</option>
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
            <div className="grid gap-2 sm:grid-cols-[minmax(200px,260px)_130px_auto_auto]">
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
              <select
                className="field"
                value={assignmentBatchSize}
                onChange={(event) => setAssignmentBatchSize(Number(event.target.value))}
                aria-label="Liczba leadów do przypisania"
              >
                {ASSIGNMENT_BATCH_SIZES.map((size) => (
                  <option key={size} value={size}>{size} leadów</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => assignSelected(false)}
                disabled={busy || !selectedSalesperson || (selectedIds.length === 0 && assignmentCandidateCount === 0)}
                className="btn-primary"
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                {selectedIds.length > 0 ? `Przypisz (${selectedIds.length})` : `Przypisz ${Math.min(assignmentBatchSize, assignmentCandidateCount)}`}
              </button>
              <button
                type="button"
                onClick={() => assignSelected(true)}
                disabled={busy || selectedIds.length === 0}
                className="btn-secondary border-danger/30 text-danger hover:border-danger"
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                Zabierz handlowcowi
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
              {busy
                ? `${isEnglish ? "Refreshing" : "Odświeżanie"}: ${loadedLeadCount}${totalLeadCount ? ` / ${totalLeadCount}` : ""}`
                : `${totalLeadCount} ${isEnglish ? "records" : "rekordów"}`}
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
