import { NextResponse } from "next/server";
import { isSalesRole, isSystemAdminRole, normalizeRole } from "@/lib/roles";
import { requireApiProfile } from "@/lib/server-auth";

type WorkflowBody = {
  action?: unknown;
  enabled?: unknown;
  profileId?: unknown;
};

async function requireWorkflowAdmin(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth;
  if (!isSystemAdminRole(auth.profile.role)) {
    return {
      error: NextResponse.json(
        { error: "Ustawienia automatyzacji są dostępne tylko dla właściciela i admina." },
        { status: 403 },
      ),
    };
  }
  return auth;
}

export async function GET(request: Request) {
  const auth = await requireWorkflowAdmin(request);
  if ("error" in auth) return auth.error;

  const { profile, supabaseAdmin } = auth;
  const [settingsResult, peopleResult] = await Promise.all([
    supabaseAdmin
      .from("crm_workflow_settings")
      .select("crm_environment,auto_assignment_enabled,updated_at,updated_by")
      .eq("crm_environment", profile.crm_environment)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,manager_id,crm_environment,auto_takeback_enabled")
      .eq("crm_environment", profile.crm_environment)
      .order("full_name", { ascending: true }),
  ]);

  if (settingsResult.error) {
    return NextResponse.json({ error: settingsResult.error.message }, { status: 400 });
  }
  if (peopleResult.error) {
    return NextResponse.json({ error: peopleResult.error.message }, { status: 400 });
  }

  const salespeople = (peopleResult.data || [])
    .map((item) => ({
      ...item,
      role: normalizeRole(item.role, item.email),
      auto_takeback_enabled: item.auto_takeback_enabled !== false,
    }))
    .filter((item) => isSalesRole(item.role));

  return NextResponse.json({
    autoAssignmentEnabled: Boolean(settingsResult.data?.auto_assignment_enabled),
    salespeople,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireWorkflowAdmin(request);
  if ("error" in auth) return auth.error;

  const { profile, supabaseAdmin } = auth;
  const body = (await request.json().catch(() => ({}))) as WorkflowBody;
  const action = typeof body.action === "string" ? body.action : "";
  const enabled = body.enabled;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Brak poprawnej wartości przełącznika." }, { status: 400 });
  }

  if (action === "set_auto_assignment") {
    const { error } = await supabaseAdmin
      .from("crm_workflow_settings")
      .upsert(
        {
          crm_environment: profile.crm_environment,
          auto_assignment_enabled: enabled,
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        },
        { onConflict: "crm_environment" },
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabaseAdmin.from("audit_events").insert({
      actor_id: profile.id,
      event_type: enabled ? "lead_auto_assignment.enabled" : "lead_auto_assignment.disabled",
      entity_type: "crm_workflow_settings",
      entity_id: null,
      metadata: { enabled },
      crm_environment: profile.crm_environment,
    });

    return NextResponse.json({ autoAssignmentEnabled: enabled });
  }

  if (action === "set_takeback") {
    const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
    if (!profileId) {
      return NextResponse.json({ error: "Wybierz użytkownika." }, { status: 400 });
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,crm_environment")
      .eq("id", profileId)
      .eq("crm_environment", profile.crm_environment)
      .maybeSingle();

    if (targetError) return NextResponse.json({ error: targetError.message }, { status: 400 });
    if (!target || !isSalesRole(normalizeRole(target.role, target.email))) {
      return NextResponse.json({ error: "Nie znaleziono handlowca lub menadżera w tym CRM." }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ auto_takeback_enabled: enabled })
      .eq("id", profileId)
      .eq("crm_environment", profile.crm_environment);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabaseAdmin.from("audit_events").insert({
      actor_id: profile.id,
      event_type: enabled ? "lead_takeback.enabled" : "lead_takeback.disabled",
      entity_type: "profile",
      entity_id: profileId,
      metadata: { enabled, targetName: target.full_name },
      crm_environment: profile.crm_environment,
    });

    return NextResponse.json({ profileId, autoTakebackEnabled: enabled });
  }

  return NextResponse.json({ error: "Nieznana akcja ustawień automatyzacji." }, { status: 400 });
}
