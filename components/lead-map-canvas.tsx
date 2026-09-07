"use client";

import { useEffect, useRef, useState } from "react";

export type LeadMapPoint = {
  id: string;
  name: string;
  status: string;
  lat: number;
  lng: number;
  address: string;
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
  bindPopup?: (html: string) => LeafletLayer;
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

export function LeadMapCanvas({ leads, meetings, routeCoordinates, startPoint }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [error, setError] = useState("");

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

        for (const lead of leads) {
          const point: [number, number] = [lead.lat, lead.lng];
          bounds.push(point);
          const marker = L.circleMarker(point, {
            radius: 6,
            weight: 2,
            color: "#ffffff",
            fillColor: statusColor(lead.status),
            fillOpacity: 0.9
          }).addTo(localMap);
          marker.bindPopup?.(
            `<div style="min-width:190px;font-family:system-ui,sans-serif">` +
              `<strong>${escapeHtml(lead.name)}</strong><br>` +
              `<span>${escapeHtml(lead.status)}</span><br>` +
              `<span style="color:#667085">${escapeHtml(lead.address || "Brak dokładnego adresu")}</span><br>` +
              `<a href="/leads/${encodeURIComponent(lead.id)}" style="display:inline-block;margin-top:8px;font-weight:700">Otwórz lead →</a>` +
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
              `<a href="/leads/${encodeURIComponent(meeting.id)}" style="display:inline-block;margin-top:8px;font-weight:700">Otwórz spotkanie →</a>` +
            `</div>`
          );
        }

        if (startPoint) {
          const point: [number, number] = [startPoint.lat, startPoint.lng];
          bounds.push(point);
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:30px;height:30px;border-radius:15px;background:#16a34a;color:#fff;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:900 11px system-ui;box-shadow:0 4px 10px rgba(0,0,0,.25)">START</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
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

  return <div ref={containerRef} className="h-[64dvh] min-h-[520px] w-full overflow-hidden rounded-xl border border-line bg-[#eef2f6] shadow-sm" />;
}
