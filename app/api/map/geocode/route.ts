import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { canAccessLeadWithTeam, getServiceClient, requireApiProfile } from "@/lib/server-auth";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["owner", "admin", "menadzer", "handlowiec"]);
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const ZIPPOPOTAM_URL = "https://api.zippopotam.us/PL";

type GeocodeKind = "lead" | "meeting";

type GeocodeResult = {
  lat: string;
  lon: string;
  display_name?: string;
};

type ZippopotamPlace = {
  "place name"?: string;
  latitude?: string;
  longitude?: string;
};

type ZippopotamResponse = {
  places?: ZippopotamPlace[];
};

function clean(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePostalCode(value: string | null | undefined) {
  const text = clean(value);
  const match = text.match(/(\d{2})\D?(\d{3})/);
  return match ? `${match[1]}-${match[2]}` : "";
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
  const postal = normalizePostalCode(lead.postal_code);
  if (postal) return `postal:${postal}`;
  const parts = [clean(lead.address), clean(lead.county), clean(lead.voivodeship), "Polska"];
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
  const postal = normalizePostalCode(lead.postal_code);
  if (!meetingAddress) return postal ? `postal:${postal}` : composeLeadQuery(lead);
  const parts = [meetingAddress, postal, clean(lead.county), clean(lead.voivodeship), "Polska"];
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
  return { lat, lng, label: first.display_name || query, source: "nominatim", throttle: true };
}

async function lookupPostalCode(postalCode: string) {
  const response = await fetch(`${ZIPPOPOTAM_URL}/${encodeURIComponent(postalCode)}`, {
    headers: { Accept: "application/json" },
    cache: "force-cache",
    next: { revalidate: 30 * 24 * 60 * 60 }
  });
  if (!response.ok) return null;
  const body = (await response.json()) as ZippopotamResponse;
  const points = (body.places || [])
    .map((place) => ({
      lat: Number(place.latitude),
      lng: Number(place.longitude),
      name: clean(place["place name"])
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (points.length === 0) return null;
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
  return {
    lat,
    lng,
    label: points.map((point) => point.name).filter(Boolean).slice(0, 3).join(", ") || postalCode,
    source: "zippopotam",
    throttle: false
  };
}

async function geocodeWithCache(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  query: string
) {
  const key = queryKey(query);
  const { data: cached } = await supabaseAdmin
    .from("map_geocode_cache")
    .select("lat,lng,source")
    .eq("query_key", key)
    .maybeSingle();

  if (cached && Number.isFinite(Number(cached.lat)) && Number.isFinite(Number(cached.lng))) {
    return {
      lat: Number(cached.lat),
      lng: Number(cached.lng),
      cached: true,
      source: cached.source || "cache",
      throttle: false
    };
  }

  const postalMatch = query.match(/^postal:(\d{2}-\d{3})$/i);
  let found = postalMatch ? await lookupPostalCode(postalMatch[1]) : await lookupNominatim(query);

  if (!found && postalMatch) {
    found = await lookupNominatim(`${postalMatch[1]}, Polska`);
  }
  if (!found) return null;

  await supabaseAdmin.from("map_geocode_cache").upsert({
    query_key: key,
    query_text: query,
    lat: found.lat,
    lng: found.lng,
    source: found.source
  });

  return { lat: found.lat, lng: found.lng, cached: false, source: found.source, throttle: found.throttle };
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
      const rawQuery = clean(body.query).slice(0, 300);
      if (!rawQuery) return NextResponse.json({ error: "Podaj adres." }, { status: 400 });
      const postal = normalizePostalCode(rawQuery);
      const fullQuery = postal && rawQuery.replace(/[^0-9]/g, "").length <= 5
        ? `postal:${postal}`
        : /polsk/i.test(rawQuery) ? rawQuery : `${rawQuery}, Polska`;
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

    let result = await geocodeWithCache(auth.supabaseAdmin, query);
    const postalCode = normalizePostalCode(lead.postal_code);

    if (!result && kind === "meeting" && postalCode) {
      result = await geocodeWithCache(auth.supabaseAdmin, `postal:${postalCode}`);
    }

    const geocodedAt = new Date().toISOString();
    const effectiveQuery = result && kind === "meeting" && query !== `postal:${postalCode}` && result.source === "zippopotam"
      ? `postal:${postalCode}`
      : query;

    if (kind === "lead" && postalCode && result) {
      const [postalPrefix, postalSuffix] = postalCode.split("-");
      const { error: groupUpdateError } = await auth.supabaseAdmin
        .from("leads")
        .update({
          map_lat: result.lat,
          map_lng: result.lng,
          map_geocoded_at: geocodedAt,
          map_geocode_query: `postal:${postalCode}`
        })
        .eq("crm_environment", lead.crm_environment)
        .ilike("postal_code", `%${postalPrefix}%${postalSuffix}%`);
      if (groupUpdateError) throw new Error(groupUpdateError.message);
    } else {
      const update = kind === "meeting"
        ? {
            meeting_map_lat: result?.lat ?? null,
            meeting_map_lng: result?.lng ?? null,
            meeting_map_geocoded_at: geocodedAt,
            meeting_map_geocode_query: effectiveQuery
          }
        : {
            map_lat: result?.lat ?? null,
            map_lng: result?.lng ?? null,
            map_geocoded_at: geocodedAt,
            map_geocode_query: effectiveQuery
          };

      const { error: updateError } = await auth.supabaseAdmin.from("leads").update(update).eq("id", lead.id);
      if (updateError) throw new Error(updateError.message);
    }

    if (!result) return NextResponse.json({ found: false, kind, query, postalCode, geocodedAt });
    return NextResponse.json({ found: true, kind, query: effectiveQuery, postalCode, geocodedAt, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się ustalić lokalizacji." },
      { status: 500 }
    );
  }
}
