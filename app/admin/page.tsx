"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export default function AdminDashboardPage() {
  const { loading, profile } = useAuth(["owner", "admin", "menadzer", "finance", "viewer"]);
  const { language } = useLanguage();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salespeople, setSalespeople] = useState<Profile[]>([]);
  const [filters, setFilters] = useState<AdminLeadFilters>(initialFilters);
  const [sort, setSort] = useState<SortOption>(sortOptions[0]);
  const [showFilters, setShowFilters] = useState(false);
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
  const canAssignLeads = canManageLeads(profile?.role);
  const canExportCurrentView = hasPermission(profile?.role, "data:export");
  const isEnglish = language === "en";

  async function loadSalespeople() {
    if (!profile) return;

    let query = supabase
      .from("profiles")
      .select("*")
      .in("role", ["handlowiec", "sales"])
      .eq("crm_environment", profile.crm_environment)
      .order("full_name", { ascending: true });

    if (isManager && profile) query = query.eq("manager_id", profile.id);

    const { data } = await query;

    setSalespeople((data || []) as Profile[]);
  }

  function applyManagerScope<T extends { in: (column: string, values: string[]) => T; or: (filters: string) => T }>(query: T) {
    if (!isManager) return query;

    const teamIds = salespeople.map((person) => person.id);

    if (teamIds.length === 0) {
      return query.or("assigned_to.is.null");
    }

    return query.or(`assigned_to.in.(${teamIds.join(",")}),assigned_to.is.null`);
  }

  async function loadStats() {
    if (!profile) return;

    let query = supabase
      .from("leads")
      .select("id,status,assigned_to,meeting_at,callback_at")
      .eq("crm_environment", profile.crm_environment);

    query = applyManagerScope(query);

    const { data } = await query;

    const rows = (data || []) as Pick<Lead, "id" | "status" | "assigned_to" | "meeting_at" | "callback_at">[];
    setStats({
      all: rows.length,
      unassigned: rows.filter((lead) => !lead.assigned_to && lead.status !== "Zwrot").length,
      assigned: rows.filter((lead) => Boolean(lead.assigned_to)).length,
      callbacks: rows.filter((lead) => lead.status === "Call back").length,
      meetings: rows.filter((lead) => lead.status === "Spotkanie" || lead.meeting_at).length,
      contracts: rows.filter((lead) => lead.status === "Umowa").length,
      resignations: rows.filter((lead) => lead.status === "Rezygnacja").length,
      noNextAction: rows.filter(needsNextAction).length
    });
  }

  async function loadLeads() {
    if (!profile) return;

    setBusy(true);
    setError("");

    let query = supabase
      .from("leads")
      .select(
        "*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)"
      )
      .eq("crm_environment", profile.crm_environment)
      .order(sort.column, { ascending: sort.direction === "asc", nullsFirst: false })
      .limit(1000);

    if (filters.createdFrom) query = query.gte("created_at", startOfDay(filters.createdFrom));
    if (filters.createdTo) query = query.lte("created_at", endOfDay(filters.createdTo));
    if (filters.updatedFrom) query = query.gte("updated_at", startOfDay(filters.updatedFrom));
    if (filters.updatedTo) query = query.lte("updated_at", endOfDay(filters.updatedTo));
    if (filters.openedFrom) query = query.gte("last_opened_at", startOfDay(filters.openedFrom));
    if (filters.openedTo) query = query.lte("last_opened_at", endOfDay(filters.openedTo));
    if (filters.postalCode) query = query.ilike("postal_code", `%${filters.postalCode}%`);
    if (filters.voivodeship) query = query.ilike("voivodeship", `%${filters.voivodeship}%`);
    if (filters.county) query = query.ilike("county", `%${filters.county}%`);
    if (filters.status) query = query.eq("status", filters.status as LeadStatus);

    if (isManager && !filters.assignedTo) {
      query = applyManagerScope(query);
    }

    if (filters.assignedTo === "__unassigned") {
      query = query.is("assigned_to", null).neq("status", "Zwrot");
    } else if (filters.assignedTo === "__returned") {
      query = query.eq("status", "Zwrot");
      if (isManager) query = applyManagerScope(query);
    } else if (filters.assignedTo) {
      query = query.eq("assigned_to", filters.assignedTo);
    }

    const { data, error: leadsError } = await query;

    if (leadsError) {
      setError(leadsError.message);
    } else {
      setLeads((data || []) as Lead[]);
      setSelectedIds([]);
    }

    setBusy(false);
  }

  useEffect(() => {
    if (!profile) return;
    loadSalespeople();
  }, [profile?.id, profile?.crm_environment]);

  useEffect(() => {
    if (!profile) return;
    loadStats();
    loadLeads();
  }, [filters, profile?.id, profile?.crm_environment, sort, salespeople]);

  const selectedCount = selectedIds.length;

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  const teamPerformance = useMemo(
    () =>
      salespeople
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

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
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
              ? "Leady zespołu, baza do rozdania i bieżące statusy."
              : "Wszystkie leady, przypisania i bieżące statusy."
          }
          actions={
            <>
            {canExportCurrentView ? (
              <button type="button" onClick={exportCurrentView} className="btn-secondary">
                <FileDown className="h-4 w-4" aria-hidden="true" />
                Eksport CSV
              </button>
            ) : null}
            <button type="button" onClick={loadLeads} className="btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Odśwież
            </button>
            </>
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Wszystkie" value={stats.all} icon={Database} tone="sky" />
          <StatTile label="Nieprzypisane" value={stats.unassigned} icon={Inbox} tone="solar" />
          <StatTile label="Przypisane" value={stats.assigned} icon={UserCheck} tone="leaf" />
          <StatTile label="Call-back" value={stats.callbacks} icon={PhoneCall} tone="warn" />
          <StatTile label="Spotkania" value={stats.meetings} icon={CalendarDays} tone="leaf" />
          <StatTile label="Umowy" value={stats.contracts} icon={FileSignature} tone="leaf" />
          <StatTile label="Rezygnacje" value={stats.resignations} icon={Ban} tone="danger" />
          <StatTile label="Bez akcji" value={stats.noNextAction} icon={ListChecks} tone="warn" />
        </section>

        <section className="app-card">
          <SectionHeader
            icon={FolderKanban}
            title="Realizacja po umowie"
            description="Dokumenty, księgowość, logistyka, montaż i generator aneksu w jednym miejscu."
            actions={<Link href="/realizacja" className="btn-primary">Otwórz realizację</Link>}
          />
        </section>

        {teamPerformance.length > 0 ? (
          <section className="app-card">
            <SectionHeader
              icon={Trophy}
              title="Wyniki zespołu"
              description="Leady, spotkania, umowy i ryzyka operacyjne."
            />
            <div className="hidden overflow-x-auto md:block">
              <table className="app-table min-w-[720px]">
                <thead>
                  <tr>
                    <th className="px-3 py-3">Handlowiec</th>
                    <th className="px-3 py-3">Leady</th>
                    <th className="px-3 py-3">Spotkania</th>
                    <th className="px-3 py-3">Umowy</th>
                    <th className="px-3 py-3">Zaległe call-backi</th>
                    <th className="px-3 py-3">Bez akcji</th>
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
                      <div className="text-xs font-bold text-muted">Leady</div>
                      <div className="mt-1 font-black text-ink">{row.leads}</div>
                    </div>
                    <div className="rounded-md bg-white p-3">
                      <div className="text-xs font-bold text-muted">Umowy</div>
                      <div className="mt-1 font-black text-leaf">{row.contracts}</div>
                    </div>
                    <div className="rounded-md bg-white p-3">
                      <div className="text-xs font-bold text-muted">Spotkania</div>
                      <div className="mt-1 font-black text-ink">{row.meetings}</div>
                    </div>
                    <div className="rounded-md bg-white p-3">
                      <div className="text-xs font-bold text-muted">Bez akcji</div>
                      <div className="mt-1 font-black text-warn">{row.noNextAction}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
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
