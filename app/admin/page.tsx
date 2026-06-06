"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  ChevronDown,
  Database,
  FileDown,
  FileSignature,
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
import { PaginationControls } from "@/components/pagination-controls";
import { RegionFields } from "@/components/region-fields";
import { StatTile } from "@/components/stat-tile";
import { Alert, PageHeader } from "@/components/ui";
import { endOfDay, escapeCsv, needsNextAction, startOfDay } from "@/lib/admin-leads";
import { LEAD_STATUSES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { ROLE_LABELS, canManageLeads, isManagerRole, normalizeRole } from "@/lib/roles";
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

const DEFAULT_LEAD_PAGE_SIZE = 15;
const LEAD_PAGE_SIZE_OPTIONS = [15, 30, 60];

type AdminStatCount =
  | "all"
  | "unassigned"
  | "assigned"
  | "callbacks"
  | "meetings"
  | "contracts"
  | "resignations"
  | "noNextAction";

const sortOptions: Array<SortOption & { label: string }> = [
  { label: "Data dodania: najnowsze", column: "created_at", direction: "desc" },
  { label: "Data dodania: najstarsze", column: "created_at", direction: "asc" },
  { label: "Modyfikacja: najnowsza", column: "updated_at", direction: "desc" },
  { label: "Ostatnie otwarcie", column: "last_opened_at", direction: "desc" },
  { label: "Imię i nazwisko", column: "full_name", direction: "asc" },
  { label: "Kod pocztowy", column: "postal_code", direction: "asc" },
  { label: "Status", column: "status", direction: "asc" }
];

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

export default function AdminDashboardPage() {
  const { loading, profile } = useAuth(["owner", "admin", "kierownik", "finance", "viewer"]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assignees, setAssignees] = useState<Profile[]>([]);
  const [filters, setFilters] = useState<AdminLeadFilters>(initialFilters);
  const debouncedFilters = useDebouncedValue(filters);
  const [sort, setSort] = useState<SortOption>(sortOptions[0]);
  const [leadPage, setLeadPage] = useState(1);
  const [leadPageSize, setLeadPageSize] = useState(DEFAULT_LEAD_PAGE_SIZE);
  const [totalLeads, setTotalLeads] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showTeamResults, setShowTeamResults] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
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
  const canAssignLeads = canManageLeads(profile?.role);
  const canExportCurrentView = hasPermission(profile?.role, "data:export");

  async function loadAssignees() {
    if (!profile) return;

    let query = supabase
      .from("profiles")
      .select("*")
      .in("role", ["handlowiec", "sales", "kierownik", "manager"])
      .eq("crm_environment", profile.crm_environment)
      .order("full_name", { ascending: true });

    if (isManager && profile) query = query.or(`manager_id.eq.${profile.id},id.eq.${profile.id}`);

    const { data } = await query;

    setAssignees((data || []) as Profile[]);
  }

  function applyManagerScope<T extends { or: (filters: string) => T }>(query: T) {
    if (!isManager) return query;

    const ownerIds = Array.from(new Set([profile?.id, ...assignees.map((person) => person.id)].filter(Boolean)));

    if (ownerIds.length === 0) {
      return query.or("assigned_to.is.null");
    }

    return query.or(`assigned_to.in.(${ownerIds.join(",")}),assigned_to.is.null`);
  }

  async function countLeads(kind: AdminStatCount = "all") {
    if (!profile) return 0;

    let query = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("crm_environment", profile.crm_environment);

    query = applyManagerScope(query);

    if (kind === "unassigned") {
      query = query.is("assigned_to", null).neq("status", "Zwrot");
    } else if (kind === "assigned") {
      query = query.not("assigned_to", "is", null);
    } else if (kind === "callbacks") {
      query = query.eq("status", "Call back");
    } else if (kind === "meetings") {
      query = query.or("status.eq.Spotkanie,meeting_at.not.is.null");
    } else if (kind === "contracts") {
      query = query.eq("status", "Umowa");
    } else if (kind === "resignations") {
      query = query.eq("status", "Rezygnacja");
    } else if (kind === "noNextAction") {
      query = query
        .not("status", "in", "(Umowa,Rezygnacja,Zwrot)")
        .is("callback_at", null)
        .is("meeting_at", null);
    }

    const { data, error: countError, count } = await query;

    if (countError) {
      throw new Error(countError.message);
    }

    return typeof count === "number" ? count : Array.isArray(data) ? data.length : 0;
  }

  async function loadStats() {
    if (!profile) return;

    try {
      const [
        all,
        unassigned,
        assigned,
        callbacks,
        meetings,
        contracts,
        resignations,
        noNextAction
      ] = await Promise.all([
        countLeads(),
        countLeads("unassigned"),
        countLeads("assigned"),
        countLeads("callbacks"),
        countLeads("meetings"),
        countLeads("contracts"),
        countLeads("resignations"),
        countLeads("noNextAction")
      ]);

      setStats({
        all,
        unassigned,
        assigned,
        callbacks,
        meetings,
        contracts,
        resignations,
        noNextAction
      });
    } catch (statsError) {
      setError(statsError instanceof Error ? statsError.message : "Nie udało się pobrać statystyk.");
    }
  }

  async function loadLeads() {
    if (!profile) return;

    setBusy(true);
    setError("");

    const from = (leadPage - 1) * leadPageSize;
    const to = from + leadPageSize - 1;

    let query = supabase
      .from("leads")
      .select(
        "*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)",
        { count: "exact" }
      )
      .eq("crm_environment", profile.crm_environment)
      .order(sort.column, { ascending: sort.direction === "asc", nullsFirst: false });

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
      query = applyManagerScope(query);
    }

    if (debouncedFilters.assignedTo === "__unassigned") {
      query = query.is("assigned_to", null).neq("status", "Zwrot");
    } else if (debouncedFilters.assignedTo === "__returned") {
      query = query.eq("status", "Zwrot");
      if (isManager) query = applyManagerScope(query);
    } else if (debouncedFilters.assignedTo) {
      query = query.eq("assigned_to", debouncedFilters.assignedTo);
    }

    const { data, error: leadsError, count } = await query.range(from, to);

    if (leadsError) {
      setError(leadsError.message);
      setBusy(false);
      return;
    }

    const page = (data || []) as Lead[];
    const nextTotal =
      typeof count === "number"
        ? count
        : from + page.length + (page.length === leadPageSize ? 1 : 0);

    if (nextTotal > 0 && from >= nextTotal && leadPage > 1) {
      setLeadPage(Math.max(1, Math.ceil(nextTotal / leadPageSize)));
      setBusy(false);
      return;
    }

    setTotalLeads(nextTotal);
    setLeads(page);
    setSelectedIds([]);
    setBusy(false);
  }

  useEffect(() => {
    if (!profile) return;
    loadAssignees();
  }, [profile?.id, profile?.crm_environment]);

  useEffect(() => {
    setLeadPage(1);
  }, [debouncedFilters, sort, leadPageSize, profile?.id, profile?.crm_environment]);

  useEffect(() => {
    if (!profile) return;
    loadStats();
  }, [profile?.id, profile?.crm_environment, assignees]);

  useEffect(() => {
    if (!profile) return;
    loadLeads();
  }, [debouncedFilters, profile?.id, profile?.crm_environment, sort, assignees, leadPage, leadPageSize]);

  const selectedCount = selectedIds.length;

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  const teamPerformance = useMemo(
    () =>
      assignees
        .map((person) => {
          const assigned = leads.filter((lead) => lead.assigned_to === person.id);
          return {
            person,
            leads: assigned.length,
            meetings: assigned.filter((lead) => lead.status === "Spotkanie" || lead.meeting_at).length,
            contracts: assigned.filter((lead) => lead.status === "Umowa").length,
            overdueCallbacks: assigned.filter(
              (lead) =>
                lead.status === "Call back" &&
                lead.callback_at &&
                new Date(lead.callback_at).getTime() < Date.now()
            ).length,
            noNextAction: assigned.filter(needsNextAction).length
          };
        })
        .sort((a, b) => b.contracts - a.contracts || b.meetings - a.meetings || b.leads - a.leads),
    [leads, assignees]
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
      "Opiekun",
      "Oddzwonienie",
      "Spotkanie",
      "Źródło",
      "Data dodania",
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

  function assigneeLabel(person: Profile) {
    return `${person.full_name} · ${ROLE_LABELS[normalizeRole(person.role)]}`;
  }

  async function assignSelected() {
    if (!profile || !selectedAssignee || selectedIds.length === 0) return;

    setBusy(true);
    setError("");

    const { error: assignError } = await supabase
      .from("leads")
      .update({
        assigned_to: selectedAssignee,
        status: "Przypisany"
      })
      .eq("crm_environment", profile.crm_environment)
      .in("id", selectedIds);

    if (assignError) {
      setError(assignError.message);
    } else {
      setSelectedIds([]);
      setSelectedAssignee("");
      await Promise.all([loadStats(), loadLeads()]);
    }

    setBusy(false);
  }

  if (loading || !profile) return <LoadingScreen />;

  const dashboardCopy = {
        managerDescription: "Leady zespołu, baza do rozdania i aktualne statusy.",
        adminDescription: "Leady, przypisania, statusy i wyniki opiekunów.",
        exportCsv: "Eksport CSV",
        refresh: "Odśwież",
        stats: {
          all: "Wszystkie",
          unassigned: "Nieprzypisane",
          assigned: "Przypisane",
          callbacks: "Oddzwonienia",
          meetings: "Spotkania",
          contracts: "Umowy",
          resignations: "Rezygnacje",
          noNextAction: "Bez akcji"
        },
        teamTitle: "Wyniki zespołu",
        teamDescription: `${teamPerformance.length} opiekunów w aktualnej stronie widoku. Szczegóły są schowane, żeby dashboard został zwarty.`,
        showTeam: "Pokaż wyniki",
        hideTeam: "Ukryj wyniki",
        salesperson: "Opiekun",
        leads: "Leady",
        meetings: "Spotkania",
        contracts: "Umowy",
        overdueCallbacks: "Zaległe oddzwonienia",
        noAction: "Bez akcji"
      };

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div data-tour-id="tour-dashboard">
          <PageHeader
            title={`Panel ${
              profile.role === "kierownik"
                ? "kierownika"
                : profile.role === "finance"
                  ? "finansowy"
                  : profile.role === "viewer"
                    ? "podglądu"
                    : "sprzedaży"
            }`}
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
                      {teamPerformance.length} osób
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
                Aktywne filtry: {activeFilterCount}
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
              <span className="label">Data dodania od</span>
              <input
                className="field"
                type="date"
                value={filters.createdFrom}
                onChange={(event) => updateFilter("createdFrom", event.target.value)}
              />
            </label>
            <label>
              <span className="label">Data dodania do</span>
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
              <span className="label">Opiekun</span>
              <select
                className="field"
                value={filters.assignedTo}
                onChange={(event) => updateFilter("assignedTo", event.target.value)}
              >
                <option value="">Wszyscy opiekunowie</option>
                <option value="__unassigned">Nieprzypisane</option>
                <option value="__returned">Zwrócone</option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {assigneeLabel(person)}
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
                Zaznaczone leady: {selectedCount}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[260px_auto]">
              <select
                className="field"
                value={selectedAssignee}
                onChange={(event) => setSelectedAssignee(event.target.value)}
              >
                <option value="">Wybierz opiekuna</option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {assigneeLabel(person)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={assignSelected}
                disabled={busy || !selectedAssignee || selectedIds.length === 0}
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
              {busy ? "Odświeżanie" : `${totalLeads} rekordów`}
            </div>
          </div>
          <PaginationControls
            page={leadPage}
            pageSize={leadPageSize}
            pageSizeOptions={LEAD_PAGE_SIZE_OPTIONS}
            totalItems={totalLeads}
            loadedItems={leads.length}
            busy={busy}
            onPageChange={setLeadPage}
            onPageSizeChange={setLeadPageSize}
          />
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
