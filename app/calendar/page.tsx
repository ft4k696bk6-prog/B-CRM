"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GitBranch,
  Hammer,
  Landmark,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { useLanguage } from "@/components/language-provider";
import { Alert, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/date";
import { normalizeRole, ROLE_LABELS } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { Lead, Profile, UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type CalendarKind = "handlowiec" | "monter" | "menadzer" | "ksiegowosc" | "internal";
type CalendarEventType = "meeting" | "callback" | "internal";

type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  at: string;
  title: string;
  subtitle: string;
  ownerId: string | null;
  ownerName: string;
  ownerRole: UserRole;
  leadId?: string;
  lead?: Lead;
};

type CalendarDbEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  owner_id: string | null;
  owner_role: UserRole;
  owner_profile?: Pick<Profile, "id" | "email" | "full_name" | "role" | "crm_environment"> | null;
};

const calendarKinds: Array<{
  key: CalendarKind;
  role?: UserRole;
  labelPl: string;
  labelEn: string;
  icon: LucideIcon;
}> = [
  { key: "handlowiec", role: "handlowiec", labelPl: "Handlowcy", labelEn: "Sales", icon: BriefcaseBusiness },
  { key: "monter", role: "monter", labelPl: "Monterzy", labelEn: "Installers", icon: Hammer },
  { key: "menadzer", role: "menadzer", labelPl: "Menadżerowie", labelEn: "Managers", icon: UsersRound },
  { key: "ksiegowosc", role: "ksiegowosc", labelPl: "Księgowość", labelEn: "Accounting", icon: Landmark },
  { key: "internal", labelPl: "Wewnętrzne", labelEn: "Internal", icon: ShieldCheck }
];

const hierarchyOrder: UserRole[] = ["owner", "admin", "menadzer", "handlowiec", "ksiegowosc", "logistyk", "monter"];

function isSystemWide(role?: UserRole | null) {
  return role === "owner" || role === "admin" || role === "finance" || role === "viewer";
}

function monthLabel(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
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

function isHeldMeeting(event: CalendarEvent) {
  if (event.type !== "meeting" || !event.lead) return false;
  if (event.lead.status === "Po spotkaniu" || event.lead.status === "Umowa") return true;
  return new Date(event.at).getTime() < Date.now();
}

function defaultKindForRole(role: UserRole): CalendarKind {
  if (role === "handlowiec") return "handlowiec";
  if (role === "monter" || role === "logistyk") return "monter";
  if (role === "ksiegowosc") return "ksiegowosc";
  if (role === "menadzer") return "handlowiec";
  return "handlowiec";
}

function allowedKinds(role: UserRole) {
  if (isSystemWide(role)) return calendarKinds;
  if (role === "menadzer") {
    return calendarKinds.filter((kind) => ["handlowiec", "menadzer", "internal"].includes(kind.key));
  }
  if (role === "handlowiec") return calendarKinds.filter((kind) => kind.key === "handlowiec");
  if (role === "ksiegowosc") return calendarKinds.filter((kind) => ["ksiegowosc", "internal"].includes(kind.key));
  if (role === "logistyk" || role === "monter") return calendarKinds.filter((kind) => ["monter", "internal"].includes(kind.key));
  return calendarKinds.filter((kind) => kind.key === defaultKindForRole(role));
}

function visibleProfilesFor(profile: Profile, users: Profile[], kind: CalendarKind) {
  const normalizedUsers = users.map((user) => ({ ...user, role: normalizeRole(user.role, user.email) }));
  if (isSystemWide(profile.role)) {
    if (kind === "internal") return normalizedUsers;
    const role = calendarKinds.find((item) => item.key === kind)?.role;
    return role ? normalizedUsers.filter((user) => user.role === role) : normalizedUsers;
  }

  if (profile.role === "menadzer") {
    if (kind === "handlowiec") {
      return normalizedUsers.filter((user) => user.id === profile.id || (user.role === "handlowiec" && user.manager_id === profile.id));
    }
    if (kind === "menadzer") return normalizedUsers.filter((user) => user.id === profile.id);
    if (kind === "internal") {
      return normalizedUsers.filter((user) => user.id === profile.id || user.manager_id === profile.id);
    }
  }

  if (kind === "internal") return normalizedUsers.filter((user) => user.id === profile.id);
  return normalizedUsers.filter((user) => user.id === profile.id);
}

function buildDemoInternalEvents(month: Date, owners: Profile[], kind: CalendarKind): CalendarEvent[] {
  const picked = owners.slice(0, 4);
  return picked.map((owner, index) => {
    const at = new Date(month.getFullYear(), month.getMonth(), 6 + index * 5, 10 + index, 30, 0).toISOString();
    const ownerRole = normalizeRole(owner.role, owner.email);
    return {
      id: `demo-internal-${kind}-${owner.id}-${index}`,
      type: "internal",
      at,
      title: kind === "internal" ? "Spotkanie międzydziałowe" : `Kalendarz: ${ROLE_LABELS[ownerRole]}`,
      subtitle: "Demo kalendarza roli. Po wdrożeniu tabeli calendar_events pojawią się prawdziwe wpisy.",
      ownerId: owner.id,
      ownerName: owner.full_name,
      ownerRole
    };
  });
}

function EventRow({ event }: { event: CalendarEvent }) {
  const isMeeting = event.type === "meeting";
  const isCallback = event.type === "callback";
  const content = (
    <>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          isMeeting ? "bg-leaf text-white" : isCallback ? "bg-solar text-ink" : "bg-sky/10 text-sky"
        }`}
      >
        {isMeeting ? (
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        ) : isCallback ? (
          <PhoneCall className="h-5 w-5" aria-hidden="true" />
        ) : (
          <UsersRound className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      <span>
        <span className="block font-bold text-ink">{event.title}</span>
        <span className="mt-1 block text-muted">{event.subtitle}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          {event.ownerName} · {ROLE_LABELS[event.ownerRole]}
        </span>
      </span>
      <span className="font-semibold text-ink sm:text-right">{formatDateTime(event.at)}</span>
    </>
  );

  const className = `grid gap-2 rounded-md border p-3 text-sm transition hover:border-ink sm:grid-cols-[auto_1fr_auto] ${
    isMeeting ? "border-leaf/20 bg-leaf/10" : isCallback ? "border-solar/30 bg-solar/10" : "border-sky/20 bg-sky/10"
  }`;

  if (event.leadId) {
    return (
      <Link href={`/leads/${event.leadId}`} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

export default function CalendarPage() {
  const { loading, profile } = useAuth(["owner", "admin", "menadzer", "handlowiec", "ksiegowosc", "logistyk", "monter"]);
  const { language } = useLanguage();
  const locale = language === "en" ? "en-US" : "pl-PL";
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [calendarKind, setCalendarKind] = useState<CalendarKind>("handlowiec");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usesDemoEvents, setUsesDemoEvents] = useState(false);

  const kindOptions = useMemo(() => (profile ? allowedKinds(profile.role) : []), [profile?.role]);
  const visibleUsers = useMemo(
    () => (profile ? visibleProfilesFor(profile, users, calendarKind) : []),
    [calendarKind, profile, users]
  );
  const selectedOwners = useMemo(() => {
    if (!selectedUserId) return visibleUsers;
    return visibleUsers.filter((user) => user.id === selectedUserId);
  }, [selectedUserId, visibleUsers]);

  async function loadUsers() {
    if (!profile) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["owner", "admin", "menadzer", "handlowiec", "ksiegowosc", "logistyk", "monter", "sales", "manager"])
      .eq("crm_environment", profile.crm_environment)
      .order("full_name", { ascending: true });

    setUsers(((data || []) as Profile[]).map((user) => ({ ...user, role: normalizeRole(user.role, user.email) })));
  }

  async function loadInternalEvents(owners: Profile[]) {
    if (!profile) return [];

    const ownerIds = owners.map((owner) => owner.id);
    if (ownerIds.length === 0) return [];

    const { data, error: dbError } = await supabase
      .from("calendar_events")
      .select("*, owner_profile:profiles!calendar_events_owner_id_fkey(id,email,full_name,role,crm_environment)")
      .eq("crm_environment", profile.crm_environment)
      .gte("starts_at", startOfMonthIso(month))
      .lt("starts_at", startOfNextMonthIso(month))
      .in("owner_id", ownerIds)
      .order("starts_at", { ascending: true });

    if (dbError) {
      setUsesDemoEvents(true);
      return buildDemoInternalEvents(month, owners, calendarKind);
    }

    const rows = (data || []) as CalendarDbEvent[];
    if (rows.length === 0) {
      setUsesDemoEvents(true);
      return buildDemoInternalEvents(month, owners, calendarKind);
    }

    setUsesDemoEvents(false);
    return rows.map((item) => {
      const ownerRole = normalizeRole(item.owner_profile?.role || item.owner_role, item.owner_profile?.email);
      return {
        id: item.id,
        type: "internal" as const,
        at: item.starts_at,
        title: item.title,
        subtitle: item.description || "Wpis kalendarza wewnętrznego",
        ownerId: item.owner_id,
        ownerName: item.owner_profile?.full_name || "Użytkownik",
        ownerRole
      };
    });
  }

  async function loadSalesLeadEvents(owners: Profile[]) {
    if (!profile) return [];

    const ownerIds = owners.map((owner) => owner.id);
    const includeUnassigned = !selectedUserId && (isSystemWide(profile.role) || profile.role === "menadzer");
    if (ownerIds.length === 0 && !includeUnassigned) return [];

    const select = "*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)";
    let meetingsQuery = supabase
      .from("leads")
      .select(select)
      .eq("crm_environment", profile.crm_environment)
      .not("meeting_at", "is", null)
      .gte("meeting_at", startOfMonthIso(month))
      .lt("meeting_at", startOfNextMonthIso(month))
      .order("meeting_at", { ascending: true });

    let callbacksQuery = supabase
      .from("leads")
      .select(select)
      .eq("crm_environment", profile.crm_environment)
      .not("callback_at", "is", null)
      .gte("callback_at", startOfMonthIso(month))
      .lt("callback_at", startOfNextMonthIso(month))
      .order("callback_at", { ascending: true });

    if (ownerIds.length > 0 && includeUnassigned) {
      const ownerFilter = ownerIds.join(",");
      meetingsQuery = meetingsQuery.or(`assigned_to.in.(${ownerFilter}),assigned_to.is.null`);
      callbacksQuery = callbacksQuery.or(`assigned_to.in.(${ownerFilter}),assigned_to.is.null`);
    } else if (ownerIds.length > 0) {
      meetingsQuery = meetingsQuery.in("assigned_to", ownerIds);
      callbacksQuery = callbacksQuery.in("assigned_to", ownerIds);
    } else {
      meetingsQuery = meetingsQuery.is("assigned_to", null);
      callbacksQuery = callbacksQuery.is("assigned_to", null);
    }

    const [meetingsResult, callbacksResult] = await Promise.all([meetingsQuery, callbacksQuery]);

    if (meetingsResult.error || callbacksResult.error) {
      throw new Error(meetingsResult.error?.message || callbacksResult.error?.message || "Błąd kalendarza.");
    }

    const meetingEvents = ((meetingsResult.data || []) as Lead[]).map((lead) => ({
      id: `${lead.id}-meeting`,
      type: "meeting" as const,
      at: lead.meeting_at as string,
      title: lead.full_name,
      subtitle: lead.meeting_address || lead.address || "Brak adresu",
      ownerId: lead.assigned_to,
      ownerName: lead.assigned_profile?.full_name || "Nieprzypisany",
      ownerRole: normalizeRole(lead.assigned_profile?.role || "handlowiec", lead.assigned_profile?.email),
      leadId: lead.id,
      lead
    }));
    const callbackEvents = ((callbacksResult.data || []) as Lead[]).map((lead) => ({
      id: `${lead.id}-callback`,
      type: "callback" as const,
      at: lead.callback_at as string,
      title: lead.full_name,
      subtitle: lead.phone,
      ownerId: lead.assigned_to,
      ownerName: lead.assigned_profile?.full_name || "Nieprzypisany",
      ownerRole: normalizeRole(lead.assigned_profile?.role || "handlowiec", lead.assigned_profile?.email),
      leadId: lead.id,
      lead
    }));

    return [...meetingEvents, ...callbackEvents];
  }

  async function loadCalendar() {
    if (!profile) return;
    setBusy(true);
    setError("");

    try {
      const owners = selectedOwners;
      const shouldLoadLeadEvents = calendarKind === "handlowiec" || calendarKind === "menadzer";
      const roleEvents = shouldLoadLeadEvents ? await loadSalesLeadEvents(owners) : [];
      const internalEvents = shouldLoadLeadEvents ? [] : await loadInternalEvents(owners);
      setEvents([...roleEvents, ...internalEvents].sort((a, b) => a.at.localeCompare(b.at)));
    } catch (calendarError) {
      setError(calendarError instanceof Error ? calendarError.message : "Błąd kalendarza.");
    } finally {
      setBusy(false);
    }
  }

  function moveMonth(offset: number) {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(nextMonth);
    setSelectedDay(dateKey(nextMonth));
  }

  useEffect(() => {
    if (!profile) return;
    setCalendarKind(defaultKindForRole(profile.role));
    loadUsers();
  }, [profile?.id, profile?.crm_environment]);

  useEffect(() => {
    setSelectedUserId("");
  }, [calendarKind]);

  useEffect(() => {
    if (!profile) return;
    loadCalendar();
  }, [profile?.id, profile?.crm_environment, month, calendarKind, selectedUserId, visibleUsers.length]);

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
  const internal = events.filter((event) => event.type === "internal");
  const weekEvents = events.filter((event) => isInRange(event.at, selectedWeek.start, selectedWeek.end));
  const weekMeetings = weekEvents.filter((event) => event.type === "meeting").length;
  const weekCallbacks = weekEvents.filter((event) => event.type === "callback").length;
  const plannedMeetings = meetings.filter((event) => !isHeldMeeting(event)).length;
  const heldMeetings = meetings.filter(isHeldMeeting).length;
  const visibleByRole = profile
    ? hierarchyOrder
        .map((role) => ({
          role,
          users: users.filter(
            (user) =>
              visibleProfilesFor(
                profile,
                users,
                role === "handlowiec"
                  ? "handlowiec"
                  : role === "menadzer"
                    ? "menadzer"
                    : role === "ksiegowosc"
                      ? "ksiegowosc"
                      : role === "monter" || role === "logistyk"
                        ? "monter"
                        : "internal"
              ).some((visible) => visible.id === user.id) && normalizeRole(user.role, user.email) === role
          )
        }))
        .filter((group) => group.users.length > 0)
    : [];

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title={language === "en" ? "Calendar" : "Kalendarz"}
          description={
            language === "en"
              ? "Department calendars, user calendars and internal meetings with role-based visibility."
              : "Kalendarze działów, kalendarze użytkowników i spotkania wewnętrzne z widocznością według hierarchii."
          }
          actions={
          <div className="flex flex-wrap gap-2">
            <select
              className="field w-full sm:w-72"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              disabled={visibleUsers.length <= 1}
            >
              <option value="">{language === "en" ? "All visible users" : "Wszyscy widoczni użytkownicy"}</option>
              {visibleUsers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </select>
            <button type="button" onClick={loadCalendar} className="btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {language === "en" ? "Refresh" : "Odśwież"}
            </button>
          </div>
          }
        />

        <section className="grid gap-2 md:grid-cols-5">
          {kindOptions.map((kind) => {
            const Icon = kind.icon;
            const active = calendarKind === kind.key;
            return (
              <button
                key={kind.key}
                type="button"
                onClick={() => setCalendarKind(kind.key)}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition ${
                  active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {language === "en" ? kind.labelEn : kind.labelPl}
              </button>
            );
          })}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="app-card">
            <div className="label">{language === "en" ? "Selected day" : "Wybrany dzień"}</div>
            <div className="text-2xl font-black text-ink">{selectedDayEvents.length}</div>
            <div className="mt-1 text-sm text-muted">{formatDate(selectedDate.toISOString())}</div>
          </div>
          <div className="app-card">
            <div className="label">{language === "en" ? "This week" : "Ten tydzień"}</div>
            <div className="text-2xl font-black text-ink">{weekMeetings}</div>
            <div className="mt-1 text-sm text-muted">
              {weekCallbacks} {language === "en" ? "call-backs" : "call-backów"}
            </div>
          </div>
          <div className="app-card">
            <div className="label">{language === "en" ? "This month" : "Ten miesiąc"}</div>
            <div className="text-2xl font-black text-ink">{meetings.length}</div>
            <div className="mt-1 text-sm text-muted">
              {callbacks.length} {language === "en" ? "call-backs" : "call-backów"}
            </div>
          </div>
          <div className="app-card">
            <div className="label">{language === "en" ? "Planned" : "Zaplanowane"}</div>
            <div className="flex items-center gap-2 text-2xl font-black text-ink">
              <Clock3 className="h-5 w-5 text-sky" aria-hidden="true" />
              {plannedMeetings + internal.length}
            </div>
            <div className="mt-1 text-sm text-muted">{language === "en" ? "meetings and internal" : "spotkania i wewnętrzne"}</div>
          </div>
          <div className="app-card">
            <div className="label">{language === "en" ? "Held" : "Odbyte"}</div>
            <div className="flex items-center gap-2 text-2xl font-black text-ink">
              <CheckCircle2 className="h-5 w-5 text-leaf" aria-hidden="true" />
              {heldMeetings}
            </div>
            <div className="mt-1 text-sm text-muted">{language === "en" ? "meetings" : "spotkania"}</div>
          </div>
        </section>

        <section className="app-card">
          <SectionHeader
            icon={GitBranch}
            title={language === "en" ? "Role hierarchy" : "Mapa hierarchii"}
            description={
              language === "en"
                ? "Visible users are calculated from role permissions and reporting lines."
                : "Widoczni użytkownicy wynikają z uprawnień roli i przypisania przełożonych."
            }
            tone="sky"
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleByRole.map((group) => (
              <div key={group.role} className="rounded-lg border border-line bg-[#f9fbfd] p-3">
                <div className="text-sm font-black text-ink">{ROLE_LABELS[group.role]}</div>
                <div className="mt-3 grid gap-2">
                  {group.users.map((user) => (
                    <div key={user.id} className="rounded-md border border-line bg-white px-3 py-2 text-sm">
                      <div className="font-semibold text-ink">{user.full_name}</div>
                      <div className="text-xs text-muted">{user.email}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="app-card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold capitalize text-ink">{monthLabel(month, locale)}</h2>
                <p className="text-sm text-muted">
                  {language === "en"
                    ? `${meetings.length} meetings · ${callbacks.length} call-backs · ${internal.length} internal`
                    : `${meetings.length} spotkań · ${callbacks.length} call-backów · ${internal.length} wewnętrzne`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => moveMonth(-1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {language === "en" ? "Previous" : "Poprzedni"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => moveMonth(1)}>
                {language === "en" ? "Next" : "Następny"}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {usesDemoEvents ? (
            <Alert tone="info" className="mb-4">
              {language === "en"
                ? "Demo internal calendar entries are shown until the calendar_events table is enabled."
                : "Pokazuję wpisy demo dla kalendarzy wewnętrznych do czasu włączenia tabeli calendar_events."}
            </Alert>
          ) : null}

          {error ? (
            <Alert tone="danger" className="mb-4">
              {error}
            </Alert>
          ) : null}

          <div className="grid grid-cols-7 border-l border-t border-line text-xs font-bold uppercase tracking-wide text-muted">
            {(language === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Pon", "Wt", "Sr", "Czw", "Pt", "Sob", "Nd"]).map((item) => (
              <div key={item} className="border-b border-r border-line bg-[#f9fbfd] p-2">
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
              const dayInternal = dayEvents.filter((event) => event.type === "internal");
              const isCurrentMonth = day.getMonth() === month.getMonth();
              const isSelected = key === selectedDay;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={`min-h-24 border-b border-r border-line p-2 text-left transition hover:bg-[#fbfcfe] sm:min-h-28 ${
                    isCurrentMonth ? "bg-white" : "bg-[#f9fbfd] text-muted"
                  } ${key === todayKey ? "ring-2 ring-inset ring-solar" : ""} ${isSelected ? "bg-sky/5" : ""}`}
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
                    {dayInternal.length > 0 ? (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-sky/10 px-2 py-1 text-[11px] font-black text-sky">
                        <UsersRound className="h-3 w-3" aria-hidden="true" />
                        {dayInternal.length}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          {busy ? <div className="mt-3 text-sm font-semibold text-muted">{language === "en" ? "Refreshing..." : "Odświeżanie..."}</div> : null}
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="app-card">
            <h2 className="text-base font-bold text-ink">{language === "en" ? "Selected day" : "Wybrany dzień"}</h2>
            <div className="mt-1 text-sm text-muted">{formatDate(selectedDate.toISOString())}</div>
            <div className="mt-3 grid gap-2">
              {selectedDayEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
              {!busy && selectedDayEvents.length === 0 ? (
                <EmptyState
                  title={language === "en" ? "No events" : "Brak wydarzeń"}
                  description={language === "en" ? "No meetings, call-backs or internal entries for this day." : "Brak spotkań, call-backów i wpisów wewnętrznych w tym dniu."}
                />
              ) : null}
            </div>
          </div>

          <div className="app-card">
            <h2 className="text-base font-bold text-ink">{language === "en" ? "Upcoming this month" : "Najbliższe w miesiącu"}</h2>
            <div className="mt-3 grid gap-2">
              {events.slice(0, 12).map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
              {!busy && events.length === 0 ? (
                <EmptyState
                  title={language === "en" ? "No scheduled events" : "Brak zaplanowanych działań"}
                  description={language === "en" ? "This month has no visible calendar entries." : "Ten miesiąc nie ma widocznych wpisów kalendarza."}
                />
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
