import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const oneTimeKey = "cleanup-20260722-x9K4mQ7vP2sL8nR5";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Brak konfiguracji Supabase.");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function POST(request: Request) {
  if (request.headers.get("x-cleanup-key") !== oneTimeKey) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  try {
    const supabase = adminClient();
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const { data: staleMeetings, error: staleError } = await supabase
      .from("leads")
      .update({
        status: "Nowy",
        assigned_to: null,
        meeting_at: null,
        meeting_address: null,
        meeting_note: null,
        last_opened_at: null
      })
      .eq("crm_environment", "production")
      .eq("status", "Spotkanie")
      .or(`meeting_at.lt.${monthStart},meeting_at.is.null`)
      .select("id");

    if (staleError) throw staleError;

    const { data: returnedOpen, error: openError } = await supabase
      .from("leads")
      .update({
        status: "Nowy",
        assigned_to: null,
        callback_at: null,
        meeting_at: null,
        meeting_address: null,
        meeting_note: null,
        resignation_reason: null,
        contract_number: null,
        last_opened_at: null
      })
      .eq("crm_environment", "production")
      .not("assigned_to", "is", null)
      .not("status", "in", '("Spotkanie","Call back","Umowa","Rezygnacja")')
      .select("id");

    if (openError) throw openError;

    const { data: returnedClosed, error: closedError } = await supabase
      .from("leads")
      .update({ assigned_to: null })
      .eq("crm_environment", "production")
      .not("assigned_to", "is", null)
      .in("status", ["Umowa", "Rezygnacja"])
      .select("id");

    if (closedError) throw closedError;

    const { count: remainingMeetings, error: countError } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("crm_environment", "production")
      .eq("status", "Spotkanie");

    if (countError) throw countError;

    const { data: meetingRows, error: meetingRowsError } = await supabase
      .from("leads")
      .select("meeting_at,assigned_profile:profiles!leads_assigned_to_fkey(full_name)")
      .eq("crm_environment", "production")
      .eq("status", "Spotkanie");

    if (meetingRowsError) throw meetingRowsError;

    const diagnostics = (meetingRows || []).reduce(
      (result, row) => {
        const meetingAt = row.meeting_at ? new Date(row.meeting_at).getTime() : null;
        const bucket = meetingAt === null ? "withoutDate" : meetingAt < new Date(monthStart).getTime() ? "beforeMonth" : "currentMonth";
        result[bucket] += 1;
        const profile = Array.isArray(row.assigned_profile) ? row.assigned_profile[0] : row.assigned_profile;
        const owner = profile?.full_name || "Nieprzypisany";
        result.byOwner[owner] = (result.byOwner[owner] || 0) + 1;
        return result;
      },
      { withoutDate: 0, beforeMonth: 0, currentMonth: 0, byOwner: {} as Record<string, number> }
    );

    return NextResponse.json({
      staleMeetingsReset: staleMeetings?.length || 0,
      leadsReturned: (returnedOpen?.length || 0) + (returnedClosed?.length || 0),
      remainingMeetings: remainingMeetings || 0,
      diagnostics
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
