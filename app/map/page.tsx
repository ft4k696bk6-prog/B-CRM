"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  UsersRound
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import type { LeadMapPoint, MeetingMapPoint } from "@/components/lead-map-canvas";
import { isSalesRole, normalizeRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

const LeadMapCanvas = dynamic(
  () => import("@/components/lead-map-canvas").then((module) => module.LeadMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[64dvh] min-h-[520px] items-center justify-center rounded-xl border border-line bg-panel text-sm font-semibold text-muted">
        Ładowanie mapy…
      </div>
    )
  }
);

type MapLead = {
  id: string;
  full_name: string;
  postal_code: string | null;
  address: string | null;
  voivodeship: string | null;
  county: string | null;
  status: string;
  assigned_to: string | null;
  meeting_at: string | null;
  meeting_address: string | null;
  map_lat: number | null;
  map_lng: number | null;
  map_geocoded_at: string | null;
  map_geocode_query: string | null;
  meeting_map_lat: number | null;
  meeting_map_lng: number | null;
  meeting_map_geocoded_at: string | null;
  meeting_map_geocode_query: string | null;
};

type RouteResult = {
  distance: number;
  duration: number;
  legs: Array<{ distance: number; duration: number }>;
  coordinates: Array<[number, number]>;
  approximate: boolean;
};

type StartPoint = { lat: number; lng: number; label: string };

type GeocodeResponse = {
  found?: boolean;
  lat?: number;
  lng?: number;
  cached?: boolean;
  throttle?: boolean;
  source?: string;
  postalCode?: string;
  query?: string;
  geocodedAt?: string;
  error?: string;
};

type GeoTask = {
  leadId: string;
  kind: "lead" | "meeting";
  postalCode?: string;
};

type GeoResult = {
  task: GeoTask;
  responseOk: boolean;
  body: GeocodeResponse;
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  return dateKey(new Date(year, month - 1, day + days, 12));
}

function isSameLocalDate(value: string, key: string) {
  return dateKey(new Date(value)) === key;
}

function validCoords(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  return !(latitude === 0 && longitude === 0);
}

function normalizePostalCode(value: string | null | undefined) {
  const match = String(value || "").match(/(\d{2})\D?(\d{3})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function recentAttempt(value: string | null | undefined) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() < 7 * 24 * 60 * 60 * 1000;
}

function formatKm(meters: number) {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString("pl-PL", { maximumFractionDigits: meters < 10000 ? 1 : 0 })} km`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} h ${String(rest).padStart(2, "0")} min` : `${minutes} min`;
}

function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(
    typeof value === "string" ? new Date(value) : value
  );
}

function formatDayLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(year, month - 1, day, 12)
  );
}

function meetingAddress(lead: MapLead) {
  return lead.meeting_address || lead.address || lead.postal_code || "Brak adresu";
}

function googleDirectionsUrl(startPoint: StartPoint | null, meetings: MeetingMapPoint[]) {
  if (meetings.length === 0) return "";
  const points = startPoint ? [{ lat: startPoint.lat, lng: startPoint.lng }, ...meetings] : meetings;
  if (points.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${points[0].lat},${points[0].lng}&travelmode=driving`;
  }

  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1).slice(0, 9).map((point) => `${point.lat},${point.lng}`).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving"
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

async function runInChunks<T, R>(items: T[], chunkSize: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    results.push(...await Promise.all(chunk.map(worker)));
  }
  return results;
}

export default function MapPage() {
  const { loading, profile, session } = useAuth(["owner", "admin", "menadzer", "handlowiec"]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [leads, setLeads] = useState<MapLead[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [startPoint, setStartPoint] = useState<StartPoint | null>(null);
  const [startAddress, setStartAddress] = useState("");
  const [startBusy, setStartBusy] = useState(false);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [geoProgress, setGeoProgress] = useState({ active: false, done: 0, total: 0 });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("bcrm-map-start-point");
      if (!saved) return;
      const point = JSON.parse(saved) as StartPoint;
      if (!validCoords(point.lat, point.lng)) return;
      setStartPoint(point);
      if (point.label !== "Moja lokalizacja") setStartAddress(point.label);
    } catch {
      // Start point is optional.
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    const currentProfile = profile;

    async function loadUsers() {
      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name,role,manager_id,crm_environment,created_at,business_phone")
        .eq("crm_environment", currentProfile.crm_environment)
        .in("role", ["handlowiec", "menadzer", "sales", "manager"])
        .order("full_name", { ascending: true });

      if (!active) return;
      const normalized = ((data || []) as Profile[]).map((user) => ({
        ...user,
        role: normalizeRole(user.role, user.email)
      }));
      const visible = currentProfile.role === "handlowiec"
        ? normalized.filter((user) => user.id === currentProfile.id)
        : currentProfile.role === "menadzer"
          ? normalized.filter((user) => user.id === currentProfile.id || user.manager_id === currentProfile.id)
          : normalized.filter((user) => isSalesRole(user.role));

      setUsers(visible);
      setSelectedUserId((current) => current || (
        visible.some((user) => user.id === currentProfile.id) ? currentProfile.id : visible[0]?.id || ""
      ));
    }

    void loadUsers();
    return () => { active = false; };
  }, [profile]);

  useEffect(() => {
    if (!profile || !selectedUserId) return;
    let active = true;
    const currentProfile = profile;

    async function loadLeads() {
      setBusy(true);
      setError("");
      const { data, error: dbError } = await supabase
        .from("leads")
        .select("id,full_name,postal_code,address,voivodeship,county,status,assigned_to,meeting_at,meeting_address,map_lat,map_lng,map_geocoded_at,map_geocode_query,meeting_map_lat,meeting_map_lng,meeting_map_geocoded_at,meeting_map_geocode_query")
        .eq("crm_environment", currentProfile.crm_environment)
        .eq("assigned_to", selectedUserId)
        .order("updated_at", { ascending: false })
        .limit(800);

      if (!active) return;
      setBusy(false);
      if (dbError) {
        setError(dbError.message);
        return;
      }
      setLeads((data || []) as MapLead[]);
    }

    void loadLeads();
    return () => { active = false; };
  }, [profile, selectedUserId]);

  const meetingsForDay = useMemo(
    () => leads
      .filter((lead) => lead.meeting_at && isSameLocalDate(lead.meeting_at, selectedDate))
      .sort((a, b) => new Date(a.meeting_at || 0).getTime() - new Date(b.meeting_at || 0).getTime()),
    [leads, selectedDate]
  );

  const visibleLeads = useMemo(
    () => leads.filter((lead) => showClosed || (lead.status !== "Rezygnacja" && lead.status !== "Umowa")),
    [leads, showClosed]
  );

  const leadPoints = useMemo<LeadMapPoint[]>(
    () => visibleLeads
      .filter((lead) => validCoords(lead.map_lat, lead.map_lng))
      .map((lead) => ({
        id: lead.id,
        name: lead.full_name,
        status: lead.status,
        lat: Number(lead.map_lat),
        lng: Number(lead.map_lng),
        address: lead.address || lead.postal_code || "",
        postalCode: normalizePostalCode(lead.postal_code)
      })),
    [visibleLeads]
  );

  const meetingPoints = useMemo<MeetingMapPoint[]>(
    () => meetingsForDay.flatMap((lead, index) => {
      const dedicated = validCoords(lead.meeting_map_lat, lead.meeting_map_lng);
      const reuseLead = !lead.meeting_address && validCoords(lead.map_lat, lead.map_lng);
      if (!dedicated && !reuseLead) return [];
      return [{
        id: lead.id,
        name: lead.full_name,
        at: lead.meeting_at || "",
        lat: Number(dedicated ? lead.meeting_map_lat : lead.map_lat),
        lng: Number(dedicated ? lead.meeting_map_lng : lead.map_lng),
        address: meetingAddress(lead),
        order: index + 1
      }];
    }),
    [meetingsForDay]
  );

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken || !selectedUserId || busy) return;
    let cancelled = false;

    const postalRepresentatives = new Map<string, MapLead>();
    for (const lead of visibleLeads) {
      if (validCoords(lead.map_lat, lead.map_lng)) continue;
      const postalCode = normalizePostalCode(lead.postal_code);
      if (!postalCode) continue;
      const alreadyTriedCurrentPostal = lead.map_geocode_query === `postal:${postalCode}` && recentAttempt(lead.map_geocoded_at);
      if (alreadyTriedCurrentPostal) continue;
      if (!postalRepresentatives.has(postalCode)) postalRepresentatives.set(postalCode, lead);
    }

    const postalTasks: GeoTask[] = [...postalRepresentatives.entries()]
      .slice(0, 120)
      .map(([postalCode, lead]) => ({ leadId: lead.id, kind: "lead", postalCode }));

    const meetingTasks: GeoTask[] = meetingsForDay
      .filter((lead) => lead.meeting_address && !validCoords(lead.meeting_map_lat, lead.meeting_map_lng) && !recentAttempt(lead.meeting_map_geocoded_at))
      .slice(0, 10)
      .map((lead) => ({ leadId: lead.id, kind: "meeting" }));

    const addressTasks: GeoTask[] = visibleLeads
      .filter((lead) => !normalizePostalCode(lead.postal_code) && !validCoords(lead.map_lat, lead.map_lng) && !recentAttempt(lead.map_geocoded_at))
      .slice(0, 10)
      .map((lead) => ({ leadId: lead.id, kind: "lead" }));

    const total = postalTasks.length + meetingTasks.length + addressTasks.length;
    if (total === 0) {
      setGeoProgress({ active: false, done: 0, total: 0 });
      return;
    }

    async function callTask(task: GeoTask): Promise<GeoResult> {
      try {
        const response = await fetch("/api/map/geocode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ leadId: task.leadId, kind: task.kind })
        });
        const body = (await response.json().catch(() => ({}))) as GeocodeResponse;
        return { task, responseOk: response.ok, body };
      } catch {
        return { task, responseOk: false, body: {} };
      }
    }

    async function run() {
      setGeoProgress({ active: true, done: 0, total });
      const collected: GeoResult[] = [];
      let done = 0;

      const postalResults = await runInChunks(postalTasks, 12, async (task) => {
        const result = await callTask(task);
        done += 1;
        if (!cancelled) setGeoProgress({ active: done < total, done, total });
        return result;
      });
      collected.push(...postalResults);

      for (const task of [...meetingTasks, ...addressTasks]) {
        if (cancelled) return;
        const result = await callTask(task);
        collected.push(result);
        done += 1;
        setGeoProgress({ active: done < total, done, total });
        if (result.body.throttle && !result.body.cached) {
          await new Promise((resolve) => window.setTimeout(resolve, 1100));
        }
      }

      if (cancelled) return;
      setLeads((current) => current.map((lead) => {
        let next = lead;
        for (const result of collected) {
          if (!result.responseOk) continue;
          const geocodedAt = result.body.geocodedAt || new Date().toISOString();

          if (result.task.postalCode) {
            if (normalizePostalCode(lead.postal_code) !== result.task.postalCode) continue;
            next = {
              ...next,
              map_lat: result.body.found ? Number(result.body.lat) : null,
              map_lng: result.body.found ? Number(result.body.lng) : null,
              map_geocoded_at: geocodedAt,
              map_geocode_query: `postal:${result.task.postalCode}`
            };
            continue;
          }

          if (lead.id !== result.task.leadId) continue;
          if (result.task.kind === "meeting") {
            next = {
              ...next,
              meeting_map_lat: result.body.found ? Number(result.body.lat) : null,
              meeting_map_lng: result.body.found ? Number(result.body.lng) : null,
              meeting_map_geocoded_at: geocodedAt,
              meeting_map_geocode_query: result.body.query || next.meeting_map_geocode_query
            };
          } else {
            next = {
              ...next,
              map_lat: result.body.found ? Number(result.body.lat) : null,
              map_lng: result.body.found ? Number(result.body.lng) : null,
              map_geocoded_at: geocodedAt,
              map_geocode_query: result.body.query || next.map_geocode_query
            };
          }
        }
        return next;
      }));
      setGeoProgress({ active: false, done: total, total });
    }

    void run();
    return () => { cancelled = true; };
  }, [busy, meetingsForDay, selectedUserId, session?.access_token, visibleLeads]);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;

    const points = startPoint
      ? [{ lat: startPoint.lat, lng: startPoint.lng }, ...meetingPoints.map((point) => ({ lat: point.lat, lng: point.lng }))]
      : meetingPoints.map((point) => ({ lat: point.lat, lng: point.lng }));

    if (points.length < 2) {
      setRoute(null);
      return;
    }

    let active = true;
    async function loadRoute() {
      setRouteBusy(true);
      const response = await fetch("/api/map/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ points })
      });
      const body = (await response.json().catch(() => ({}))) as RouteResult;
      if (!active) return;
      setRouteBusy(false);
      setRoute(response.ok ? body : null);
    }

    void loadRoute();
    return () => { active = false; };
  }, [meetingPoints, session?.access_token, startPoint]);

  async function locateMe() {
    if (!navigator.geolocation) {
      setError("Ta przeglądarka nie udostępnia lokalizacji.");
      return;
    }
    setStartBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude, label: "Moja lokalizacja" };
        setStartPoint(point);
        window.localStorage.setItem("bcrm-map-start-point", JSON.stringify(point));
        setStartBusy(false);
      },
      () => {
        setStartBusy(false);
        setError("Nie udało się pobrać lokalizacji. Możesz wpisać adres startowy ręcznie.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    );
  }

  async function geocodeStartAddress() {
    const accessToken = session?.access_token;
    if (!accessToken || !startAddress.trim()) return;
    setStartBusy(true);
    setError("");
    const response = await fetch("/api/map/geocode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ query: startAddress.trim() })
    });
    const body = (await response.json().catch(() => ({}))) as GeocodeResponse;
    setStartBusy(false);
    if (!response.ok || !body.found || !validCoords(body.lat, body.lng)) {
      setError(body.error || "Nie znalazłem tego adresu startowego.");
      return;
    }
    const point = { lat: Number(body.lat), lng: Number(body.lng), label: startAddress.trim() };
    setStartPoint(point);
    window.localStorage.setItem("bcrm-map-start-point", JSON.stringify(point));
  }

  const firstMeeting = meetingPoints[0];
  const departureTime = useMemo(() => {
    if (!startPoint || !firstMeeting || !route?.legs?.[0]) return null;
    return new Date(new Date(firstMeeting.at).getTime() - (route.legs[0].duration + 10 * 60) * 1000);
  }, [firstMeeting, route, startPoint]);

  const googleUrl = useMemo(() => googleDirectionsUrl(startPoint, meetingPoints), [meetingPoints, startPoint]);
  const unmapped = visibleLeads.filter((lead) => !validCoords(lead.map_lat, lead.map_lng)).length;

  if (loading || !profile || !session) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-4">
        <section className="app-card flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Mapa handlowca
            </div>
            <h1 className="mt-1 text-2xl font-black text-ink">Leady i trasa spotkań</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              Leady bez dokładnego adresu są ustawiane na środku obszaru kodu pocztowego. Kilka leadów w tym samym miejscu tworzy jeden znacznik z liczbą.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[560px]">
            {users.length > 1 ? (
              <label>
                <span className="label">Handlowiec</span>
                <select className="field" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                </select>
              </label>
            ) : null}
            <label>
              <span className="label">Data spotkań</span>
              <input className="field" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="app-card flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary h-11 w-11 px-0" onClick={() => setSelectedDate((value) => shiftDate(value, -1))} aria-label="Poprzedni dzień"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" className="btn-secondary" onClick={() => setSelectedDate(dateKey(new Date()))}>Dziś</button>
            <button type="button" className="btn-secondary" onClick={() => setSelectedDate(shiftDate(dateKey(new Date()), 1))}>Jutro</button>
            <button type="button" className="btn-secondary h-11 w-11 px-0" onClick={() => setSelectedDate((value) => shiftDate(value, 1))} aria-label="Następny dzień"><ChevronRight className="h-4 w-4" /></button>
            <strong className="ml-1 capitalize">{formatDayLabel(selectedDate)}</strong>
          </div>
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm font-bold">
            <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />
            Pokaż umowy i rezygnacje
          </label>
        </section>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div> : null}

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className="app-muted-panel"><div className="text-xs font-bold uppercase text-muted">Leady</div><div className="mt-1 text-2xl font-black">{visibleLeads.length}</div></div>
              <div className="app-muted-panel"><div className="text-xs font-bold uppercase text-muted">Na mapie</div><div className="mt-1 text-2xl font-black">{leadPoints.length}</div></div>
              <div className="app-muted-panel"><div className="text-xs font-bold uppercase text-muted">Bez punktu</div><div className="mt-1 text-2xl font-black">{unmapped}</div></div>
              <div className="app-muted-panel"><div className="text-xs font-bold uppercase text-muted">Droga</div><div className="mt-1 text-2xl font-black">{route ? formatKm(route.distance) : "—"}</div></div>
              <div className="app-muted-panel"><div className="text-xs font-bold uppercase text-muted">Jazda</div><div className="mt-1 text-2xl font-black">{route ? formatDuration(route.duration) : "—"}</div></div>
            </div>

            {geoProgress.total > 0 ? (
              <div className="rounded-lg border border-sky/20 bg-sky/10 px-3 py-2 text-xs font-semibold text-ink">
                {geoProgress.active ? "Uzupełniam współrzędne po kodach pocztowych" : "Współrzędne tej partii uzupełnione"}: {geoProgress.done}/{geoProgress.total}.
              </div>
            ) : null}

            <LeadMapCanvas
              leads={leadPoints}
              meetings={meetingPoints}
              routeCoordinates={route?.coordinates || []}
              startPoint={startPoint}
            />

            <div className="text-xs text-muted">
              Liczba w niebieskim znaczniku oznacza kilka leadów w tej samej okolicy. Kliknij znacznik, żeby rozwinąć listę klientów. Czarno-żółte znaczniki 1, 2, 3… to spotkania w kolejności godzin.
            </div>
          </div>

          <aside className="grid content-start gap-3">
            <section className="app-card">
              <div className="flex items-center gap-2 font-black"><LocateFixed className="h-4 w-4" /> Punkt startowy</div>
              <p className="mt-1 text-xs text-muted">Potrzebny do policzenia godziny wyjazdu na pierwsze spotkanie.</p>
              <div className="mt-3 grid gap-2">
                <button type="button" className="btn-primary" onClick={locateMe} disabled={startBusy}><LocateFixed className="h-4 w-4" /> Użyj mojej lokalizacji</button>
                <div className="flex gap-2">
                  <input className="field min-w-0 flex-1" value={startAddress} onChange={(event) => setStartAddress(event.target.value)} placeholder="albo wpisz adres startowy" />
                  <button type="button" className="btn-secondary" onClick={geocodeStartAddress} disabled={startBusy || !startAddress.trim()}>Ustaw</button>
                </div>
                {startPoint ? <div className="text-xs font-semibold text-emerald-700">Start: {startPoint.label}</div> : null}
              </div>
            </section>

            <section className="app-card">
              <div className="flex items-center gap-2 font-black"><Route className="h-4 w-4" /> Plan dnia</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="app-muted-panel p-2"><span className="block text-xs text-muted">Spotkania</span><strong>{meetingsForDay.length}</strong></div>
                <div className="app-muted-panel p-2"><span className="block text-xs text-muted">Trasa</span><strong>{route ? formatKm(route.distance) : "—"}</strong></div>
                <div className="app-muted-panel p-2"><span className="block text-xs text-muted">Jazda</span><strong>{routeBusy ? "liczę…" : route ? formatDuration(route.duration) : "—"}</strong></div>
                <div className="app-muted-panel p-2"><span className="block text-xs text-muted">Wyjazd</span><strong>{departureTime ? formatTime(departureTime) : "ustaw start"}</strong></div>
              </div>
              {departureTime ? <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-bold text-amber-900">Godzina wyjazdu zawiera 10 minut zapasu.</div> : null}
              {googleUrl ? (
                <a href={googleUrl} target="_blank" rel="noreferrer" className="btn-primary mt-3 w-full justify-center">
                  <Navigation className="h-4 w-4" /> Otwórz cały dzień w Google Maps
                </a>
              ) : null}
            </section>

            <section className="app-card">
              <div className="flex items-center gap-2 font-black"><CalendarDays className="h-4 w-4" /> Spotkania</div>
              <div className="mt-3 grid gap-2">
                {meetingsForDay.length === 0 ? <div className="app-muted-panel text-sm text-muted">Brak spotkań w tym dniu.</div> : null}
                {meetingsForDay.map((lead, index) => {
                  const point = meetingPoints.find((item) => item.id === lead.id);
                  const legIndex = startPoint ? index : index - 1;
                  const leg = legIndex >= 0 ? route?.legs?.[legIndex] : null;
                  return (
                    <div key={lead.id} className="rounded-lg border border-line p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 font-black">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-white">{index + 1}</span>
                            {formatTime(lead.meeting_at || "")}
                          </div>
                          <Link href={`/leads/${lead.id}`} className="mt-1 block font-bold hover:underline">{lead.full_name}</Link>
                          <div className="mt-1 text-xs text-muted">{meetingAddress(lead)}</div>
                        </div>
                        <Clock3 className="h-4 w-4 text-muted" />
                      </div>
                      {leg ? <div className="mt-2 text-xs font-bold text-sky">Dojazd: {formatKm(leg.distance)} · {formatDuration(leg.duration)}</div> : null}
                      {point ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <a className="btn-secondary min-h-9 px-2 text-xs" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`}><ExternalLink className="h-3.5 w-3.5" /> Google</a>
                          <a className="btn-secondary min-h-9 px-2 text-xs" target="_blank" rel="noreferrer" href={`https://maps.apple.com/?daddr=${point.lat},${point.lng}&dirflg=d`}><ExternalLink className="h-3.5 w-3.5" /> Apple</a>
                        </div>
                      ) : <div className="mt-2 text-xs font-semibold text-amber-700">Ustalam lokalizację tego spotkania…</div>}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="app-card text-xs text-muted">
              <div className="flex items-center gap-2 font-black text-ink"><UsersRound className="h-4 w-4" /> Dane mapy</div>
              <p className="mt-2">Dla leadów głównym punktem jest kod pocztowy, więc klienci z tego samego kodu są grupowani. Spotkanie z pełnym adresem nadal dostaje dokładniejszy punkt.</p>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
