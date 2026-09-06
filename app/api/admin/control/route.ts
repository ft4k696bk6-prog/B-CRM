import { NextResponse } from "next/server";
import { isMandatoryLead } from "@/lib/lead-outcomes";
import { VOIVODESHIPS } from "@/lib/poland-regions";
import { isSalesRole, isSystemAdminRole, normalizeRole } from "@/lib/roles";
import { requireApiProfile } from "@/lib/server-auth";
import { MANDATORY_QUEUE_ROLLOUT_AT, wasCurrentScheduleSetAfterRollout } from "@/lib/server-lead-work";
import type { Lead, UserRole } from "@/lib/types";

type RoutingAssignment = {
  profileId?: unknown;
  weight?: unknown;
};

type ControlBody = {
  action?: unknown;
  profileId?: unknown;
  hours?: unknown;
  voivodeship?: unknown;
  assignments?: unknown;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
  manager_id: string | null;
  crm_environment: string;
  company_margin_net: number | string;
  sales_margin_net: number | string;
  commission_percent: number | string;
  mandatory_queue_snoozed_until: string | null;
};

type ScheduleHistory = {
  lead_id: string;
  created_at: string;
  new_value: Record<string, unknown> | null;
};

function normalizeRegion(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^wojewodztwo[ .:-]*/, "")
    .replace(/^woj[ .:-]*/, "")
    .trim();
}

function canonicalVoivodeship(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = normalizeRegion(value);
  return VOIVODESHIPS.find((item) => normalizeRegion(item) === normalized) || null;
}

async function requireControlAdmin(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth;
  if (!isSystemAdminRole(auth.profile.role)) {
    return { error: NextResponse.json({ error: "Panel Kontrola jest dostępny tylko dla właściciela i admina." }, { status: 403 }) };
  }
  return auth;
}

export async function GET(request: Request) {
  const auth = await requireControlAdmin(request);
  if ("error" in auth) return auth.error;

  const { profile, supabaseAdmin } = auth;
  const { data: profileRows, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id,email,full_name,role,manager_id,crm_environment,company_margin_net,sales_margin_net,commission_percent,mandatory_queue_snoozed_until")
    .eq("crm_environment", profile.crm_environment)
    .order("full_name", { ascending: true });

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 400 });

  const users = ((profileRows || []) as ProfileRow[]).map((item) => ({
    ...item,
    role: normalizeRole(item.role, item.email) as UserRole,
    company_margin_net: Number(item.company_margin_net) || 0,
    sales_margin_net: Number(item.sales_margin_net) || 0,
    commission_percent: Number(item.commission_percent) || 0
  }));
  const salespeople = users.filter((item) => isSalesRole(item.role));
  const salespersonIds = salespeople.map((item) => item.id);

  let scheduledLeads: Lead[] = [];
  let scheduleHistory: ScheduleHistory[] = [];

  if (salespersonIds.length > 0) {
    const scheduledResult = await supabaseAdmin
      .from("leads")
      .select("id,full_name,phone,status,callback_at,meeting_at,meeting_address,address,assigned_to,crm_environment,created_at,updated_at,last_opened_at,source,campaign,postal_code,voivodeship,county,meeting_note,resignation_reason,contract_number")
      .eq("crm_environment", profile.crm_environment)
      .in("assigned_to", salespersonIds)
      .in("status", ["Call back", "Spotkanie"])
      .or("callback_at.not.is.null,meeting_at.not.is.null");

    if (scheduledResult.error) return NextResponse.json({ error: scheduledResult.error.message }, { status: 400 });
    scheduledLeads = (scheduledResult.data || []) as unknown as Lead[];

    if (scheduledLeads.length > 0) {
      const historyResult = await supabaseAdmin
        .from("lead_history")
        .select("lead_id,created_at,new_value")
        .in("lead_id", scheduledLeads.map((lead) => lead.id))
        .eq("action_type", "status_change")
        .gte("created_at", MANDATORY_QUEUE_ROLLOUT_AT)
        .order("created_at", { ascending: false });
      if (historyResult.error) return NextResponse.json({ error: historyResult.error.message }, { status: 400 });
      scheduleHistory = (historyResult.data || []) as ScheduleHistory[];
    }
  }

  const now = new Date();
  const locks = salespeople.map((person) => {
    const due = scheduledLeads.filter(
      (lead) =>
        lead.assigned_to === person.id &&
        wasCurrentScheduleSetAfterRollout(lead, scheduleHistory) &&
        isMandatoryLead(lead, now)
    );
    const snoozedUntil = person.mandatory_queue_snoozed_until;
    const snoozed = Boolean(snoozedUntil && new Date(snoozedUntil).getTime() > now.getTime());
    return {
      profileId: person.id,
      fullName: person.full_name,
      mandatoryCount: due.length,
      snoozedUntil,
      blocked: due.length > 0 && !snoozed
    };
  });

  const { data: routingRows, error: routingError } = await supabaseAdmin
    .from("lead_routing_rules")
    .select("id,voivodeship,voivodeship_key,profile_id,weight,sort_order,is_active")
    .eq("crm_environment", profile.crm_environment)
    .eq("is_active", true)
    .order("voivodeship", { ascending: true })
    .order("sort_order", { ascending: true });
  if (routingError) return NextResponse.json({ error: routingError.message }, { status: 400 });

  return NextResponse.json({
    users,
    salespeople,
    locks,
    routingRules: routingRows || [],
    voivodeships: VOIVODESHIPS
  });
}

export async function PATCH(request: Request) {
  const auth = await requireControlAdmin(request);
  if ("error" in auth) return auth.error;

  const { profile, supabaseAdmin } = auth;
  const body = (await request.json().catch(() => ({}))) as ControlBody;
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "unlock_queue" || action === "restore_queue") {
    const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
    if (!profileId) return NextResponse.json({ error: "Wybierz handlowca." }, { status: 400 });

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id,email,role,crm_environment")
      .eq("id", profileId)
      .eq("crm_environment", profile.crm_environment)
      .maybeSingle();

    if (!target || !isSalesRole(normalizeRole(target.role, target.email))) {
      return NextResponse.json({ error: "Nie znaleziono handlowca w tym CRM." }, { status: 404 });
    }

    let until: string | null = null;
    if (action === "unlock_queue") {
      const requestedHours = Number(body.hours);
      const hours = Number.isFinite(requestedHours) ? Math.min(Math.max(requestedHours, 1), 168) : 24;
      until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ mandatory_queue_snoozed_until: until })
      .eq("id", profileId)
      .eq("crm_environment", profile.crm_environment);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabaseAdmin.from("audit_events").insert({
      actor_id: profile.id,
      event_type: action === "unlock_queue" ? "mandatory_queue.unlocked" : "mandatory_queue.restored",
      entity_type: "profile",
      entity_id: profileId,
      metadata: { until },
      crm_environment: profile.crm_environment
    });

    return NextResponse.json({ profileId, snoozedUntil: until });
  }

  if (action === "save_routing") {
    const voivodeship = canonicalVoivodeship(body.voivodeship);
    if (!voivodeship) return NextResponse.json({ error: "Wybierz poprawne województwo." }, { status: 400 });

    const rawAssignments = Array.isArray(body.assignments) ? (body.assignments as RoutingAssignment[]) : [];
    const assignments = rawAssignments.map((item) => ({
      profileId: typeof item.profileId === "string" ? item.profileId.trim() : "",
      weight: Number(item.weight)
    }));

    if (assignments.some((item) => !item.profileId || !Number.isInteger(item.weight) || item.weight < 1 || item.weight > 100)) {
      return NextResponse.json({ error: "Każdy handlowiec musi mieć udział od 1 do 100%." }, { status: 400 });
    }

    if (new Set(assignments.map((item) => item.profileId)).size !== assignments.length) {
      return NextResponse.json({ error: "Ten sam handlowiec nie może wystąpić dwa razy." }, { status: 400 });
    }

    const total = assignments.reduce((sum, item) => sum + item.weight, 0);
    if (assignments.length > 0 && total !== 100) {
      return NextResponse.json({ error: `Udziały muszą sumować się do 100%. Teraz: ${total}%.` }, { status: 400 });
    }

    if (assignments.length > 0) {
      const { data: targets, error: targetError } = await supabaseAdmin
        .from("profiles")
        .select("id,email,role,crm_environment")
        .in("id", assignments.map((item) => item.profileId))
        .eq("crm_environment", profile.crm_environment);
      if (targetError) return NextResponse.json({ error: targetError.message }, { status: 400 });

      const validIds = new Set(
        (targets || [])
          .filter((item) => isSalesRole(normalizeRole(item.role, item.email)))
          .map((item) => item.id)
      );
      if (assignments.some((item) => !validIds.has(item.profileId))) {
        return NextResponse.json({ error: "Routing może wskazywać tylko aktywnych handlowców z tego CRM." }, { status: 400 });
      }
    }

    const { error } = await supabaseAdmin.rpc("replace_lead_routing_rules", {
      p_environment: profile.crm_environment,
      p_voivodeship: voivodeship,
      p_assignments: assignments,
      p_created_by: profile.id
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabaseAdmin.from("audit_events").insert({
      actor_id: profile.id,
      event_type: "lead_routing.updated",
      entity_type: "lead_routing_rules",
      entity_id: null,
      metadata: { voivodeship, assignments },
      crm_environment: profile.crm_environment
    });

    return NextResponse.json({ voivodeship, assignments });
  }

  return NextResponse.json({ error: "Nieznana akcja panelu Kontrola." }, { status: 400 });
}
