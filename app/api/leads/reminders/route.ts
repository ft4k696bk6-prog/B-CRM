import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enumValue, optionalString, requiredString, uuidString } from "@/lib/api-validation";

type CreateReminderBody = {
  lead_id: string;
  reminder_type: "callback" | "meeting" | "followup" | "custom";
  title: string;
  description?: string;
  reminder_at: string;
};

function getSupabaseClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Brakuje konfiguracji Supabase");
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  });
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({ error: "Brak sesji" }, { status: 401 });
    }

    const url = new URL(request.url);
    const leadId = url.searchParams.get("lead_id");

    if (!leadId) {
      return NextResponse.json({ error: "Brak lead_id" }, { status: 400 });
    }

    const supabase = getSupabaseClient(token);

    const { data: reminders, error } = await supabase
      .from("lead_reminders")
      .select(
        `
        *,
        user_profile:created_by(id,email,full_name,role)
      `
      )
      .eq("lead_id", leadId)
      .order("reminder_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(reminders || []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({ error: "Brak sesji" }, { status: 401 });
    }

    const supabase = getSupabaseClient(token);

    const { data: user } = await supabase.auth.getUser();

    if (!user.user) {
      return NextResponse.json({ error: "Sesja wygasła" }, { status: 401 });
    }

    const body = (await request.json()) as CreateReminderBody;
    const leadId = uuidString(body.lead_id, "lead_id");
    const reminderType = enumValue(body.reminder_type, "reminder_type", ["callback", "meeting", "followup", "custom"] as const);
    const title = requiredString(body.title, "title", 160);
    const description = optionalString(body.description, "description", 1000);
    const reminderAt = requiredString(body.reminder_at, "reminder_at", 80);

    for (const result of [leadId, reminderType, title, description, reminderAt]) {
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (Number.isNaN(Date.parse(reminderAt.data!))) {
      return NextResponse.json({ error: "Pole reminder_at ma niepoprawną datę." }, { status: 400 });
    }

    const { data: reminder, error } = await supabase
      .from("lead_reminders")
      .insert({
        lead_id: leadId.data!,
        created_by: user.user.id,
        reminder_type: reminderType.data!,
        title: title.data!,
        description: description.data!,
        reminder_at: new Date(reminderAt.data!).toISOString()
      })
      .select(
        `
        *,
        user_profile:created_by(id,email,full_name,role)
      `
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(reminder);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({ error: "Brak sesji" }, { status: 401 });
    }

    const supabase = getSupabaseClient(token);

    const body = await request.json();
    const id = uuidString(body.id, "id");

    if (!id.ok) return NextResponse.json({ error: id.error }, { status: 400 });
    if (typeof body.is_completed !== "boolean") {
      return NextResponse.json({ error: "Pole is_completed musi być typu boolean." }, { status: 400 });
    }

    const { data: reminder, error } = await supabase
      .from("lead_reminders")
      .update({
        is_completed: body.is_completed,
        completed_at: body.is_completed ? new Date().toISOString() : null
      })
      .eq("id", id.data!)
      .select(
        `
        *,
        user_profile:created_by(id,email,full_name,role)
      `
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(reminder);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd" },
      { status: 500 }
    );
  }
}
