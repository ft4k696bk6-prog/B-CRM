import { NextResponse } from "next/server";
import { VOIVODESHIPS } from "@/lib/poland-regions";
import { requireApiProfile } from "@/lib/server-auth";

type RoutingEntry = {
  salespersonId?: unknown;
  weight?: unknown;
};

type ControlPatchBody =
  | {
      action?: "settings";
      mandatoryQueueEnabled?: unknown;
      operationsModulesEnabled?: unknown;
    }
  | {
      action?: "routing";
      voivodeship?: unknown;
      entries?: unknown;
    };

function migrationRequired(message?: string) {
  return NextResponse.json(
    {
      error: "Panel Kontrola wymaga migracji Supabase 25_control_center_routing.sql.",
      code: "CONTROL_CENTER_MIGRATION_REQUIRED",
      details: message || null,
    },
    { status: 503 },
  );
}

function isMissingControlSchema(message?: string) {
  const value = (message || "").toLowerCase();
  return value.includes("crm_settings") || value.includes("lead_routing_rules") || value.includes("replace_lead_routing_rules");
}

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (!["owner", "admin"].includes(auth.profile.role)) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  const [settingsResult, routingResult] = await Promise.all([
    auth.supabaseAdmin
      .from("crm_settings")
      .select("mandatory_queue_enabled,operations_modules_enabled,updated_at")
      .eq("crm_environment", auth.profile.crm_environment)
      .maybeSingle(),
    auth.supabaseAdmin
      .from("lead_routing_rules")
      .select("id,voivodeship,salesperson_id,weight,active,salesperson:profiles!lead_routing_rules_salesperson_id_fkey(id,full_name,email,role)")
      .eq("crm_environment", auth.profile.crm_environment)
      .eq("active", true)
      .order("voivodeship")
      .order("salesperson_id"),
  ]);

  const schemaError = settingsResult.error || routingResult.error;
  if (schemaError && isMissingControlSchema(schemaError.message)) {
    return migrationRequired(schemaError.message);
  }
  if (schemaError) {
    return NextResponse.json({ error: schemaError.message }, { status: 400 });
  }

  const settings = settingsResult.data || {
    mandatory_queue_enabled: true,
    operations_modules_enabled: false,
    updated_at: null,
  };

  return NextResponse.json({
    settings: {
      mandatoryQueueEnabled: settings.mandatory_queue_enabled,
      operationsModulesEnabled: settings.operations_modules_enabled,
      updatedAt: settings.updated_at,
    },
    routingRules: routingResult.data || [],
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (!["owner", "admin"].includes(auth.profile.role)) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  const body = (await request.json()) as ControlPatchBody;

  if (body.action === "settings") {
    if (
      typeof body.mandatoryQueueEnabled !== "boolean" ||
      typeof body.operationsModulesEnabled !== "boolean"
    ) {
      return NextResponse.json({ error: "Niepoprawne ustawienia CRM." }, { status: 400 });
    }

    const { data, error } = await auth.supabaseAdmin
      .from("crm_settings")
      .upsert({
        crm_environment: auth.profile.crm_environment,
        mandatory_queue_enabled: body.mandatoryQueueEnabled,
        operations_modules_enabled: body.operationsModulesEnabled,
        updated_by: auth.profile.id,
        updated_at: new Date().toISOString(),
      })
      .select("mandatory_queue_enabled,operations_modules_enabled,updated_at")
      .single();

    if (error && isMissingControlSchema(error.message)) return migrationRequired(error.message);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      settings: {
        mandatoryQueueEnabled: data.mandatory_queue_enabled,
        operationsModulesEnabled: data.operations_modules_enabled,
        updatedAt: data.updated_at,
      },
    });
  }

  if (body.action === "routing") {
    const voivodeship = typeof body.voivodeship === "string" ? body.voivodeship.trim().toLowerCase() : "";
    if (!VOIVODESHIPS.includes(voivodeship as (typeof VOIVODESHIPS)[number])) {
      return NextResponse.json({ error: "Niepoprawne województwo." }, { status: 400 });
    }
    if (!Array.isArray(body.entries)) {
      return NextResponse.json({ error: "Brak listy handlowców." }, { status: 400 });
    }

    const entries = (body.entries as RoutingEntry[]).map((entry) => ({
      salespersonId: typeof entry.salespersonId === "string" ? entry.salespersonId.trim() : "",
      weight: Math.round(Number(entry.weight)),
    }));

    if (
      entries.some(
        (entry) =>
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.salespersonId) ||
          !Number.isFinite(entry.weight) ||
          entry.weight < 1 ||
          entry.weight > 10000,
      )
    ) {
      return NextResponse.json({ error: "Niepoprawny handlowiec lub waga." }, { status: 400 });
    }

    if (new Set(entries.map((entry) => entry.salespersonId)).size !== entries.length) {
      return NextResponse.json({ error: "Ten sam handlowiec nie może wystąpić dwa razy w jednym województwie." }, { status: 400 });
    }

    const salespersonIds = entries.map((entry) => entry.salespersonId);
    if (salespersonIds.length) {
      const { data: salespeople, error } = await auth.supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("crm_environment", auth.profile.crm_environment)
        .eq("role", "handlowiec")
        .in("id", salespersonIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if ((salespeople || []).length !== salespersonIds.length) {
        return NextResponse.json({ error: "Co najmniej jeden użytkownik nie jest aktywnym handlowcem w tym CRM." }, { status: 400 });
      }
    }

    const { error } = await auth.supabaseAdmin.rpc("replace_lead_routing_rules", {
      p_environment: auth.profile.crm_environment,
      p_voivodeship: voivodeship,
      p_rules: entries,
    });

    if (error && isMissingControlSchema(error.message)) return migrationRequired(error.message);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ saved: true, voivodeship, entries });
  }

  return NextResponse.json({ error: "Nieznana akcja panelu Kontrola." }, { status: 400 });
}
