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
import { RegionFields } from "@/components/region-fields";
import { StatTile } from "@/components/stat-tile";
import { Alert, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { LEAD_STATUSES } from "@/lib/constants";
import { endOfDay, startOfDay } from "@/lib/admin-leads";
import { formatDateTime, isPast, isToday } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import type { Lead, LeadStatus, SortOption } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

function needsNextAction(lead: Pick<Lead, "status" | "callback_at" | "meeting_at">) {
  if (["Umowa", "Rezygnacja"].includes(lead.status)) return false;
  return !lead.callback_at && !lead.meeting_at;
}

export default function SalesDashboardPage() {
  const { loading, profile } = useAuth("handlowiec");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [search, setSearch] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [voivodeship, setVoivodeship] = useState("");
  const [county, setCounty] = useState("");
  const [sort, setSort] = useState<SortOption>({ column: "created_at", direction: "desc" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadLeads() {
    if (!profile) return;

    setBusy(true);
    setError("");

    let query = supabase
      .from("leads")
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)")
      .eq("crm_environment", profile.crm_environment)
      .eq("assigned_to", profile.id)
      .not("status", "in", '("Umowa","Rezygnacja")')
      .order(sort.column, { ascending: sort.direction === "asc", nullsFirst: false })
      .limit(1000);

    if (search.trim()) {
      const cleanSearch = search.trim().replace(/[,%]/g, " ");
      query = query.or(`full_name.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%,address.ilike.%${cleanSearch}%,meeting_address.ilike.%${cleanSearch}%`);
    }
    if (statusFilter) query = query.eq("status", statusFilter);
    if (createdFrom) query = query.gte("created_at", startOfDay(createdFrom));
    if (createdTo) query = query.lte("created_at", endOfDay(createdTo));
    if (postalCode.trim()) query = query.ilike("postal_code", `%${postalCode.trim()}%`);
    if (voivodeship) query = query.eq("voivodeship", voivodeship);
    if (county) query = query.eq("county", county);

    const { data, error: leadsError } = await query;

    if (leadsError) {
      setError(leadsError.message);
    } else {
      setLeads((data || []) as Lead[]);
    }

    setBusy(false);
  }

  useEffect(() => {
    if (!profile) return;
    loadLeads();
  }, [profile?.id, profile?.crm_environment, statusFilter, search, createdFrom, createdTo, postalCode, voivodeship, county, sort]);

  useEffect(() => {
    function refreshLeads() {
      loadLeads();
    }

    window.addEventListener("leads:changed", refreshLeads);
    return () => window.removeEventListener("leads:changed", refreshLeads);
  }, [profile?.id, profile?.crm_environment, statusFilter, search, createdFrom, createdTo, postalCode, voivodeship, county, sort]);

  const overdueCallbacks = useMemo(
    () =>
      leads.filter(
        (lead) => lead.status === "Call back" && lead.callback_at && isPast(lead.callback_at)
      ),
    [leads]
  );

  const upcomingCallbacks = useMemo(
    () =>
      leads.filter(
        (lead) => lead.status === "Call back" && lead.callback_at && !isPast(lead.callback_at)
      ),
    [leads]
  );

  const todayCallbacks = useMemo(
    () => leads.filter((lead) => lead.status === "Call back" && lead.callback_at && isToday(lead.callback_at)),
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
      ...todayCallbacks.map((lead) => ({ lead, reason: `Call-back dzisiaj · ${formatDateTime(lead.callback_at)}` })),
      ...todayMeetings.map((lead) => ({ lead, reason: `Spotkanie dzisiaj · ${formatDateTime(lead.meeting_at)}` })),
    ].sort((a, b) => {
      const aDate = a.lead.callback_at || a.lead.meeting_at || "";
      const bDate = b.lead.callback_at || b.lead.meeting_at || "";
      return aDate.localeCompare(bDate);
    }),
    [todayCallbacks, todayMeetings]
  );

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title="Panel handlowca"
          description="Leady, call-backi i spotkania."
          actions={
            <button type="button" onClick={loadLeads} className="btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Odśwież
            </button>
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Moje leady" value={leads.length} icon={ClipboardList} tone="sky" />
          <StatTile
            label="Call-back"
            value={upcomingCallbacks.length}
            icon={PhoneCall}
            tone="warn"
          />
          <StatTile
            label="Dzisiejsze spotkania"
            value={todayMeetings.length}
            icon={CalendarDays}
            tone="leaf"
          />
          <StatTile
            label="Zaległe call-backi"
            value={overdueCallbacks.length}
            icon={AlertTriangle}
            tone="danger"
          />
          <StatTile
            label="Bez akcji"
            value={leadsWithoutNextAction.length}
            icon={ListChecks}
            tone="warn"
          />
        </section>

        <section className="app-card">
          <SectionHeader
            icon={Target}
            title="Co zrobić teraz"
            description="Dzisiejsze spotkania i call-backi."
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
              <EmptyState title="Brak zadań na dziś" description="Nie masz dzisiaj zaplanowanych spotkań ani call-backów." />
            ) : null}
          </div>
        </section>

        <section className="app-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink">Filtry i sortowanie</h2>
              <p className="mt-1 text-sm text-muted">Zawęź listę swoich leadów.</p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setCreatedFrom("");
                setCreatedTo("");
                setPostalCode("");
                setVoivodeship("");
                setCounty("");
                setSort({ column: "created_at", direction: "desc" });
              }}
            >
              Wyczyść
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="md:col-span-2 xl:col-span-4">
              <span className="label">Szukaj klienta</span>
              <input
                className="field"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Imię i nazwisko, telefon albo adres"
              />
            </label>
            <label>
              <span className="label">Dodane od</span>
              <input className="field" type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} />
            </label>
            <label>
              <span className="label">Dodane do</span>
              <input className="field" type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} />
            </label>
            <label>
              <span className="label">Kod pocztowy</span>
              <input className="field" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="np. 20-001" />
            </label>
            <label>
              <span className="label">Status</span>
              <select
                className="field"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "")}
              >
                <option value="">Wszystkie moje leady</option>
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <RegionFields
              className="md:col-span-2"
              voivodeship={voivodeship}
              county={county}
              onVoivodeshipChange={setVoivodeship}
              onCountyChange={setCounty}
            />
            <label>
              <span className="label">Sortowanie</span>
              <select
                className="field"
                value={`${sort.column}:${sort.direction}`}
                onChange={(event) => {
                  const [column, direction] = event.target.value.split(":");
                  setSort({ column: column as SortOption["column"], direction: direction as SortOption["direction"] });
                }}
              >
                <option value="created_at:desc">Dodane: najnowsze</option>
                <option value="created_at:asc">Dodane: najstarsze</option>
                <option value="updated_at:desc">Modyfikacja: najnowsza</option>
                <option value="full_name:asc">Imię i nazwisko</option>
                <option value="postal_code:asc">Kod pocztowy</option>
                <option value="status:asc">Status</option>
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
            <h2 className="text-base font-bold text-ink">Moje leady</h2>
            <div className="text-sm text-muted">{busy ? "Odświeżanie" : `${leads.length} rekordów`}</div>
          </div>
          <LeadTable leads={leads} />
        </section>
      </div>
    </AppShell>
  );
}
