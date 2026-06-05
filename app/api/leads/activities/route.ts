import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enumValue, optionalRecord, optionalString, requiredString, uuidString } from "@/lib/api-validation";

type CreateActivityBody = {
  lead_id: string;
  activity_type:
    | "comment"
    | "status_change"
    | "callback_scheduled"
    | "meeting_scheduled"
    | "meeting_address_changed"
    | "contract_number_set"
    | "resignation_recorded"
    | "file_uploaded"
    | "file_deleted"
    | "assigned"
    | "unassigned"
    | "lead_created";
  title: string;
  description?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
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

    const { data: activities, error } = await supabase
      .from("lead_activities")
      .select(
        `
        *,
        user_profile:user_id(id,email,full_name,role)
      `
      )
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(activities || []);
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

    const body = (await request.json()) as CreateActivityBody;
    const leadId = uuidString(body.lead_id, "lead_id");
    const type = enumValue(body.activity_type, "activity_type", ["comment", "status_change", "callback_scheduled", "meeting_scheduled", "meeting_address_changed", "contract_number_set", "resignation_recorded", "file_uploaded", "file_deleted", "assigned", "unassigned", "lead_created"] as const);
    const title = requiredString(body.title, "title", 160);
    const description = optionalString(body.description, "description", 4000);
    const oldValue = optionalRecord(body.old_value, "old_value");
    const newValue = optionalRecord(body.new_value, "new_value");
    const metadata = optionalRecord(body.metadata, "metadata");

    for (const result of [leadId, type, title, description, oldValue, newValue, metadata]) {
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { data: activity, error } = await supabase
      .from("lead_activities")
      .insert({
        lead_id: leadId.data!,
        user_id: user.user.id,
        activity_type: type.data!,
        title: title.data!,
        description: description.data!,
        old_value: oldValue.data!,
        new_value: newValue.data!,
        metadata: metadata.data!
      })
      .select(
        `
        *,
        user_profile:user_id(id,email,full_name,role)
      `
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(activity);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd" },
      { status: 500 }
    );
  }
}
