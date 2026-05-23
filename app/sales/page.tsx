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
import { Alert, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
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
    if (!profile) return;

    setBusy(true);
    setError("");

    let query = supabase
      .from("leads")
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)")
      .eq("crm_environment", profile.crm_environment)
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (profile.can_view_lead_pool) {
      query = query.or(`assigned_to.eq.${profile.id},assigned_to.is.null`);
    } else {
      query = query.eq("assigned_to", profile.id);
    }

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
    if (!profile) return;
    loadLeads();
  }, [profile?.id, profile?.crm_environment, statusFilter]);

  useEffect(() => {
    function refreshLeads() {
      loadLeads();
    }

    window.addEventListener("leads:changed", refreshLeads);
    return () => window.removeEventListener("leads:changed", refreshLeads);
  }, [profile?.id, profile?.crm_environment, statusFilter]);

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
          <StatTile
            label={profile.can_view_lead_pool ? "Moje i z puli" : "Moje leady"}
            value={leads.length}
            icon={ClipboardList}
            tone="sky"
          />
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
              title="Zaległe call-backi"
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
          <div className="max-w-xs">
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
            <div className="text-sm text-muted">{busy ? "Odświeżanie" : `${leads.length} rekordów`}</div>
          </div>
          <LeadTable leads={leads} showAssignee={profile.can_view_lead_pool} />
        </section>
      </div>
    </AppShell>
  );
}
