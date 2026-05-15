import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const { data: reminder, error } = await supabase
      .from("lead_reminders")
      .insert({
        lead_id: body.lead_id,
        created_by: user.user.id,
        reminder_type: body.reminder_type,
        title: body.title,
        description: body.description || null,
        reminder_at: body.reminder_at
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
    const { id, is_completed } = body;

    const { data: reminder, error } = await supabase
      .from("lead_reminders")
      .update({
        is_completed,
        completed_at: is_completed ? new Date().toISOString() : null
      })
      .eq("id", id)
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
