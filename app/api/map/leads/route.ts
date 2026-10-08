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
type MapView = "active" | "cold" | "contracts" | "resignations" | "after_meeting";

const MAP_PAGE_SIZE = 1000;
const MAP_MAX_LEADS = 3000;
const SALES_ROLES = new Set(["handlowiec", "sales", "menadzer", "manager"]);
const MANAGER_ROLES = new Set(["menadzer", "manager"]);
const MAP_VIEWS = new Set<MapView>(["active", "cold", "contracts", "resignations", "after_meeting"]);

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

function requestedView(request: Request): MapView {
  const raw = new URL(request.url).searchParams.get("view") as MapView | null;
  return raw && MAP_VIEWS.has(raw) ? raw : "active";
}

function canSeeLead(
  lead: MapLeadRow,
  profile: Profile,
  teamIds: Set<string> | undefined
) {
  if (profile.role === "owner" || profile.role === "admin") return true;
  if (profile.role === "menadzer") {
    return lead.assigned_to === null
      || lead.assigned_to === profile.id
      || Boolean(lead.assigned_to && teamIds?.has(lead.assigned_to));
  }
  return lead.assigned_to === profile.id;
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if ("error" in auth) return auth.error;

    const { supabaseAdmin, profile } = auth;
    const url = new URL(request.url);
    const focusLeadId = url.searchParams.get("leadId")?.trim() || "";
    const view = requestedView(request);

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
      if (profile.role === "menadzer") {
        return person.id === profile.id
          || (!MANAGER_ROLES.has(person.role) && person.manager_id === profile.id);
      }
      if (profile.role === "handlowiec") return person.id === profile.id;
      return true;
    });

    const collected: MapLeadRow[] = [];
    for (let from = 0; from < MAP_MAX_LEADS; from += MAP_PAGE_SIZE) {
      let query = supabaseAdmin
        .from("leads")
        .select("id,full_name,phone,postal_code,address,status,assigned_to,map_lat,map_lng,is_cold_pool")
        .eq("crm_environment", profile.crm_environment)
        .not("map_lat", "is", null)
        .not("map_lng", "is", null)
        .order("updated_at", { ascending: false })
        .range(from, Math.min(from + MAP_PAGE_SIZE - 1, MAP_MAX_LEADS - 1));

      if (focusLeadId) {
        query = query.eq("id", focusLeadId);
      } else if (view === "cold") {
        query = query.eq("is_cold_pool", true);
      } else {
        query = query.eq("is_cold_pool", false);
        if (view === "active") {
          query = query
            .neq("status", "Umowa")
            .neq("status", "Rezygnacja")
            .neq("status", "Po spotkaniu");
        } else if (view === "contracts") {
          query = query.eq("status", "Umowa");
        } else if (view === "resignations") {
          query = query.eq("status", "Rezygnacja");
        } else if (view === "after_meeting") {
          query = query.eq("status", "Po spotkaniu");
        }
      }

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      const page = (data || []) as MapLeadRow[];
      collected.push(...page);
      if (page.length < MAP_PAGE_SIZE || focusLeadId) break;
    }

    const visible = collected.filter((lead) => validCoords(lead.map_lat, lead.map_lng) && canSeeLead(lead, profile, teamIds));

    return NextResponse.json({
      canAssign: ["owner", "admin", "menadzer"].includes(profile.role),
      truncated: !focusLeadId && collected.length >= MAP_MAX_LEADS,
      view,
      focused: Boolean(focusLeadId),
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