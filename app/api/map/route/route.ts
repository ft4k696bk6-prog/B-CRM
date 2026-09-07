import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["owner", "admin", "menadzer", "handlowiec"]);

type Point = { lat: number; lng: number };

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates?: Array<[number, number]> };
    legs?: Array<{ distance: number; duration: number }>;
  }>;
};

function validPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Point>;
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Number(point.lat) >= -90 && Number(point.lat) <= 90 && Number(point.lng) >= -180 && Number(point.lng) <= 180;
}

function haversine(a: Point, b: Point) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function approximateRoute(points: Point[]) {
  const legs = points.slice(1).map((point, index) => {
    const direct = haversine(points[index], point);
    const distance = direct * 1.22;
    const duration = distance / (55_000 / 3600);
    return { distance, duration };
  });
  return {
    distance: legs.reduce((sum, leg) => sum + leg.distance, 0),
    duration: legs.reduce((sum, leg) => sum + leg.duration, 0),
    legs,
    coordinates: points.map((point) => [point.lat, point.lng] as [number, number]),
    approximate: true
  };
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (!ALLOWED_ROLES.has(auth.profile.role)) {
    return NextResponse.json({ error: "Brak dostępu do mapy." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { points?: unknown[] };
  const points = (body.points || []).filter(validPoint).slice(0, 14);
  if (points.length < 2) return NextResponse.json({ error: "Trasa wymaga co najmniej dwóch punktów." }, { status: 400 });

  try {
    const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
    const response = await fetch(url, {
      headers: { "User-Agent": "B-CRM-ReEnergy/1.0" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Router HTTP ${response.status}`);
    const data = (await response.json()) as OsrmResponse;
    const route = data.routes?.[0];
    if (!route) throw new Error(data.code || "Brak trasy");

    return NextResponse.json({
      distance: route.distance,
      duration: route.duration,
      legs: route.legs || [],
      coordinates: (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]),
      approximate: false
    });
  } catch {
    return NextResponse.json(approximateRoute(points));
  }
}
