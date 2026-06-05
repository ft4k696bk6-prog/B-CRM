"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  ListChecks,
  PhoneCall,
  RefreshCw,
  Target
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LeadTable } from "@/components/lead-table";
import { LoadingScreen } from "@/components/loading-screen";
import { PaginationControls } from "@/components/pagination-controls";
import { StatTile } from "@/components/stat-tile";
import { Alert, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { LEAD_STATUSES } from "@/lib/constants";
import { formatDateTime, isPast, isToday } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import type { Lead, LeadStatus, SortOption } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

const DEFAULT_LEAD_PAGE_SIZE = 15;
const LEAD_PAGE_SIZE_OPTIONS = [15, 30, 60];
type SalesStatCount =
  | "visible"
  | "upcomingCallbacks"
  | "todayMeetings"
  | "overdueCallbacks"
  | "noNextAction";

const sortOptions: Array<SortOption & { label: string }> = [
  { label: "Data dodania: najnowsze", column: "created_at", direction: "desc" },
  { label: "Data dodania: najstarsze", column: "created_at", direction: "asc" }
];

function needsNextAction(lead: Pick<Lead, "status" | "callback_at" | "meeting_at">) {
  if (["Umowa", "Rezygnacja", "Zwrot"].includes(lead.status)) return false;
  return !lead.callback_at && !lead.meeting_at;
}

export default function SalesDashboardPage() {
  const { loading, profile } = useAuth("handlowiec");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [leadPage, setLeadPage] = useState(1);
  const [leadPageSize, setLeadPageSize] = useState(DEFAULT_LEAD_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [sort, setSort] = useState<SortOption>(sortOptions[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    visible: 0,
    upcomingCallbacks: 0,
    todayMeetings: 0,
    overdueCallbacks: 0,
    noNextAction: 0
  });

  function applyLeadScope<T extends { eq: (column: string, value: string) => T; or: (filters: string) => T }>(query: T) {
    if (!profile) return query;

    if (profile.can_view_lead_pool) {
      return query.or(`assigned_to.eq.${profile.id},assigned_to.is.null`);
    }

    return query.eq("assigned_to", profile.id);
  }

  async function countLeads(kind: SalesStatCount = "visible") {
    if (!profile) return 0;

    let query = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("crm_environment", profile.crm_environment);

    query = applyLeadScope(query);
    if (statusFilter) query = query.eq("status", statusFilter);

    if (kind === "upcomingCallbacks") {
      query = query.eq("status", "Call back").gte("callback_at", new Date().toISOString());
    } else if (kind === "todayMeetings") {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();
      query = query.gte("meeting_at", todayStart).lte("meeting_at", todayEnd);
    } else if (kind === "overdueCallbacks") {
      query = query.eq("status", "Call back").lt("callback_at", new Date().toISOString());
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
      const [visible, upcomingCallbacks, todayMeetings, overdueCallbacks, noNextAction] = await Promise.all([
        countLeads(),
        countLeads("upcomingCallbacks"),
        countLeads("todayMeetings"),
        countLeads("overdueCallbacks"),
        countLeads("noNextAction")
      ]);

      setStats({
        visible,
        upcomingCallbacks,
        todayMeetings,
        overdueCallbacks,
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
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)", {
        count: "exact"
      })
      .eq("crm_environment", profile.crm_environment)
      .order(sort.column, { ascending: sort.direction === "asc", nullsFirst: false });

    query = applyLeadScope(query);

    if (statusFilter) query = query.eq("status", statusFilter);

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
    setBusy(false);
  }

  useEffect(() => {
    setLeadPage(1);
  }, [profile?.id, profile?.crm_environment, statusFilter, sort, leadPageSize]);

  useEffect(() => {
    if (!profile) return;
    loadStats();
  }, [profile?.id, profile?.crm_environment, statusFilter]);

  useEffect(() => {
    if (!profile) return;
    loadLeads();
  }, [profile?.id, profile?.crm_environment, statusFilter, sort, leadPage, leadPageSize]);

  useEffect(() => {
    function refreshLeads() {
      loadStats();
      loadLeads();
    }

    window.addEventListener("leads:changed", refreshLeads);
    return () => window.removeEventListener("leads:changed", refreshLeads);
  }, [profile?.id, profile?.crm_environment, statusFilter, sort, leadPage, leadPageSize]);

  const overdueCallbacks = useMemo(
    () =>
      leads.filter(
        (lead) => lead.status === "Call back" && lead.callback_at && isPast(lead.callback_at)
      ),
    [leads]
  );

  const todayMeetings = useMemo(
    () => leads.filter((lead) => lead.meeting_at && isToday(lead.meeting_at)),
    [leads]
  );

  const leadsWithoutNextAction = useMemo(
    () => leads.filter(needsNextAction),
    [leads]
  );

  const workQueue = useMemo(
    () => [
      ...overdueCallbacks.map((lead) => ({ lead, reason: "Zaległe oddzwonienie" })),
      ...todayMeetings.map((lead) => ({ lead, reason: "Spotkanie dzisiaj" })),
      ...leadsWithoutNextAction.map((lead) => ({ lead, reason: "Brak następnej akcji" }))
    ].slice(0, 8),
    [leadsWithoutNextAction, overdueCallbacks, todayMeetings]
  );

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title="Panel handlowca"
          description="Twoje leady, oddzwonienia i spotkania."
          actions={
            <button type="button" onClick={loadLeads} className="btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Odśwież
            </button>
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile
            label={profile.can_view_lead_pool ? "Moje i z puli" : "Moje leady"}
            value={stats.visible}
            icon={ClipboardList}
            tone="sky"
          />
          <StatTile
            label="Oddzwonienia"
            value={stats.upcomingCallbacks}
            icon={PhoneCall}
            tone="warn"
          />
          <StatTile
            label="Dzisiejsze spotkania"
            value={stats.todayMeetings}
            icon={CalendarDays}
            tone="leaf"
          />
          <StatTile
            label="Zaległe oddzwonienia"
            value={stats.overdueCallbacks}
            icon={AlertTriangle}
            tone="danger"
          />
          <StatTile
            label="Bez akcji"
            value={stats.noNextAction}
            icon={ListChecks}
            tone="warn"
          />
        </section>

        <section className="app-card">
          <SectionHeader
            icon={Target}
            title="Co zrobić teraz"
            description="Najpilniejsze leady do obsłużenia."
            tone="sky"
            className="mb-3"
          />
          <div className="grid gap-2">
            {workQueue.map(({ lead, reason }) => (
              <Link
                key={`${reason}-${lead.id}`}
                href={`/leads/${lead.id}`}
                className="flex min-h-11 flex-col gap-1 rounded-md border border-line bg-[#f9fbfd] px-3 py-2 text-sm transition hover:border-ink hover:bg-white sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-semibold text-ink">{lead.full_name}</span>
                <span className="text-muted">{reason}</span>
              </Link>
            ))}
            {workQueue.length === 0 ? (
              <EmptyState title="Brak pilnych zadań" description="Lista jest czysta dla aktualnych filtrów." />
            ) : null}
          </div>
        </section>

        {overdueCallbacks.length > 0 ? (
          <section className="rounded-lg border border-danger/20 bg-danger/10 p-4">
            <SectionHeader
              icon={AlertTriangle}
              title="Zaległe oddzwonienia"
              tone="danger"
              className="text-danger"
            />
            <div className="mt-3 grid gap-2">
              {overdueCallbacks.slice(0, 5).map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex flex-col gap-1 rounded-md border border-danger/20 bg-white px-3 py-2 text-sm transition hover:border-danger sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-semibold text-ink">{lead.full_name}</span>
                  <span className="text-danger">{formatDateTime(lead.callback_at)}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {todayMeetings.length > 0 ? (
          <section className="rounded-lg border border-leaf/20 bg-leaf/10 p-4">
            <SectionHeader icon={CalendarDays} title="Dzisiejsze spotkania" tone="leaf" />
            <div className="mt-3 grid gap-2">
              {todayMeetings.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex flex-col gap-1 rounded-md border border-leaf/20 bg-white px-3 py-2 text-sm transition hover:border-leaf sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-semibold text-ink">{lead.full_name}</span>
                  <span className="text-muted">
                    {formatDateTime(lead.meeting_at)} · {lead.meeting_address || lead.address || "brak adresu"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="app-card">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="label">Szybki filtr statusu</span>
              <select
                className="field"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "")}
              >
                <option value="">{profile.can_view_lead_pool ? "Moje i pula leadów" : "Wszystkie moje leady"}</option>
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
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
        </section>

        {error ? (
          <Alert tone="danger">
            {error}
          </Alert>
        ) : null}

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">{profile.can_view_lead_pool ? "Moje leady i pula" : "Moje leady"}</h2>
            <div className="text-sm text-muted">{busy ? "Odświeżanie" : `${totalLeads} rekordów`}</div>
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
          <LeadTable leads={leads} showAssignee={profile.can_view_lead_pool} />
        </section>
      </div>
    </AppShell>
  );
}
