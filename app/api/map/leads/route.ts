import { NextResponse } from "next/server";
import { managerTeamIds, requireApiProfile } from "@/lib/server-auth";
import type { Lead, Profile } from "@/lib/types";

type MapLeadRow = Pick<
  Lead,
  "id" | "full_name" | "phone" | "postal_code" | "address" | "status" | "assigned_to"
> & {
  map_lat: number | null;
  map_lng: number | null;
  is_cold_pool: boolean | null;
};

type MapUser = Pick<Profile, "id" | "full_name" | "role" | "manager_id">;

const ACTIVE_EXCLUDED_STATUSES = new Set(["Umowa", "Rezygnacja"]);
const MAP_PAGE_SIZE = 1000;
const MAP_MAX_LEADS = 3000;
const SALES_ROLES = new Set(["handlowiec", "sales"]);

function validCoords(lat: number | null, lng: number | null) {
  if (lat === null || lng === null) return false;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && !(latitude === 0 && longitude === 0);
}

function normalizePostalCode(value: string | null) {
  const match = String(value || "").match(/(\d{2})\D?(\d{3})/);
  return match ? `${match[1]}-${match[2]}` : undefined;
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if ("error" in auth) return auth.error;

    const { supabaseAdmin, profile } = auth;
    const { data: peopleData, error: peopleError } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,role,manager_id")
      .eq("crm_environment", profile.crm_environment)
      .in("role", ["handlowiec", "sales", "menadzer", "manager"])
      .order("full_name", { ascending: true });

    if (peopleError) {
      return NextResponse.json({ error: peopleError.message }, { status: 400 });
    }

    const people = (peopleData || []) as MapUser[];
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const teamIds = profile.role === "menadzer"
      ? await managerTeamIds(supabaseAdmin, profile)
      : undefined;

    const assignableUsers = people.filter((person) => {
      if (!SALES_ROLES.has(person.role)) return false;
      if (profile.role === "menadzer") return person.manager_id === profile.id;
      if (profile.role === "handlowiec") return person.id === profile.id;
      return true;
    });

    const collected: MapLeadRow[] = [];
    for (let from = 0; from < MAP_MAX_LEADS; from += MAP_PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("id,full_name,phone,postal_code,address,status,assigned_to,map_lat,map_lng,is_cold_pool")
        .eq("crm_environment", profile.crm_environment)
        .not("map_lat", "is", null)
        .not("map_lng", "is", null)
        .order("updated_at", { ascending: false })
        .range(from, Math.min(from + MAP_PAGE_SIZE - 1, MAP_MAX_LEADS - 1));

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      const page = (data || []) as MapLeadRow[];
      collected.push(...page);
      if (page.length < MAP_PAGE_SIZE) break;
    }

    const visible = collected.filter((lead) => {
      if (lead.is_cold_pool || ACTIVE_EXCLUDED_STATUSES.has(lead.status)) return false;
      if (!validCoords(lead.map_lat, lead.map_lng)) return false;
      if (profile.role === "owner" || profile.role === "admin") return true;
      if (profile.role === "menadzer") {
        return lead.assigned_to === null || lead.assigned_to === profile.id || Boolean(lead.assigned_to && teamIds?.has(lead.assigned_to));
      }
      return lead.assigned_to === profile.id;
    });

    return NextResponse.json({
      canAssign: ["owner", "admin", "menadzer"].includes(profile.role),
      truncated: collected.length >= MAP_MAX_LEADS,
      leads: visible.map((lead) => ({
        id: lead.id,
        name: lead.full_name,
        phone: lead.phone,
        status: lead.status,
        lat: Number(lead.map_lat),
        lng: Number(lead.map_lng),
        address: lead.address || lead.postal_code || "",
        postalCode: normalizePostalCode(lead.postal_code),
        assigneeName: lead.assigned_to ? peopleById.get(lead.assigned_to)?.full_name || "Przypisany" : "Nieprzypisany"
      })),
      users: assignableUsers.map((person) => ({ id: person.id, full_name: person.full_name }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się pobrać leadów do mapy." },
      { status: 500 }
    );
  }
}
