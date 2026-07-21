import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LEAD_SOURCES } from "@/lib/lead-sources";
import { canCreateManualLead, canManageLeads, normalizeRole } from "@/lib/roles";
import { normalizeCrmScope } from "@/lib/scope";

type CreateLeadBody = {
  full_name?: string;
  phone?: string;
  postal_code?: string | null;
  address?: string | null;
  voivodeship?: string | null;
  county?: string | null;
  source?: string;
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

function text(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

    if (!token) return NextResponse.json({ error: "Brak sesji." }, { status: 401 });

    const supabaseAdmin = getAdminClient();
    const {
      data: { user },
      error: userError
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) return NextResponse.json({ error: "Sesja wygasła." }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id,email,role,crm_environment")
      .eq("id", user.id)
      .single();

    const role = normalizeRole(
      profile?.role,
      profile?.email || user.email,
      typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null
    );
    const crmEnvironment = normalizeCrmScope(profile?.crm_environment, profile?.email || user.email);

    if (!canCreateManualLead(role)) {
      return NextResponse.json({ error: "Twoja rola nie może tworzyć leadów." }, { status: 403 });
    }

    const body = (await request.json()) as CreateLeadBody;
    const fullName = text(body.full_name, 180);
    const phone = text(body.phone, 60);
    const source = text(body.source, 40);

    if (!fullName || !phone) {
      return NextResponse.json({ error: "Wpisz imię i nazwisko oraz numer telefonu." }, { status: 400 });
    }

    if (!LEAD_SOURCES.includes(source as (typeof LEAD_SOURCES)[number])) {
      return NextResponse.json({ error: "Niedozwolone źródło leada." }, { status: 400 });
    }

    const payload = {
      full_name: fullName,
      phone,
      postal_code: text(body.postal_code, 20) || null,
      address: text(body.address, 300) || null,
      voivodeship: text(body.voivodeship, 80) || null,
      county: text(body.county, 120) || null,
      source,
      status: "Nowy",
      assigned_to: canManageLeads(role) ? null : user.id,
      crm_environment: crmEnvironment
    };

    const { data, error } = await supabaseAdmin.from("leads").insert(payload).select("id").single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Nie udało się dodać leada." }, { status: 400 });
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
