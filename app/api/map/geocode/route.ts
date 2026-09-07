import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { canAccessLeadWithTeam, requireApiProfile } from "@/lib/server-auth";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["owner", "admin", "menadzer", "handlowiec"]);
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

type GeocodeKind = "lead" | "meeting";

type GeocodeResult = {
  lat: string;
  lon: string;
  display_name?: string;
};

function clean(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeQuery(value: string) {
  return clean(value).toLocaleLowerCase("pl-PL");
}

function queryKey(value: string) {
  return createHash("sha256").update(normalizeQuery(value)).digest("hex");
}

function composeLeadQuery(lead: {
  address: string | null;
  postal_code: string | null;
  county: string | null;
  voivodeship: string | null;
}) {
  const parts = [clean(lead.address), clean(lead.postal_code), clean(lead.county), clean(lead.voivodeship), "Polska"];
  return parts.filter(Boolean).join(", ");
}

function composeMeetingQuery(lead: {
  meeting_address: string | null;
  address: string | null;
  postal_code: string | null;
  county: string | null;
  voivodeship: string | null;
}) {
  const meetingAddress = clean(lead.meeting_address);
  if (!meetingAddress) return composeLeadQuery(lead);
  const parts = [meetingAddress, clean(lead.postal_code), clean(lead.county), clean(lead.voivodeship), "Polska"];
  return parts.filter(Boolean).join(", ");
}

async function lookupNominatim(query: string) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "pl",
    addressdetails: "0"
  });
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "pl",
      "User-Agent": "B-CRM-ReEnergy/1.0"
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}`);
  const rows = (await response.json()) as GeocodeResult[];
  const first = rows[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: first.display_name || query };
}

async function geocodeWithCache(
  supabaseAdmin: Awaited<ReturnType<typeof requireApiProfile>> extends { supabaseAdmin: infer T } ? T : never,
  query: string
) {
  const key = queryKey(query);
  const { data: cached } = await supabaseAdmin
    .from("map_geocode_cache")
    .select("lat,lng,source")
    .eq("query_key", key)
    .maybeSingle();

  if (cached && Number.isFinite(Number(cached.lat)) && Number.isFinite(Number(cached.lng))) {
    return { lat: Number(cached.lat), lng: Number(cached.lng), cached: true, source: cached.source || "cache" };
  }

  const found = await lookupNominatim(query);
  if (!found) return null;

  await supabaseAdmin.from("map_geocode_cache").upsert({
    query_key: key,
    query_text: query,
    lat: found.lat,
    lng: found.lng,
    source: "nominatim"
  });

  return { lat: found.lat, lng: found.lng, cached: false, source: "nominatim" };
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (!ALLOWED_ROLES.has(auth.profile.role)) {
    return NextResponse.json({ error: "Brak dostępu do mapy." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    leadId?: string;
    kind?: GeocodeKind;
    query?: string;
  };

  try {
    if (!body.leadId) {
      const query = clean(body.query).slice(0, 300);
      if (!query) return NextResponse.json({ error: "Podaj adres." }, { status: 400 });
      const fullQuery = /polsk/i.test(query) ? query : `${query}, Polska`;
      const result = await geocodeWithCache(auth.supabaseAdmin, fullQuery);
      if (!result) return NextResponse.json({ found: false, query: fullQuery });
      return NextResponse.json({ found: true, query: fullQuery, ...result });
    }

    const kind: GeocodeKind = body.kind === "meeting" ? "meeting" : "lead";
    const { data: lead, error } = await auth.supabaseAdmin
      .from("leads")
      .select("id,address,postal_code,county,voivodeship,meeting_address,assigned_to,crm_environment")
      .eq("id", body.leadId)
      .maybeSingle();

    if (error || !lead) return NextResponse.json({ error: "Nie znaleziono leada." }, { status: 404 });
    if (!(await canAccessLeadWithTeam(auth.supabaseAdmin, auth.profile, lead))) {
      return NextResponse.json({ error: "Brak dostępu do leada." }, { status: 403 });
    }

    const query = kind === "meeting" ? composeMeetingQuery(lead) : composeLeadQuery(lead);
    if (!query || query === "Polska") {
      return NextResponse.json({ found: false, query: "", geocodedAt: new Date().toISOString() });
    }

    const result = await geocodeWithCache(auth.supabaseAdmin, query);
    const geocodedAt = new Date().toISOString();
    const update = kind === "meeting"
      ? {
          meeting_map_lat: result?.lat ?? null,
          meeting_map_lng: result?.lng ?? null,
          meeting_map_geocoded_at: geocodedAt,
          meeting_map_geocode_query: query
        }
      : {
          map_lat: result?.lat ?? null,
          map_lng: result?.lng ?? null,
          map_geocoded_at: geocodedAt,
          map_geocode_query: query
        };

    const { error: updateError } = await auth.supabaseAdmin.from("leads").update(update).eq("id", lead.id);
    if (updateError) throw new Error(updateError.message);

    if (!result) return NextResponse.json({ found: false, kind, query, geocodedAt });
    return NextResponse.json({ found: true, kind, query, geocodedAt, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się ustalić lokalizacji." },
      { status: 500 }
    );
  }
}
