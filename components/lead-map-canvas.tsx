"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type LeadMapPoint = {
  id: string;
  name: string;
  phone: string;
  status: string;
  lat: number;
  lng: number;
  address: string;
  postalCode?: string;
  assigneeName?: string;
};

export type MeetingMapPoint = {
  id: string;
  name: string;
  phone: string;
  at: string;
  lat: number;
  lng: number;
  address: string;
  order: number;
};

type Props = {
  leads: LeadMapPoint[];
  meetings: MeetingMapPoint[];
  routeCoordinates: Array<[number, number]>;
  startPoint: { lat: number; lng: number; label: string } | null;
};

type MapUser = { id: string; full_name: string };
type AllMapResponse = {
  leads?: LeadMapPoint[];
  users?: MapUser[];
  canAssign?: boolean;
  truncated?: boolean;
  error?: string;
};

type LeafletLatLng = { lat: number; lng: number };

type LeafletLayer = {
  addTo: (map: LeafletMap) => LeafletLayer;
  bindPopup?: (html: string, options?: Record<string, unknown>) => LeafletLayer;
  openPopup?: () => LeafletLayer;
  on?: (event: string, handler: () => void) => LeafletLayer;
  remove?: () => void;
};

type LeafletMap = {
  fitBounds: (bounds: unknown, options?: Record<string, unknown>) => void;
  setView: (point: [number, number], zoom: number, options?: Record<string, unknown>) => void;
  getCenter: () => LeafletLatLng;
  getZoom: () => number;
  containerPointToLatLng: (point: [number, number]) => LeafletLatLng;
  on: (event: string, handler: () => void) => LeafletMap;
  remove: () => void;
};

type LeafletApi = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayer;
  marker: (point: [number, number], options?: Record<string, unknown>) => LeafletLayer;
  circleMarker: (point: [number, number], options?: Record<string, unknown>) => LeafletLayer;
  polyline: (points: Array<[number, number]>, options?: Record<string, unknown>) => LeafletLayer;
  polygon: (points: Array<[number, number]>, options?: Record<string, unknown>) => LeafletLayer;
  divIcon: (options?: Record<string, unknown>) => unknown;
  latLngBounds: (points: Array<[number, number]>) => unknown;
};

type MapViewState = {
  center: [number, number];
  zoom: number;
};

type ReturnContext = MapViewState & {
  popupKey: string;
};

type LeadGroup = {
  key: string;
  leads: LeadMapPoint[];
  basePoint: [number, number];
  point: [number, number];
};

type DrawPoint = { x: number; y: number };

const EMPTY_MEETINGS: MeetingMapPoint[] = [];
const EMPTY_ROUTE_COORDINATES: Array<[number, number]> = [];

declare global {
  interface Window {
    L?: LeafletApi;
    __bcrmLeafletPromise?: Promise<LeafletApi>;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ensureLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (window.__bcrmLeafletPromise) return window.__bcrmLeafletPromise;

  window.__bcrmLeafletPromise = new Promise<LeafletApi>((resolve, reject) => {
    const existingCss = document.querySelector('link[data-bcrm-leaflet="1"]');
    if (!existingCss) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.bcrmLeaflet = "1";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[data-bcrm-leaflet="1"]') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("Leaflet nie został załadowany.")), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Nie udało się załadować mapy.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.bcrmLeaflet = "1";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet nie został załadowany."));
    script.onerror = () => reject(new Error("Nie udało się załadować mapy."));
    document.body.appendChild(script);
  });

  return window.__bcrmLeafletPromise;
}

function statusColor(status: string) {
  if (status === "Spotkanie") return "#d97706";
  if (status === "Call back") return "#7c3aed";
  if (status === "Nie odebrał") return "#64748b";
  if (status === "Po spotkaniu") return "#0891b2";
  return "#2563eb";
}

function leadGroups(leads: LeadMapPoint[]) {
  const groups = new Map<string, LeadMapPoint[]>();
  for (const lead of leads) {
    const key = lead.postalCode
      ? `postal:${lead.postalCode}`
      : `coord:${lead.lat.toFixed(5)},${lead.lng.toFixed(5)}`;
    const current = groups.get(key) || [];
    current.push(lead);
    groups.set(key, current);
  }

  const result: LeadGroup[] = [...groups.entries()].map(([key, groupedLeads]) => ({
    key,
    leads: groupedLeads,
    basePoint: [groupedLeads[0].lat, groupedLeads[0].lng],
    point: [groupedLeads[0].lat, groupedLeads[0].lng]
  }));

  const collisions = new Map<string, LeadGroup[]>();
  for (const group of result) {
    const collisionKey = `${group.basePoint[0].toFixed(5)},${group.basePoint[1].toFixed(5)}`;
    const current = collisions.get(collisionKey) || [];
    current.push(group);
    collisions.set(collisionKey, current);
  }

  for (const colliding of collisions.values()) {
    if (colliding.length < 2) continue;
    const ordered = [...colliding].sort((a, b) => a.key.localeCompare(b.key));
    const baseLat = ordered[0].basePoint[0];
    const baseLng = ordered[0].basePoint[1];
    const lngScale = Math.max(Math.cos((baseLat * Math.PI) / 180), 0.35);

    ordered.forEach((group, index) => {
      const ring = Math.floor(index / 8);
      const slot = index % 8;
      const slotsInRing = Math.min(8, ordered.length - ring * 8);
      const radius = 0.0045 + ring * 0.0035;
      const angle = (2 * Math.PI * slot) / Math.max(slotsInRing, 1);
      group.point = [
        baseLat + Math.cos(angle) * radius,
        baseLng + (Math.sin(angle) * radius) / lngScale
      ];
    });
  }

  return result;
}

function clusterPopup(leads: LeadMapPoint[], popupKey: string) {
  const postal = leads.map((lead) => lead.postalCode).find(Boolean) || "";
  const shown = leads.slice(0, 40);
  const rows = shown.map((lead) =>
    `<a href="/leads/${encodeURIComponent(lead.id)}" data-bcrm-map-lead="${escapeHtml(lead.id)}" data-bcrm-map-popup="${escapeHtml(popupKey)}" style="display:block;padding:7px 0;border-top:1px solid #e5e7eb;text-decoration:none;color:#111827">` +
      `<strong>${escapeHtml(lead.name)}</strong>` +
      `<span style="display:block;font-size:12px;color:#111827;margin-top:2px">Tel. ${escapeHtml(lead.phone || "—")}</span>` +
      `<span style="display:block;font-size:12px;color:#667085;margin-top:2px">${escapeHtml(lead.status)}</span>` +
      (lead.assigneeName ? `<span style="display:block;font-size:12px;color:#475569;margin-top:2px">Handlowiec: ${escapeHtml(lead.assigneeName)}</span>` : "") +
    `</a>`
  ).join("");
  const extra = leads.length > shown.length
    ? `<div style="padding-top:8px;font-size:12px;color:#667085">+ ${leads.length - shown.length} kolejnych leadów</div>`
    : "";

  return `<div style="min-width:230px;max-width:300px;font-family:system-ui,sans-serif">` +
    `<div style="font-weight:800;margin-bottom:7px">${postal ? `Kod ${escapeHtml(postal)} · ` : ""}${leads.length} leadów</div>` +
    rows + extra +
  `</div>`;
}

function pointInPolygon(lat: number, lng: number, polygon: Array<[number, number]>) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const yi = polygon[index][0];
    const xi = polygon[index][1];
    const yj = polygon[previous][0];
    const xj = polygon[previous][1];
    const crosses = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

export function LeadMapCanvas({ leads, meetings, routeCoordinates, startPoint }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const popupLayersRef = useRef<Map<string, LeafletLayer>>(new Map());
  const selectionLayerRef = useRef<LeafletLayer | null>(null);
  const viewStateRef = useRef<MapViewState | null>(null);
  const activePopupKeyRef = useRef<string | null>(null);
  const returnContextRef = useRef<ReturnContext | null>(null);
  const drawingPointsRef = useRef<DrawPoint[]>([]);
  const drawingGeoPointsRef = useRef<Array<[number, number]>>([]);
  const drawingPointerIdRef = useRef<number | null>(null);
  const assignmentMadeRef = useRef(false);
  const [error, setError] = useState("");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [allLeads, setAllLeads] = useState<LeadMapPoint[]>([]);
  const [mapUsers, setMapUsers] = useState<MapUser[]>([]);
  const [canAssign, setCanAssign] = useState(false);
  const [allBusy, setAllBusy] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [allTruncated, setAllTruncated] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [assignTargetId, setAssignTargetId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const mapLeads = showAllLeads ? allLeads : leads;
  const mapMeetings = showAllLeads ? EMPTY_MEETINGS : meetings;
  const mapRouteCoordinates = showAllLeads ? EMPTY_ROUTE_COORDINATES : routeCoordinates;
  const mapStartPoint = showAllLeads ? null : startPoint;

  function rememberView(map = mapRef.current) {
    if (!map) return;
    const center = map.getCenter();
    viewStateRef.current = {
      center: [center.lat, center.lng],
      zoom: map.getZoom()
    };
  }

  function clearCanvas() {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function syncCanvasSize() {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  function drawCanvasPath(points: DrawPoint[], close = false) {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    syncCanvasSize();
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (points.length < 2) return;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    if (close) context.closePath();
    context.lineWidth = 4;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = "#f59e0b";
    context.stroke();
    if (close) {
      context.fillStyle = "rgba(245, 158, 11, 0.12)";
      context.fill();
    }
  }

  function clearAreaSelection(clearMessage = true) {
    selectionLayerRef.current?.remove?.();
    selectionLayerRef.current = null;
    drawingPointsRef.current = [];
    drawingGeoPointsRef.current = [];
    drawingPointerIdRef.current = null;
    setSelectedLeadIds([]);
    setDrawMode(false);
    if (clearMessage) {
      setActionMessage("");
      setActionError("");
    }
    clearCanvas();
  }

  async function authToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadAllMapLeads(force = false) {
    if (allLoaded && !force) return true;
    const token = await authToken();
    if (!token) {
      setActionError("Sesja wygasła. Odśwież CRM i spróbuj ponownie.");
      return false;
    }

    setAllBusy(true);
    setActionError("");
    try {
      const response = await fetch("/api/map/leads", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const body = (await response.json().catch(() => ({}))) as AllMapResponse;
      if (!response.ok) throw new Error(body.error || "Nie udało się pobrać wszystkich leadów.");
      setAllLeads(body.leads || []);
      setMapUsers(body.users || []);
      setCanAssign(Boolean(body.canAssign));
      setAllTruncated(Boolean(body.truncated));
      setAllLoaded(true);
      setAssignTargetId((current) => current || body.users?.[0]?.id || "");
      return true;
    } catch (loadError) {
      setActionError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać wszystkich leadów.");
      return false;
    } finally {
      setAllBusy(false);
    }
  }

  async function toggleAllLeads() {
    if (showAllLeads) {
      if (assignmentMadeRef.current) {
        window.location.reload();
        return;
      }
      clearAreaSelection();
      setShowAllLeads(false);
      setActionMessage("");
      return;
    }

    clearAreaSelection();
    const loaded = await loadAllMapLeads();
    if (loaded) {
      viewStateRef.current = null;
      setShowAllLeads(true);
    }
  }

  function startDrawingMode() {
    clearAreaSelection();
    syncCanvasSize();
    setActionMessage("");
    setActionError("");
    setDrawMode(true);
  }

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function beginArea(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawMode || !mapRef.current) return;
    const point = canvasPoint(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingPointerIdRef.current = event.pointerId;
    drawingPointsRef.current = [point];
    const geo = mapRef.current.containerPointToLatLng([point.x, point.y]);
    drawingGeoPointsRef.current = [[geo.lat, geo.lng]];
    drawCanvasPath(drawingPointsRef.current);
  }

  function extendArea(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawMode || drawingPointerIdRef.current !== event.pointerId || !mapRef.current) return;
    const point = canvasPoint(event);
    if (!point) return;
    event.preventDefault();
    const previous = drawingPointsRef.current[drawingPointsRef.current.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 4) return;
    drawingPointsRef.current.push(point);
    const geo = mapRef.current.containerPointToLatLng([point.x, point.y]);
    drawingGeoPointsRef.current.push([geo.lat, geo.lng]);
    drawCanvasPath(drawingPointsRef.current);
  }

  function finishArea(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawMode || drawingPointerIdRef.current !== event.pointerId || !mapRef.current) return;
    event.preventDefault();
    drawingPointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);

    const polygon = drawingGeoPointsRef.current;
    if (polygon.length < 3) {
      setActionError("Narysuj większą pętlę wokół leadów.");
      clearAreaSelection(false);
      return;
    }

    drawCanvasPath(drawingPointsRef.current, true);
    selectionLayerRef.current?.remove?.();
    selectionLayerRef.current = window.L?.polygon(polygon, {
      color: "#f59e0b",
      weight: 4,
      opacity: 0.95,
      fillColor: "#f59e0b",
      fillOpacity: 0.12
    }).addTo(mapRef.current) || null;

    const ids = mapLeads
      .filter((lead) => pointInPolygon(lead.lat, lead.lng, polygon))
      .map((lead) => lead.id);
    setSelectedLeadIds(ids);
    setDrawMode(false);
    clearCanvas();
    setActionError(ids.length === 0 ? "W zaznaczonym obszarze nie ma leadów." : "");
    if (ids.length > 0) setActionMessage(`Zaznaczono ${ids.length} ${ids.length === 1 ? "lead" : "leadów"}.`);
  }

  async function assignSelectedLeads() {
    if (!canAssign || selectedLeadIds.length === 0 || !assignTargetId || assignBusy) return;
    if (selectedLeadIds.length > 1000) {
      setActionError("Zaznacz mniejszy obszar — jednorazowo można przypisać maksymalnie 1000 leadów.");
      return;
    }

    const token = await authToken();
    if (!token) {
      setActionError("Sesja wygasła. Odśwież CRM i spróbuj ponownie.");
      return;
    }

    setAssignBusy(true);
    setActionError("");
    try {
      const response = await fetch("/api/leads/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ leadIds: selectedLeadIds, assignedTo: assignTargetId })
      });
      const body = (await response.json().catch(() => ({}))) as { updated?: number; error?: string };
      if (!response.ok) throw new Error(body.error || "Nie udało się przypisać leadów.");

      const targetName = mapUsers.find((user) => user.id === assignTargetId)?.full_name || "wybranego handlowca";
      const selectedSet = new Set(selectedLeadIds);
      setAllLeads((current) => current.map((lead) => selectedSet.has(lead.id) ? { ...lead, assigneeName: targetName } : lead));
      assignmentMadeRef.current = true;
      clearAreaSelection(false);
      setActionMessage(`Przypisano ${body.updated || selectedSet.size} ${selectedSet.size === 1 ? "lead" : "leadów"} do: ${targetName}.`);
    } catch (assignError) {
      setActionError(assignError instanceof Error ? assignError.message : "Nie udało się przypisać leadów.");
    } finally {
      setAssignBusy(false);
    }
  }

  function closeLeadModal() {
    const context = returnContextRef.current;
    setOpenLeadId(null);

    if (!context) return;
    viewStateRef.current = { center: context.center, zoom: context.zoom };
    activePopupKeyRef.current = context.popupKey;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const map = mapRef.current;
        if (!map) return;
        map.setView(context.center, context.zoom, { animate: false });
        popupLayersRef.current.get(context.popupKey)?.openPopup?.();
        returnContextRef.current = null;
      });
    });
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function interceptLeadOpen(event: MouseEvent) {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[data-bcrm-map-lead]") as HTMLAnchorElement | null;
      if (!link) return;
      const leadId = link.dataset.bcrmMapLead;
      const popupKey = link.dataset.bcrmMapPopup;
      if (!leadId || !popupKey) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const map = mapRef.current;
      if (map) {
        const center = map.getCenter();
        returnContextRef.current = {
          center: [center.lat, center.lng],
          zoom: map.getZoom(),
          popupKey
        };
        viewStateRef.current = {
          center: [center.lat, center.lng],
          zoom: map.getZoom()
        };
        activePopupKeyRef.current = popupKey;
      }

      setOpenLeadId(leadId);
    }

    container.addEventListener("click", interceptLeadOpen, true);
    return () => container.removeEventListener("click", interceptLeadOpen, true);
  }, []);

  useEffect(() => {
    if (!openLeadId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeLeadModal();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openLeadId]);

  useEffect(() => {
    if (!drawMode) return;
    syncCanvasSize();
    const resize = () => syncCanvasSize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [drawMode]);

  useEffect(() => {
    let active = true;
    let localMap: LeafletMap | null = null;

    async function renderMap() {
      if (!containerRef.current) return;
      try {
        const L = await ensureLeaflet();
        if (!active || !containerRef.current) return;

        selectionLayerRef.current = null;
        if (mapRef.current) {
          rememberView(mapRef.current);
          mapRef.current.remove();
          mapRef.current = null;
        }

        popupLayersRef.current = new Map();
        localMap = L.map(containerRef.current, { zoomControl: true, preferCanvas: true });
        mapRef.current = localMap;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap"
        }).addTo(localMap);

        const rememberLocalView = () => rememberView(localMap);
        localMap.on("moveend", rememberLocalView);
        localMap.on("zoomend", rememberLocalView);

        const bounds: Array<[number, number]> = [];

        for (const group of leadGroups(mapLeads)) {
          const first = group.leads[0];
          const point = group.point;
          const groupKey = `lead-group:${group.key}`;
          bounds.push(point);

          const count = group.leads.length;
          const size = count >= 100 ? 46 : count >= 10 ? 42 : count > 1 ? 38 : 28;
          const background = count > 1 ? "#2563eb" : statusColor(first.status);
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${background};color:#fff;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:800 ${count > 1 ? 13 : 11}px system-ui;box-shadow:0 4px 12px rgba(15,23,42,.25)">${count}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          });
          const marker = L.marker(point, { icon, zIndexOffset: count > 1 ? 500 : 420 }).addTo(localMap);
          marker.bindPopup?.(clusterPopup(group.leads, groupKey), { maxHeight: 360 });
          marker.on?.("popupopen", () => { activePopupKeyRef.current = groupKey; });
          marker.on?.("popupclose", () => {
            if (!returnContextRef.current && activePopupKeyRef.current === groupKey) activePopupKeyRef.current = null;
          });
          popupLayersRef.current.set(groupKey, marker);
        }

        for (const meeting of mapMeetings) {
          const point: [number, number] = [meeting.lat, meeting.lng];
          const popupKey = `meeting:${meeting.id}`;
          bounds.push(point);
          const time = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(new Date(meeting.at));
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:38px;height:38px;border-radius:19px;background:#111827;color:#fff;border:3px solid #fbbf24;display:flex;align-items:center;justify-content:center;font:800 14px system-ui;box-shadow:0 4px 12px rgba(0,0,0,.28)">${meeting.order}</div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
          });
          const marker = L.marker(point, { icon, zIndexOffset: 1000 }).addTo(localMap);
          marker.bindPopup?.(
            `<div style="min-width:210px;font-family:system-ui,sans-serif">` +
              `<strong>${meeting.order}. ${time} · ${escapeHtml(meeting.name)}</strong><br>` +
              `<span style="color:#111827">Tel. ${escapeHtml(meeting.phone || "—")}</span><br>` +
              `<span style="color:#667085">${escapeHtml(meeting.address)}</span><br>` +
              `<a href="/leads/${encodeURIComponent(meeting.id)}" data-bcrm-map-lead="${escapeHtml(meeting.id)}" data-bcrm-map-popup="${escapeHtml(popupKey)}" style="display:inline-block;margin-top:8px;font-weight:700">Otwórz spotkanie →</a>` +
            `</div>`
          );
          marker.on?.("popupopen", () => { activePopupKeyRef.current = popupKey; });
          marker.on?.("popupclose", () => {
            if (!returnContextRef.current && activePopupKeyRef.current === popupKey) activePopupKeyRef.current = null;
          });
          popupLayersRef.current.set(popupKey, marker);
        }

        if (mapStartPoint) {
          const point: [number, number] = [mapStartPoint.lat, mapStartPoint.lng];
          bounds.push(point);
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:34px;height:34px;border-radius:17px;background:#16a34a;color:#fff;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:900 9px system-ui;box-shadow:0 4px 10px rgba(0,0,0,.25)">START</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
          L.marker(point, { icon, zIndexOffset: 1200 }).addTo(localMap).bindPopup?.(`<strong>${escapeHtml(mapStartPoint.label)}</strong>`);
        }

        if (mapRouteCoordinates.length >= 2) {
          L.polyline(mapRouteCoordinates, { color: "#111827", weight: 5, opacity: 0.78 }).addTo(localMap);
        }

        const returnContext = returnContextRef.current;
        const savedView = returnContext
          ? { center: returnContext.center, zoom: returnContext.zoom }
          : viewStateRef.current;

        if (savedView) {
          localMap.setView(savedView.center, savedView.zoom, { animate: false });
        } else if (bounds.length > 0) {
          localMap.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 14 });
        } else {
          localMap.setView([52.1, 19.4], 6);
        }

        const popupKeyToRestore = returnContext?.popupKey || activePopupKeyRef.current;
        if (popupKeyToRestore) {
          window.requestAnimationFrame(() => {
            popupLayersRef.current.get(popupKeyToRestore)?.openPopup?.();
          });
        }
      } catch (mapError) {
        setError(mapError instanceof Error ? mapError.message : "Nie udało się załadować mapy.");
      }
    }

    void renderMap();
    return () => {
      active = false;
      if (localMap) {
        rememberView(localMap);
        localMap.remove();
      }
      if (mapRef.current === localMap) mapRef.current = null;
    };
  }, [mapLeads, mapMeetings, mapRouteCoordinates, mapStartPoint]);

  if (error) {
    return <div className="flex min-h-[58vh] items-center justify-center rounded-xl border border-line bg-panel p-6 text-sm font-semibold text-red-700">{error}</div>;
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2 shadow-sm">
        <button type="button" className={showAllLeads ? "btn-primary" : "btn-secondary"} onClick={toggleAllLeads} disabled={allBusy}>
          {allBusy ? "Ładuję leady…" : showAllLeads ? "Wróć do handlowca" : "Pokaż wszystkie leady"}
        </button>
        {showAllLeads ? (
          <>
            <span className="rounded-lg bg-[#eef2f6] px-3 py-2 text-xs font-black text-ink">Na mapie: {mapLeads.length} leadów</span>
            {allTruncated ? <span className="text-xs font-semibold text-amber-700">Pokazuję maks. 3000 najnowszych leadów.</span> : null}
            {canAssign ? (
              <button type="button" className={drawMode ? "btn-primary" : "btn-secondary"} onClick={drawMode ? () => clearAreaSelection() : startDrawingMode} disabled={mapLeads.length === 0}>
                {drawMode ? "Anuluj rysowanie" : "Zaznacz pętlą"}
              </button>
            ) : null}
          </>
        ) : (
          <span className="text-xs font-semibold text-muted">Tryb handlowca: leady + spotkania + trasa.</span>
        )}
      </div>

      {showAllLeads && canAssign && (selectedLeadIds.length > 0 || actionMessage || actionError) ? (
        <div className="mb-2 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,280px)_auto_auto] sm:items-end">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-amber-900">Zaznaczony obszar</div>
            <div className="mt-1 text-sm font-bold text-ink">
              {selectedLeadIds.length > 0 ? `${selectedLeadIds.length} ${selectedLeadIds.length === 1 ? "lead" : "leadów"}` : actionMessage || "Brak zaznaczenia"}
            </div>
            {actionError ? <div className="mt-1 text-xs font-semibold text-red-700">{actionError}</div> : null}
            {!actionError && actionMessage ? <div className="mt-1 text-xs font-semibold text-emerald-700">{actionMessage}</div> : null}
          </div>
          <label>
            <span className="label">Przypisz do handlowca</span>
            <select className="field" value={assignTargetId} onChange={(event) => setAssignTargetId(event.target.value)} disabled={assignBusy || mapUsers.length === 0}>
              {mapUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
            </select>
          </label>
          <button type="button" className="btn-primary" onClick={assignSelectedLeads} disabled={assignBusy || selectedLeadIds.length === 0 || selectedLeadIds.length > 1000 || !assignTargetId}>
            {assignBusy ? "Przypisuję…" : "Przypisz leady"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => clearAreaSelection()} disabled={assignBusy}>Wyczyść</button>
        </div>
      ) : null}

      {showAllLeads && drawMode ? (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
          Przyłóż palec do mapy i narysuj zamkniętą pętlę wokół leadów. Po puszczeniu palca CRM zaznaczy wszystkie leady wewnątrz.
        </div>
      ) : null}

      {actionError && !(showAllLeads && canAssign && (selectedLeadIds.length > 0 || actionMessage || actionError)) ? (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{actionError}</div>
      ) : null}

      <div className="relative">
        <div ref={containerRef} className="h-[64dvh] min-h-[520px] w-full overflow-hidden rounded-xl border border-line bg-[#eef2f6] shadow-sm" />
        <canvas
          ref={drawingCanvasRef}
          className="absolute inset-0 z-[900] h-full w-full rounded-xl"
          style={{ pointerEvents: drawMode ? "auto" : "none", touchAction: "none", cursor: drawMode ? "crosshair" : "default" }}
          onPointerDown={beginArea}
          onPointerMove={extendArea}
          onPointerUp={finishArea}
          onPointerCancel={(event) => {
            if (drawingPointerIdRef.current === event.pointerId) clearAreaSelection(false);
          }}
          aria-label="Rysowanie obszaru wyboru leadów"
        />
      </div>

      {openLeadId ? (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Szczegóły leada">
          <button
            type="button"
            className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]"
            aria-label="Zamknij szczegóły leada"
            onClick={closeLeadModal}
          />
          <div className="relative z-10 flex h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-line bg-white shadow-2xl">
            <div className="flex min-h-12 items-center justify-between border-b border-line bg-white px-3 sm:px-4">
              <div className="text-sm font-black text-ink">Szczegóły leada</div>
              <div className="flex items-center gap-2">
                <a
                  href={`/leads/${encodeURIComponent(openLeadId)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary min-h-9 px-3 text-xs"
                >
                  Otwórz osobno
                </a>
                <button
                  type="button"
                  className="btn-icon h-9 w-9"
                  onClick={closeLeadModal}
                  aria-label="Zamknij"
                  title="Zamknij"
                >
                  ×
                </button>
              </div>
            </div>
            <iframe
              key={openLeadId}
              src={`/leads/${encodeURIComponent(openLeadId)}?embedded=1`}
              title="Szczegóły leada"
              className="min-h-0 flex-1 border-0 bg-[#f5f7fa]"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
