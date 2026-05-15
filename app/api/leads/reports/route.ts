import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const userId = url.searchParams.get("user_id");
    const reportDate = url.searchParams.get("report_date");

    if (!userId || !reportDate) {
      return NextResponse.json(
        { error: "Brak user_id lub report_date" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient(token);

    const { data: report, error } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("user_id", userId)
      .eq("report_date", reportDate)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(report || null);
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

    const body = await request.json();
    const {
      report_date,
      total_leads_worked,
      total_activities,
      calls_made,
      meetings_scheduled,
      contracts_signed,
      resignations_recorded,
      summary
    } = body;

    const { data: report, error } = await supabase
      .from("daily_reports")
      .upsert(
        {
          user_id: user.user.id,
          report_date,
          total_leads_worked: total_leads_worked || 0,
          total_activities: total_activities || 0,
          calls_made: calls_made || 0,
          meetings_scheduled: meetings_scheduled || 0,
          contracts_signed: contracts_signed || 0,
          resignations_recorded: resignations_recorded || 0,
          summary: summary || null
        },
        {
          onConflict: "user_id,report_date"
        }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd" },
      { status: 500 }
    );
  }
}
