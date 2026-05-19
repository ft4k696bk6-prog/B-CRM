import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhoneForDial } from "@/lib/phone";
import { isDemoUserEmail, isSystemAdminRole, normalizeRole, USER_ROLES } from "@/lib/roles";
import { normalizeCrmScope } from "@/lib/scope";
import type { CrmDataScope, UserRole } from "@/lib/types";

type CreateUserBody = {
  email?: string;
  password?: string;
  fullName?: string;
  role?: UserRole;
  managerId?: string | null;
  businessPhone?: string | null;
};

type UpdateUserBody = {
  id?: string;
  role?: UserRole;
  managerId?: string | null;
  businessPhone?: string | null;
};

type DeleteUserBody = {
  id?: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
  manager_id: string | null;
  business_phone: string | null;
  crm_environment: CrmDataScope;
  created_at: string;
};

type AdminProfile = {
  role: string | null;
  email: string | null;
  crm_environment: string | null;
};

function dbCompatibleRole(role: UserRole) {
  if (role === "handlowiec") return "sales";
  if (role === "menadzer") return "manager";
  if (role === "owner" || role === "finance" || role === "viewer") return "admin";
  if (role === "ksiegowosc" || role === "logistyk" || role === "monter") return "admin";
  return role;
}

function trustedAuthRole(role: unknown) {
  return typeof role === "string" ? role : null;
}

function isRoleCheckError(error: { message?: string; code?: string } | null) {
  return error?.code === "23514" || error?.message?.includes("profiles_role_check");
}

function isManagerColumnError(error: { message?: string; code?: string } | null) {
  return error?.message?.includes("manager_id") || error?.message?.includes("profiles_manager_id");
}

function normalizedManagerId(value: string | null | undefined, role: UserRole) {
  if (role !== "handlowiec") return null;
  const trimmed = value?.trim();
  return trimmed || null;
}

function profileRowWithoutManager(row: Omit<ProfileRow, "created_at">) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    business_phone: row.business_phone,
    crm_environment: row.crm_environment
  };
}

async function upsertProfileWithRoleFallback(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  row: Omit<ProfileRow, "created_at">
) {
  const { error } = await supabaseAdmin.from("profiles").upsert(row);

  if (isManagerColumnError(error)) {
    const fallback = await supabaseAdmin.from("profiles").upsert(profileRowWithoutManager(row));
    return { error: fallback.error, storedRole: row.role };
  }

  if (!isRoleCheckError(error)) return { error, storedRole: row.role };

  const fallbackRole = dbCompatibleRole(normalizeRole(row.role));
  const fallback = await supabaseAdmin.from("profiles").upsert({
    ...row,
    role: fallbackRole
  });

  if (isManagerColumnError(fallback.error)) {
    const noManagerFallback = await supabaseAdmin.from("profiles").upsert({
      ...profileRowWithoutManager(row),
      role: fallbackRole
    });
    return { error: noManagerFallback.error, storedRole: fallbackRole };
  }

  return { error: fallback.error, storedRole: fallbackRole };
}

async function updateProfileRoleWithFallback(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  id: string,
  role: UserRole,
  managerId: string | null
) {
  const patch = {
    role,
    manager_id: normalizedManagerId(managerId, role)
  };
  const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", id);

  if (isManagerColumnError(error)) {
    const fallback = await supabaseAdmin.from("profiles").update({ role }).eq("id", id);
    return { error: fallback.error, storedRole: role };
  }

  if (!isRoleCheckError(error)) return { error, storedRole: role };

  const fallbackRole = dbCompatibleRole(role);
  const fallback = await supabaseAdmin
    .from("profiles")
    .update({ ...patch, role: fallbackRole })
    .eq("id", id);

  if (isManagerColumnError(fallback.error)) {
    const noManagerFallback = await supabaseAdmin
      .from("profiles")
      .update({ role: fallbackRole })
      .eq("id", id);
    return { error: noManagerFallback.error, storedRole: fallbackRole };
  }

  return { error: fallback.error, storedRole: fallbackRole };
}

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

    const requesterEmail = profile?.email || user.email || null;

    return {
      supabaseAdmin,
      user,
      requesterEmail,
      requesterIsDemo: isDemoUserEmail(requesterEmail),
      requesterScope: normalizeCrmScope(profile?.crm_environment, requesterEmail)
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

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let { data, error } = await auth.supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("crm_environment", auth.requesterScope)
    .order("created_at", { ascending: false });

  if (isManagerColumnError(error)) {
    const fallback = await auth.supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("crm_environment", auth.requesterScope)
      .order("created_at", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: authUsersData } = await auth.supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  const roleByUserId = new Map(
    (authUsersData?.users || []).map((user) => [user.id, trustedAuthRole(user.app_metadata?.role)])
  );

  const users = ((data || []) as ProfileRow[]).map((user) => ({
    ...user,
    crm_environment: normalizeCrmScope(user.crm_environment, user.email),
    role: normalizeRole(user.role, user.email, roleByUserId.get(user.id))
  }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const body = (await request.json()) as CreateUserBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();
    const fullName = body.fullName?.trim();
    const role = USER_ROLES.includes(body.role as UserRole) ? (body.role as UserRole) : "handlowiec";
    const managerId = normalizedManagerId(body.managerId, role);
    const businessPhone = body.businessPhone ? normalizePhoneForDial(body.businessPhone) : null;

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Uzupełnij wszystkie pola." }, { status: 400 });
    }

    if (body.businessPhone && !businessPhone) {
      return NextResponse.json({ error: "Numer służbowy ma niepoprawny format." }, { status: 400 });
    }

    if (auth.requesterIsDemo) {
      return NextResponse.json(
        { error: "Konto demo nie może tworzyć prawdziwych użytkowników." },
        { status: 403 }
      );
    }

    if (role === "handlowiec" && managerId) {
      const { data: manager } = await auth.supabaseAdmin
        .from("profiles")
        .select("role,email,crm_environment")
        .eq("id", managerId)
        .single<AdminProfile>();

      if (normalizeRole(manager?.role, manager?.email) !== "menadzer") {
        return NextResponse.json({ error: "Wybrany opiekun nie jest menadżerem." }, { status: 400 });
      }

      if (normalizeCrmScope(manager?.crm_environment, manager?.email) !== auth.requesterScope) {
        return NextResponse.json(
          { error: "Wybrany menadżer jest z innego środowiska CRM." },
          { status: 403 }
        );
      }
    }

    const { data, error } = await auth.supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        crm_environment: auth.requesterScope
      },
      app_metadata: {
        role,
        crm_environment: auth.requesterScope
      }
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || "Nie udało się utworzyć użytkownika." },
        { status: 400 }
      );
    }

    const profileResult = await upsertProfileWithRoleFallback(auth.supabaseAdmin, {
      id: data.user.id,
      email,
      full_name: fullName,
      role,
      manager_id: managerId,
      business_phone: businessPhone,
      crm_environment: auth.requesterScope
    });

    if (profileResult.error) {
      return NextResponse.json({ error: profileResult.error.message }, { status: 400 });
    }

    await auth.supabaseAdmin.from("audit_events").insert({
      actor_id: auth.user.id,
      event_type: "user.created",
      entity_type: "profile",
      entity_id: data.user.id,
      metadata: { email, fullName, role },
      crm_environment: auth.requesterScope
    });

    return NextResponse.json({ id: data.user.id, email, fullName, role, crm_environment: auth.requesterScope });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const body = (await request.json()) as UpdateUserBody;
    const id = body.id?.trim();
    const role = USER_ROLES.includes(body.role as UserRole) ? (body.role as UserRole) : null;
    const managerId = normalizedManagerId(body.managerId, role || "handlowiec");
    const businessPhoneProvided = Object.prototype.hasOwnProperty.call(body, "businessPhone");
    const businessPhone =
      !businessPhoneProvided || body.businessPhone === null || body.businessPhone === ""
        ? null
        : normalizePhoneForDial(body.businessPhone);

    if (!id || !role) {
      return NextResponse.json({ error: "Brak użytkownika lub roli." }, { status: 400 });
    }

    if (body.businessPhone && !businessPhone) {
      return NextResponse.json({ error: "Numer służbowy ma niepoprawny format." }, { status: 400 });
    }

    const { data: target } = await auth.supabaseAdmin
      .from("profiles")
      .select("role,email,crm_environment")
      .eq("id", id)
      .single<AdminProfile>();
    const { data: targetAuth } = await auth.supabaseAdmin.auth.admin.getUserById(id);
    const targetRole = normalizeRole(
      target?.role,
      target?.email,
      trustedAuthRole(targetAuth.user?.app_metadata?.role)
    );
    const targetScope = normalizeCrmScope(target?.crm_environment, target?.email || targetAuth.user?.email);

    if (targetScope !== auth.requesterScope) {
      return NextResponse.json(
        { error: "Możesz zmieniać wyłącznie użytkowników z tego samego środowiska CRM." },
        { status: 403 }
      );
    }

    if (isSystemAdminRole(targetRole) && role !== targetRole && id !== auth.user.id) {
      return NextResponse.json(
        { error: "Nie można odebrać roli właściciela lub admina innemu administratorowi." },
        { status: 403 }
      );
    }

    if (role === "handlowiec" && managerId) {
      const { data: manager } = await auth.supabaseAdmin
        .from("profiles")
        .select("role,email,crm_environment")
        .eq("id", managerId)
        .single<AdminProfile>();

      if (normalizeRole(manager?.role, manager?.email) !== "menadzer") {
        return NextResponse.json({ error: "Wybrany opiekun nie jest menadżerem." }, { status: 400 });
      }

      if (normalizeCrmScope(manager?.crm_environment, manager?.email) !== auth.requesterScope) {
        return NextResponse.json(
          { error: "Wybrany menadżer jest z innego środowiska CRM." },
          { status: 403 }
        );
      }
    }

    const { error, storedRole } = await updateProfileRoleWithFallback(
      auth.supabaseAdmin,
      id,
      role,
      managerId
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (businessPhoneProvided) {
      await auth.supabaseAdmin
        .from("profiles")
        .update({ business_phone: businessPhone })
        .eq("id", id)
        .eq("crm_environment", targetScope);
    }

    await auth.supabaseAdmin.auth.admin.updateUserById(id, {
      app_metadata: { ...(targetAuth.user?.app_metadata || {}), role, crm_environment: targetScope },
      user_metadata: { ...(targetAuth.user?.user_metadata || {}), role: storedRole, crm_environment: targetScope }
    });

    await auth.supabaseAdmin.from("audit_events").insert({
      actor_id: auth.user.id,
      event_type: "user.role_updated",
      entity_type: "profile",
      entity_id: id,
      metadata: { role, managerId, ...(businessPhoneProvided ? { businessPhone } : {}) },
      crm_environment: auth.requesterScope
    });

    return NextResponse.json({
      id,
      role,
      ...(businessPhoneProvided ? { business_phone: businessPhone } : {}),
      crm_environment: targetScope
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const body = (await request.json().catch(() => ({}))) as DeleteUserBody;
    const id = body.id?.trim();

    if (!id) {
      return NextResponse.json({ error: "Brak użytkownika do usunięcia." }, { status: 400 });
    }

    if (id === auth.user.id) {
      return NextResponse.json({ error: "Nie możesz usunąć własnego konta." }, { status: 403 });
    }

    const { data: target } = await auth.supabaseAdmin
      .from("profiles")
      .select("email,role,crm_environment")
      .eq("id", id)
      .single<AdminProfile>();

    if (!target) {
      return NextResponse.json({ error: "Nie znaleziono użytkownika." }, { status: 404 });
    }

    if (normalizeCrmScope(target.crm_environment, target.email) !== auth.requesterScope) {
      return NextResponse.json(
        { error: "Możesz usuwać wyłącznie użytkowników z tego samego środowiska CRM." },
        { status: 403 }
      );
    }

    if (isDemoUserEmail(target.email)) {
      return NextResponse.json({ error: "Konta demo są zarządzane automatycznie." }, { status: 403 });
    }

    if (auth.requesterIsDemo) {
      return NextResponse.json(
        { error: "Konto demo nie może usuwać prawdziwych użytkowników." },
        { status: 403 }
      );
    }

    const { error } = await auth.supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
