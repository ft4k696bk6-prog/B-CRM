import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSystemAdminRole, normalizeRole } from "@/lib/roles";
import { normalizeCrmScope } from "@/lib/scope";

type UpdateTakebackBody = {
  id?: string;
  autoTakebackEnabled?: boolean;
};

type AdminProfile = {
  id?: string;
  role: string | null;
  email: string | null;
  crm_environment: string | null;
  auto_takeback_enabled?: boolean | null;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Brakuje konfiguracji Supabase po stronie serwera.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function trustedAuthRole(role: unknown) {
  return typeof role === "string" ? role : null;
}

async function requireAdmin(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return { error: NextResponse.json({ error: "Brak sesji admina." }, { status: 401 }) };
    }

    const supabaseAdmin = getAdminClient();
    const {
      data: { user },
      error: userError
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return { error: NextResponse.json({ error: "Sesja wygasła." }, { status: 401 }) };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role,email,crm_environment")
      .eq("id", user.id)
      .single<AdminProfile>();

    const requesterRole = normalizeRole(
      profile?.role,
      profile?.email,
      trustedAuthRole(user.app_metadata?.role)
    );

    if (!isSystemAdminRole(requesterRole)) {
      return { error: NextResponse.json({ error: "Brak uprawnień administratora." }, { status: 403 }) };
    }

    return {
      supabaseAdmin,
      user,
      requesterScope: normalizeCrmScope(profile?.crm_environment, profile?.email || user.email)
    };
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: error instanceof Error ? error.message : "Nieznany błąd." },
        { status: 500 }
      )
    };
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const body = (await request.json().catch(() => ({}))) as UpdateTakebackBody;
    const id = body.id?.trim();

    if (!id || typeof body.autoTakebackEnabled !== "boolean") {
      return NextResponse.json(
        { error: "Brak użytkownika lub wartości ustawienia automatu 22:00." },
        { status: 400 }
      );
    }

    const { data: target, error: targetError } = await auth.supabaseAdmin
      .from("profiles")
      .select("id,role,email,crm_environment,auto_takeback_enabled")
      .eq("id", id)
      .single<AdminProfile>();

    if (targetError || !target) {
      return NextResponse.json({ error: "Nie znaleziono użytkownika." }, { status: 404 });
    }

    const targetScope = normalizeCrmScope(target.crm_environment, target.email);
    if (targetScope !== auth.requesterScope) {
      return NextResponse.json(
        { error: "Możesz zmieniać wyłącznie użytkowników z tego samego środowiska CRM." },
        { status: 403 }
      );
    }

    const { data: updated, error: updateError } = await auth.supabaseAdmin
      .from("profiles")
      .update({ auto_takeback_enabled: body.autoTakebackEnabled })
      .eq("id", id)
      .eq("crm_environment", targetScope)
      .select("id,auto_takeback_enabled")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message || "Nie udało się zapisać ustawienia automatu 22:00." },
        { status: 400 }
      );
    }

    await auth.supabaseAdmin.from("audit_events").insert({
      actor_id: auth.user.id,
      event_type: "user.auto_takeback_updated",
      entity_type: "profile",
      entity_id: id,
      metadata: {
        autoTakebackEnabled: body.autoTakebackEnabled,
        previousAutoTakebackEnabled: target.auto_takeback_enabled !== false
      },
      crm_environment: auth.requesterScope
    });

    return NextResponse.json({
      id,
      auto_takeback_enabled: updated.auto_takeback_enabled,
      crm_environment: targetScope
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
