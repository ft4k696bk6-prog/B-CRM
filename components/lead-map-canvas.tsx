"use client";

import { useEffect, useRef, useState } from "react";

export type LeadMapPoint = {
  id: string;
  name: string;
  status: string;
  lat: number;
  lng: number;
  address: string;
  postalCode?: string;
};

export type MeetingMapPoint = {
  id: string;
  name: string;
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

type LeafletLayer = {
  addTo: (map: LeafletMap) => LeafletLayer;
  bindPopup?: (html: string, options?: Record<string, unknown>) => LeafletLayer;
};

type LeafletMap = {
  fitBounds: (bounds: unknown, options?: Record<string, unknown>) => void;
  setView: (point: [number, number], zoom: number) => void;
  remove: () => void;
};

type LeafletApi = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayer;
  marker: (point: [number, number], options?: Record<string, unknown>) => LeafletLayer;
  circleMarker: (point: [number, number], options?: Record<string, unknown>) => LeafletLayer;
  polyline: (points: Array<[number, number]>, options?: Record<string, unknown>) => LeafletLayer;
  divIcon: (options?: Record<string, unknown>) => unknown;
  latLngBounds: (points: Array<[number, number]>) => unknown;
};

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
    const key = `${lead.lat.toFixed(5)},${lead.lng.toFixed(5)}`;
    const current = groups.get(key) || [];
    current.push(lead);
    groups.set(key, current);
  }
  return [...groups.values()];
}

function clusterPopup(leads: LeadMapPoint[]) {
  const postal = leads.map((lead) => lead.postalCode).find(Boolean) || "";
  const shown = leads.slice(0, 40);
  const rows = shown.map((lead) =>
    `<a href="/leads/${encodeURIComponent(lead.id)}" data-bcrm-map-lead="${escapeHtml(lead.id)}" style="display:block;padding:7px 0;border-top:1px solid #e5e7eb;text-decoration:none;color:#111827">` +
      `<strong>${escapeHtml(lead.name)}</strong>` +
      `<span style="display:block;font-size:12px;color:#667085;margin-top:2px">${escapeHtml(lead.status)}</span>` +
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

export function LeadMapCanvas({ leads, meetings, routeCoordinates, startPoint }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [error, setError] = useState("");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function interceptLeadOpen(event: MouseEvent) {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[data-bcrm-map-lead]") as HTMLAnchorElement | null;
      if (!link) return;
      const leadId = link.dataset.bcrmMapLead;
      if (!leadId) return;
      event.preventDefault();
      event.stopPropagation();
      setOpenLeadId(leadId);
    }

    container.addEventListener("click", interceptLeadOpen);
    return () => container.removeEventListener("click", interceptLeadOpen);
  }, []);

  useEffect(() => {
    if (!openLeadId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenLeadId(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openLeadId]);

  useEffect(() => {
    let active = true;
    let localMap: LeafletMap | null = null;

    async function renderMap() {
      if (!containerRef.current) return;
      try {
        const L = await ensureLeaflet();
        if (!active || !containerRef.current) return;

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        localMap = L.map(containerRef.current, { zoomControl: true, preferCanvas: true });
        mapRef.current = localMap;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap"
        }).addTo(localMap);

        const bounds: Array<[number, number]> = [];

        for (const group of leadGroups(leads)) {
          const first = group[0];
          const point: [number, number] = [first.lat, first.lng];
          bounds.push(point);

          if (group.length > 1) {
            const size = group.length >= 100 ? 46 : group.length >= 10 ? 42 : 38;
            const icon = L.divIcon({
              className: "",
              html: `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:#2563eb;color:#fff;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:800 13px system-ui;box-shadow:0 4px 12px rgba(15,23,42,.25)">${group.length}</div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2]
            });
            L.marker(point, { icon, zIndexOffset: 500 })
              .addTo(localMap)
              .bindPopup?.(clusterPopup(group), { maxHeight: 360 });
            continue;
          }

          const lead = first;
          const marker = L.circleMarker(point, {
            radius: 6,
            weight: 2,
            color: "#ffffff",
            fillColor: statusColor(lead.status),
            fillOpacity: 0.92
          }).addTo(localMap);
          marker.bindPopup?.(
            `<div style="min-width:190px;font-family:system-ui,sans-serif">` +
              `<strong>${escapeHtml(lead.name)}</strong><br>` +
              `<span>${escapeHtml(lead.status)}</span><br>` +
              `<span style="color:#667085">${escapeHtml(lead.address || lead.postalCode || "Brak dokładnego adresu")}</span><br>` +
              `<a href="/leads/${encodeURIComponent(lead.id)}" data-bcrm-map-lead="${escapeHtml(lead.id)}" style="display:inline-block;margin-top:8px;font-weight:700">Otwórz lead →</a>` +
            `</div>`
          );
        }

        for (const meeting of meetings) {
          const point: [number, number] = [meeting.lat, meeting.lng];
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
              `<span style="color:#667085">${escapeHtml(meeting.address)}</span><br>` +
              `<a href="/leads/${encodeURIComponent(meeting.id)}" data-bcrm-map-lead="${escapeHtml(meeting.id)}" style="display:inline-block;margin-top:8px;font-weight:700">Otwórz spotkanie →</a>` +
            `</div>`
          );
        }

        if (startPoint) {
          const point: [number, number] = [startPoint.lat, startPoint.lng];
          bounds.push(point);
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:34px;height:34px;border-radius:17px;background:#16a34a;color:#fff;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:900 9px system-ui;box-shadow:0 4px 10px rgba(0,0,0,.25)">START</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
          L.marker(point, { icon, zIndexOffset: 1200 }).addTo(localMap).bindPopup?.(`<strong>${escapeHtml(startPoint.label)}</strong>`);
        }

        if (routeCoordinates.length >= 2) {
          L.polyline(routeCoordinates, { color: "#111827", weight: 5, opacity: 0.78 }).addTo(localMap);
        }

        if (bounds.length > 0) {
          localMap.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 14 });
        } else {
          localMap.setView([52.1, 19.4], 6);
        }
      } catch (mapError) {
        setError(mapError instanceof Error ? mapError.message : "Nie udało się załadować mapy.");
      }
    }

    void renderMap();
    return () => {
      active = false;
      if (localMap) localMap.remove();
      if (mapRef.current === localMap) mapRef.current = null;
    };
  }, [leads, meetings, routeCoordinates, startPoint]);

  if (error) {
    return <div className="flex min-h-[58vh] items-center justify-center rounded-xl border border-line bg-panel p-6 text-sm font-semibold text-red-700">{error}</div>;
  }

  return (
    <>
      <div ref={containerRef} className="h-[64dvh] min-h-[520px] w-full overflow-hidden rounded-xl border border-line bg-[#eef2f6] shadow-sm" />

      {openLeadId ? (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Szczegóły leada">
          <button
            type="button"
            className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]"
            aria-label="Zamknij szczegóły leada"
            onClick={() => setOpenLeadId(null)}
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
                  onClick={() => setOpenLeadId(null)}
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
