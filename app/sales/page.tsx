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
import { StatTile } from "@/components/stat-tile";
import { LEAD_STATUSES } from "@/lib/constants";
import { formatDateTime, isPast, isToday } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import type { Lead, LeadStatus } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

function needsNextAction(lead: Pick<Lead, "status" | "callback_at" | "meeting_at">) {
  if (["Umowa", "Rezygnacja", "Zwrot"].includes(lead.status)) return false;
  return !lead.callback_at && !lead.meeting_at;
}

export default function SalesDashboardPage() {
  const { loading, profile } = useAuth("handlowiec");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadLeads() {
    setBusy(true);
    setError("");

    let query = supabase
      .from("leads")
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role)")
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error: leadsError } = await query;

    if (leadsError) {
      setError(leadsError.message);
    } else {
      setLeads((data || []) as Lead[]);
    }

    setBusy(false);
  }

  useEffect(() => {
    loadLeads();
  }, [statusFilter]);

  useEffect(() => {
    function refreshLeads() {
      loadLeads();
    }

    window.addEventListener("leads:changed", refreshLeads);
    return () => window.removeEventListener("leads:changed", refreshLeads);
  }, [statusFilter]);

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
      ...overdueCallbacks.map((lead) => ({ lead, reason: "Zaległy call-back" })),
      ...todayMeetings.map((lead) => ({ lead, reason: "Spotkanie dzisiaj" })),
      ...leadsWithoutNextAction.map((lead) => ({ lead, reason: "Brak następnej akcji" }))
    ].slice(0, 8),
    [leadsWithoutNextAction, overdueCallbacks, todayMeetings]
  );

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="section-title">Panel handlowca</h1>
            <p className="mt-1 text-sm text-muted">Leady, call-backi i spotkania.</p>
          </div>
          <button type="button" onClick={loadLeads} className="btn-secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Odśwież
          </button>
        </div>

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

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky/10 text-sky">
              <Target className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Co zrobić teraz</h2>
              <p className="mt-1 text-sm text-muted">Najpilniejsze leady do obsłużenia.</p>
            </div>
          </div>
          <div className="grid gap-2">
            {workQueue.map(({ lead, reason }) => (
              <Link
                key={`${reason}-${lead.id}`}
                href={`/leads/${lead.id}`}
                className="flex flex-col gap-1 rounded-md border border-line bg-[#f9fbfd] px-3 py-2 text-sm transition hover:border-ink sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-semibold text-ink">{lead.full_name}</span>
                <span className="text-muted">{reason}</span>
              </Link>
            ))}
            {workQueue.length === 0 ? (
              <div className="rounded-md border border-line bg-[#f9fbfd] px-3 py-4 text-center text-sm font-semibold text-muted">
                Brak pilnych zadań.
              </div>
            ) : null}
          </div>
        </section>

        {overdueCallbacks.length > 0 ? (
          <section className="rounded-lg border border-danger/20 bg-danger/10 p-4">
            <h2 className="text-base font-bold text-danger">Zaległe call-backi</h2>
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
            <h2 className="text-base font-bold text-leaf">Dzisiejsze spotkania</h2>
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

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="max-w-xs">
            <label>
              <span className="label">Szybki filtr statusu</span>
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
          </div>
        </section>

        {error ? (
          <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
            {error}
          </div>
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
