"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { formatDateTime } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import type { Lead, Profile } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(date);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonthIso(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0).toISOString();
}

function startOfNextMonthIso(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0).toISOString();
}

function buildCalendarDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return current;
  });
}

export default function CalendarPage() {
  const { loading, profile } = useAuth();
  const [month, setMonth] = useState(() => new Date());
  const [meetings, setMeetings] = useState<Lead[]>([]);
  const [salespeople, setSalespeople] = useState<Profile[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = profile?.role === "admin";

  async function loadSalespeople() {
    if (!isAdmin) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "sales")
      .order("full_name", { ascending: true });

    setSalespeople((data || []) as Profile[]);
  }

  async function loadMeetings() {
    setBusy(true);
    setError("");

    let query = supabase
      .from("leads")
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role)")
      .not("meeting_at", "is", null)
      .gte("meeting_at", startOfMonthIso(month))
      .lt("meeting_at", startOfNextMonthIso(month))
      .order("meeting_at", { ascending: true });

    if (isAdmin && selectedSalesperson) {
      query = query.eq("assigned_to", selectedSalesperson);
    }

    const { data, error: meetingsError } = await query;

    if (meetingsError) {
      setError(meetingsError.message);
    } else {
      setMeetings((data || []) as Lead[]);
    }

    setBusy(false);
  }

  useEffect(() => {
    if (!profile) return;
    loadSalespeople();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;
    loadMeetings();
  }, [profile?.id, month, selectedSalesperson]);

  const days = useMemo(() => buildCalendarDays(month), [month]);
  const todayKey = dateKey(new Date());
  const meetingsByDay = useMemo(() => {
    return meetings.reduce<Record<string, Lead[]>>((acc, lead) => {
      if (!lead.meeting_at) return acc;
      const key = dateKey(new Date(lead.meeting_at));
      acc[key] = [...(acc[key] || []), lead];
      return acc;
    }, {});
  }, [meetings]);

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="section-title">Kalendarz spotkań</h1>
            <p className="mt-1 text-sm text-muted">
              Widok spotkań z kart leadów, z podziałem na dni i handlowców.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <select
                className="field w-full sm:w-64"
                value={selectedSalesperson}
                onChange={(event) => setSelectedSalesperson(event.target.value)}
              >
                <option value="">Wszyscy handlowcy</option>
                {salespeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="button" onClick={loadMeetings} className="btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Odśwież
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold capitalize text-ink">{monthLabel(month)}</h2>
                <p className="text-sm text-muted">{meetings.length} spotkań w tym miesiącu</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Poprzedni
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                Następny
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-7 border-l border-t border-line text-xs font-bold uppercase tracking-wide text-muted">
            {["Pon", "Wt", "Sr", "Czw", "Pt", "Sob", "Nd"].map((item) => (
              <div key={item} className="border-b border-r border-line bg-[#f9fbfd] p-2">
                {item}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-line">
            {days.map((day) => {
              const key = dateKey(day);
              const dayMeetings = meetingsByDay[key] || [];
              const isCurrentMonth = day.getMonth() === month.getMonth();

              return (
                <div
                  key={key}
                  className={`min-h-32 border-b border-r border-line p-2 ${
                    isCurrentMonth ? "bg-white" : "bg-[#f9fbfd] text-muted"
                  } ${key === todayKey ? "ring-2 ring-inset ring-solar" : ""}`}
                >
                  <div className="mb-2 text-sm font-black">{day.getDate()}</div>
                  <div className="grid gap-1">
                    {dayMeetings.slice(0, 3).map((lead) => (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        className="rounded-md border border-leaf/20 bg-leaf/10 px-2 py-1 text-left text-[11px] font-semibold leading-tight text-[#23682e] transition hover:border-leaf"
                      >
                        <span className="block truncate">{lead.full_name}</span>
                        <span className="block truncate font-normal">
                          {formatDateTime(lead.meeting_at)}
                        </span>
                      </Link>
                    ))}
                    {dayMeetings.length > 3 ? (
                      <div className="text-[11px] font-semibold text-muted">
                        +{dayMeetings.length - 3} więcej
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-ink">Lista spotkań</h2>
          <div className="mt-3 grid gap-2">
            {meetings.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="grid gap-2 rounded-md border border-line bg-[#f9fbfd] p-3 text-sm transition hover:border-ink sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="font-bold text-ink">{lead.full_name}</div>
                  <div className="mt-1 text-muted">
                    {lead.meeting_address || lead.address || "Brak adresu"}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="font-semibold text-ink">{formatDateTime(lead.meeting_at)}</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
                    <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                    {lead.assigned_profile?.full_name || "Nieprzypisany"}
                  </div>
                </div>
              </Link>
            ))}
            {!busy && meetings.length === 0 ? (
              <div className="rounded-md border border-line bg-[#f9fbfd] p-6 text-center text-sm font-semibold text-muted">
                Brak spotkań w tym miesiącu.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

