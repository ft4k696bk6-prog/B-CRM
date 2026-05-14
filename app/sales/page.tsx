"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  PhoneCall,
  RefreshCw
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

export default function SalesDashboardPage() {
  const { loading, profile } = useAuth("sales");
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

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="section-title">Dashboard handlowca</h1>
            <p className="mt-1 text-sm text-muted">Leady, callbacki i spotkania.</p>
          </div>
          <button type="button" onClick={loadLeads} className="btn-secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Odśwież
          </button>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Moje leady" value={leads.length} icon={ClipboardList} tone="sky" />
          <StatTile
            label="Callbacki"
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
            label="Zaległe callbacki"
            value={overdueCallbacks.length}
            icon={AlertTriangle}
            tone="danger"
          />
        </section>

        {overdueCallbacks.length > 0 ? (
          <section className="rounded-lg border border-danger/20 bg-danger/10 p-4">
            <h2 className="text-base font-bold text-danger">Zaległe callbacki</h2>
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
