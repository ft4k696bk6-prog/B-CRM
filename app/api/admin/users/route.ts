import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeRole, USER_ROLES } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

type CreateUserBody = {
  email?: string;
  password?: string;
  fullName?: string;
  role?: UserRole;
};

type UpdateUserBody = {
  id?: string;
  role?: UserRole;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
  created_at: string;
};

function dbCompatibleRole(role: UserRole) {
  if (role === "handlowiec") return "sales";
  if (role === "menadzer") return "manager";
  return role;
}

function isRoleCheckError(error: { message?: string; code?: string } | null) {
  return error?.code === "23514" || error?.message?.includes("profiles_role_check");
}

async function upsertProfileWithRoleFallback(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  row: Omit<ProfileRow, "created_at">
) {
  const { error } = await supabaseAdmin.from("profiles").upsert(row);

  if (!isRoleCheckError(error)) return { error, storedRole: row.role };

  const fallbackRole = dbCompatibleRole(normalizeRole(row.role));
  const fallback = await supabaseAdmin.from("profiles").upsert({
    ...row,
    role: fallbackRole
  });

  return { error: fallback.error, storedRole: fallbackRole };
}

async function updateProfileRoleWithFallback(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  id: string,
  role: UserRole
) {
  const { error } = await supabaseAdmin.from("profiles").update({ role }).eq("id", id);

  if (!isRoleCheckError(error)) return { error, storedRole: role };

  const fallbackRole = dbCompatibleRole(role);
  const fallback = await supabaseAdmin.from("profiles").update({ role: fallbackRole }).eq("id", id);

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
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { error: NextResponse.json({ error: "Brak uprawnień admina." }, { status: 403 }) };
    }

    return { supabaseAdmin, user };
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

  const { data, error } = await auth.supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const users = ((data || []) as ProfileRow[]).map((user) => ({
    ...user,
    role: normalizeRole(user.role)
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

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Uzupełnij wszystkie pola." }, { status: 400 });
    }

    const { data, error } = await auth.supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role
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
      role
    });

    if (profileResult.error) {
      return NextResponse.json({ error: profileResult.error.message }, { status: 400 });
    }

    return NextResponse.json({ id: data.user.id, email, fullName, role });
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

    if (!id || !role) {
      return NextResponse.json({ error: "Brak użytkownika lub roli." }, { status: 400 });
    }

    const { data: target } = await auth.supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", id)
      .single();

    if (target?.role === "admin" && role !== "admin" && id !== auth.user.id) {
      return NextResponse.json(
        { error: "Nie można odebrać roli admina innemu administratorowi." },
        { status: 403 }
      );
    }

    const { error, storedRole } = await updateProfileRoleWithFallback(auth.supabaseAdmin, id, role);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await auth.supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: { role: storedRole }
    });

    return NextResponse.json({ id, role });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
