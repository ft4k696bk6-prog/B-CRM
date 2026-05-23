import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeRole } from "@/lib/roles";
import { normalizeCrmScope } from "@/lib/scope";
import type { CrmDataScope, Profile, UserRole } from "@/lib/types";

export type ApiProfile = Pick<
  Profile,
  "id" | "email" | "full_name" | "role" | "crm_environment" | "business_phone" | "can_view_lead_pool"
>;

export function getServiceClient() {
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

export function bearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
}

export async function requireApiProfile(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return { error: NextResponse.json({ error: "Brak sesji." }, { status: 401 }) };
  }

  const supabaseAdmin = getServiceClient();
  const {
    data: { user },
    error: userError
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Sesja wygasła." }, { status: 401 }) };
  }

  let { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,email,full_name,role,crm_environment,business_phone,can_view_lead_pool")
    .eq("id", user.id)
    .single();

  if (profileError?.message?.includes("business_phone")) {
    const fallback = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,crm_environment")
      .eq("id", user.id)
      .single();
    profile = fallback.data ? { ...fallback.data, business_phone: null, can_view_lead_pool: false } : null;
    profileError = fallback.error;
  }

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: "Nie znaleziono profilu użytkownika." }, { status: 404 }) };
  }

  const normalizedProfile: ApiProfile = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: normalizeRole(
      profile.role,
      profile.email,
      typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null
    ) as UserRole,
    crm_environment: normalizeCrmScope(profile.crm_environment, profile.email) as CrmDataScope,
    business_phone: profile.business_phone || null,
    can_view_lead_pool: Boolean(profile.can_view_lead_pool)
  };

  return { supabaseAdmin, user, profile: normalizedProfile };
}

export function appBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "https";

  if (!host) return "http://localhost:3000";
  return `${protocol}://${host}`;
}

export function canAccessLead(
  profile: Pick<ApiProfile, "id" | "role" | "crm_environment">,
  lead: { assigned_to: string | null; crm_environment: CrmDataScope | string }
) {
  if (lead.crm_environment !== profile.crm_environment) return false;
  if (profile.role === "owner" || profile.role === "admin" || profile.role === "kierownik") return true;
  return lead.assigned_to === profile.id;
}
