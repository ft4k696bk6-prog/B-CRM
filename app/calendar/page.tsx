"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  PhoneCall,
  RefreshCw,
  UserRound
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { formatDate, formatDateTime } from "@/lib/date";
import { canManageLeads, isManagerRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { Lead, Profile } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type CalendarEvent = {
  id: string;
  type: "meeting" | "callback";
  at: string;
  lead: Lead;
};

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(date);
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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

function weekRange(date: Date) {
  const day = new Date(date);
  const offset = (day.getDay() + 6) % 7;
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  start.setDate(day.getDate() - offset);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function isInRange(value: string, start: Date, end: Date) {
  const date = new Date(value);
  return date >= start && date < end;
}

function isHeldMeeting(lead: Lead) {
  if (lead.status === "Po spotkaniu" || lead.status === "Umowa") return true;
  if (!lead.meeting_at) return false;
  return new Date(lead.meeting_at).getTime() < Date.now();
}

function EventRow({ event }: { event: CalendarEvent }) {
  const isMeeting = event.type === "meeting";

  return (
    <Link
      href={`/leads/${event.lead.id}`}
      className={`grid gap-2 rounded-md border p-3 text-sm transition hover:border-ink sm:grid-cols-[auto_1fr_auto] ${
        isMeeting
          ? "border-leaf/20 bg-leaf/10"
          : "border-solar/30 bg-solar/10"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          isMeeting ? "bg-leaf text-white" : "bg-solar text-ink"
        }`}
      >
        {isMeeting ? (
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        ) : (
          <PhoneCall className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      <span>
        <span className="block font-bold text-ink">{event.lead.full_name}</span>
        <span className="mt-1 block text-muted">
          {isMeeting
            ? event.lead.meeting_address || event.lead.address || "Brak adresu"
            : event.lead.phone}
        </span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          {event.lead.assigned_profile?.full_name || "Nieprzypisany"}
        </span>
      </span>
      <span className="font-semibold text-ink sm:text-right">{formatDateTime(event.at)}</span>
    </Link>
  );
}

export default function CalendarPage() {
  const { loading, profile } = useAuth();
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [salespeople, setSalespeople] = useState<Profile[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState("");
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canManage = canManageLeads(profile?.role);
  const isManager = isManagerRole(profile?.role);

  async function loadSalespeople() {
    if (!canManage) return;

    let query = supabase
      .from("profiles")
      .select("*")
      .in("role", ["handlowiec", "sales", "monter"])
      .order("full_name", { ascending: true });

    if (isManager && profile) query = query.eq("manager_id", profile.id);

    const { data } = await query;

    setSalespeople((data || []) as Profile[]);
  }

  async function loadCalendar() {
    setBusy(true);
    setError("");

    const select = "*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role)";
    let meetingsQuery = supabase
      .from("leads")
      .select(select)
      .not("meeting_at", "is", null)
      .gte("meeting_at", startOfMonthIso(month))
      .lt("meeting_at", startOfNextMonthIso(month))
      .order("meeting_at", { ascending: true });

    let callbacksQuery = supabase
      .from("leads")
      .select(select)
      .not("callback_at", "is", null)
      .gte("callback_at", startOfMonthIso(month))
      .lt("callback_at", startOfNextMonthIso(month))
      .order("callback_at", { ascending: true });

    if (canManage && selectedSalesperson) {
      meetingsQuery = meetingsQuery.eq("assigned_to", selectedSalesperson);
      callbacksQuery = callbacksQuery.eq("assigned_to", selectedSalesperson);
    } else if (isManager) {
      const teamIds = salespeople.map((person) => person.id);
      if (teamIds.length === 0) {
        meetingsQuery = meetingsQuery.in("assigned_to", ["00000000-0000-0000-0000-000000000000"]);
        callbacksQuery = callbacksQuery.in("assigned_to", ["00000000-0000-0000-0000-000000000000"]);
      } else {
        meetingsQuery = meetingsQuery.in("assigned_to", teamIds);
        callbacksQuery = callbacksQuery.in("assigned_to", teamIds);
      }
    }

    const [meetingsResult, callbacksResult] = await Promise.all([meetingsQuery, callbacksQuery]);

    if (meetingsResult.error || callbacksResult.error) {
      setError(meetingsResult.error?.message || callbacksResult.error?.message || "Błąd kalendarza.");
      setBusy(false);
      return;
    }

    const meetingEvents = ((meetingsResult.data || []) as Lead[]).map((lead) => ({
      id: `${lead.id}-meeting`,
      type: "meeting" as const,
      at: lead.meeting_at as string,
      lead
    }));
    const callbackEvents = ((callbacksResult.data || []) as Lead[]).map((lead) => ({
      id: `${lead.id}-callback`,
      type: "callback" as const,
      at: lead.callback_at as string,
      lead
    }));

    setEvents([...meetingEvents, ...callbackEvents].sort((a, b) => a.at.localeCompare(b.at)));
    setBusy(false);
  }

  function moveMonth(offset: number) {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(nextMonth);
    setSelectedDay(dateKey(nextMonth));
  }

  useEffect(() => {
    if (!profile) return;
    loadSalespeople();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;
    loadCalendar();
  }, [profile?.id, month, selectedSalesperson, salespeople.length]);

  const days = useMemo(() => buildCalendarDays(month), [month]);
  const todayKey = dateKey(new Date());
  const selectedDate = useMemo(() => {
    const [year, selectedMonth, day] = selectedDay.split("-").map(Number);
    return new Date(year, selectedMonth - 1, day);
  }, [selectedDay]);
  const selectedWeek = useMemo(() => weekRange(selectedDate), [selectedDate]);

  const eventsByDay = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      const key = dateKey(new Date(event.at));
      acc[key] = [...(acc[key] || []), event];
      return acc;
    }, {});
  }, [events]);

  const selectedDayEvents = eventsByDay[selectedDay] || [];
  const meetings = events.filter((event) => event.type === "meeting");
  const callbacks = events.filter((event) => event.type === "callback");
  const weekEvents = events.filter((event) => isInRange(event.at, selectedWeek.start, selectedWeek.end));
  const weekMeetings = weekEvents.filter((event) => event.type === "meeting").length;
  const weekCallbacks = weekEvents.filter((event) => event.type === "callback").length;
  const plannedMeetings = meetings.filter((event) => !isHeldMeeting(event.lead)).length;
  const heldMeetings = meetings.filter((event) => isHeldMeeting(event.lead)).length;

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="section-title">Kalendarz</h1>
            <p className="mt-1 text-sm text-muted">Spotkania i callbacki z kart leadów.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
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
            <button type="button" onClick={loadCalendar} className="btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Odśwież
            </button>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
            <div className="label">Wybrany dzień</div>
            <div className="text-2xl font-black text-ink">{selectedDayEvents.length}</div>
            <div className="mt-1 text-sm text-muted">{formatDate(selectedDate.toISOString())}</div>
          </div>
          <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
            <div className="label">Ten tydzień</div>
            <div className="text-2xl font-black text-ink">{weekMeetings}</div>
            <div className="mt-1 text-sm text-muted">{weekCallbacks} callbacków</div>
          </div>
          <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
            <div className="label">Ten miesiąc</div>
            <div className="text-2xl font-black text-ink">{meetings.length}</div>
            <div className="mt-1 text-sm text-muted">{callbacks.length} callbacków</div>
          </div>
          <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
            <div className="label">Zaplanowane</div>
            <div className="flex items-center gap-2 text-2xl font-black text-ink">
              <Clock3 className="h-5 w-5 text-sky" aria-hidden="true" />
              {plannedMeetings}
            </div>
            <div className="mt-1 text-sm text-muted">spotkania</div>
          </div>
          <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
            <div className="label">Odbyte</div>
            <div className="flex items-center gap-2 text-2xl font-black text-ink">
              <CheckCircle2 className="h-5 w-5 text-leaf" aria-hidden="true" />
              {heldMeetings}
            </div>
            <div className="mt-1 text-sm text-muted">spotkania</div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold capitalize text-ink">{monthLabel(month)}</h2>
                <p className="text-sm text-muted">
                  {meetings.length} spotkań · {callbacks.length} callbacków
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Poprzedni
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => moveMonth(1)}
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
              <div key={item} className="border-b border-r border-line bg-panel/80 p-2">
                {item}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-line">
            {days.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDay[key] || [];
              const dayMeetings = dayEvents.filter((event) => event.type === "meeting");
              const dayCallbacks = dayEvents.filter((event) => event.type === "callback");
              const isCurrentMonth = day.getMonth() === month.getMonth();
              const isSelected = key === selectedDay;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={`min-h-24 border-b border-r border-line p-2 text-left transition hover:bg-[#fbfcfe] sm:min-h-28 ${
                    isCurrentMonth ? "bg-panel" : "bg-panel/80 text-muted"
                  } ${key === todayKey ? "ring-2 ring-inset ring-solar" : ""} ${
                    isSelected ? "bg-sky/5" : ""
                  }`}
                >
                  <span className="mb-2 block text-sm font-black">{day.getDate()}</span>
                  <span className="grid gap-1">
                    {dayMeetings.length > 0 ? (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-leaf/10 px-2 py-1 text-[11px] font-black text-leaf">
                        <CalendarDays className="h-3 w-3" aria-hidden="true" />
                        {dayMeetings.length}
                      </span>
                    ) : null}
                    {dayCallbacks.length > 0 ? (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-solar/20 px-2 py-1 text-[11px] font-black text-[#8a5a00]">
                        <PhoneCall className="h-3 w-3" aria-hidden="true" />
                        {dayCallbacks.length}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          {busy ? <div className="mt-3 text-sm font-semibold text-muted">Odświeżanie...</div> : null}
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
            <h2 className="text-base font-bold text-ink">Wybrany dzień</h2>
            <div className="mt-1 text-sm text-muted">{formatDate(selectedDate.toISOString())}</div>
            <div className="mt-3 grid gap-2">
              {selectedDayEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
              {!busy && selectedDayEvents.length === 0 ? (
                <div className="rounded-md border border-line bg-panel/80 p-6 text-center text-sm font-semibold text-muted">
                  Brak spotkań i callbacków.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
            <h2 className="text-base font-bold text-ink">Najbliższe w miesiącu</h2>
            <div className="mt-3 grid gap-2">
              {events.slice(0, 12).map((event) => (
                <Link
                  key={event.id}
                  href={`/leads/${event.lead.id}`}
                  className="grid gap-2 rounded-md border border-line bg-panel/80 p-3 text-sm transition hover:border-ink sm:grid-cols-[auto_1fr_auto]"
                >
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                      event.type === "meeting"
                        ? "bg-leaf/10 text-leaf"
                        : "bg-solar/20 text-[#8a5a00]"
                    }`}
                  >
                    {event.type === "meeting" ? (
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <PhoneCall className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <span>
                    <span className="block font-bold text-ink">{event.lead.full_name}</span>
                    <span className="text-muted">
                      {event.type === "meeting" ? "Spotkanie" : "Call back"} · {timeLabel(event.at)}
                    </span>
                  </span>
                  <span className="font-semibold text-ink sm:text-right">{formatDateTime(event.at)}</span>
                </Link>
              ))}
              {!busy && events.length === 0 ? (
                <div className="rounded-md border border-line bg-panel/80 p-6 text-center text-sm font-semibold text-muted">
                  Brak zaplanowanych działań w tym miesiącu.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
