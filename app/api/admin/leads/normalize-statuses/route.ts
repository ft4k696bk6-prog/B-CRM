import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";

const cleanupCutoff = "2026-07-21T23:59:59.999Z";

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if ("error" in auth) return auth.error;
    if (!["owner", "admin"].includes(auth.profile.role)) {
      return NextResponse.json({ error: "Brak uprawnień do porządkowania statusów." }, { status: 403 });
    }

    const { supabaseAdmin, profile } = auth;
    const mappings = [
      { from: "Przypisany", to: "Nowy" },
      { from: "Błędny numer", to: "Nie odebrał" },
      { from: "Do weryfikacji", to: "Nowy" }
    ];
    let updated = 0;

    for (const mapping of mappings) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .update({ status: mapping.to })
        .eq("crm_environment", profile.crm_environment)
        .eq("status", mapping.from)
        .select("id");

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      updated += data?.length || 0;
    }

    const { data: returned, error: returnedError } = await supabaseAdmin
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
      .eq("crm_environment", profile.crm_environment)
      .eq("status", "Zwrot")
      .select("id");

    if (returnedError) return NextResponse.json({ error: returnedError.message }, { status: 400 });
    updated += returned?.length || 0;

    const { data: staleMeetings, error: staleMeetingsError } = await supabaseAdmin
      .from("leads")
      .update({
        status: "Nowy",
        assigned_to: null,
        meeting_at: null,
        meeting_address: null,
        meeting_note: null,
        last_opened_at: null
      })
      .eq("crm_environment", profile.crm_environment)
      .eq("status", "Spotkanie")
      .lt("meeting_at", startOfCurrentMonth())
      .lte("updated_at", cleanupCutoff)
      .select("id");

    if (staleMeetingsError) {
      return NextResponse.json({ error: staleMeetingsError.message }, { status: 400 });
    }

    const { data: returnedOpenLeads, error: returnedOpenLeadsError } = await supabaseAdmin
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
      .eq("crm_environment", profile.crm_environment)
      .not("assigned_to", "is", null)
      .not("status", "in", '("Spotkanie","Call back","Umowa","Rezygnacja")')
      .lte("updated_at", cleanupCutoff)
      .select("id");

    if (returnedOpenLeadsError) {
      return NextResponse.json({ error: returnedOpenLeadsError.message }, { status: 400 });
    }

    const { data: returnedClosedLeads, error: returnedClosedLeadsError } = await supabaseAdmin
      .from("leads")
      .update({ assigned_to: null })
      .eq("crm_environment", profile.crm_environment)
      .not("assigned_to", "is", null)
      .in("status", ["Umowa", "Rezygnacja"])
      .lte("updated_at", cleanupCutoff)
      .select("id");

    if (returnedClosedLeadsError) {
      return NextResponse.json({ error: returnedClosedLeadsError.message }, { status: 400 });
    }

    const staleMeetingsCount = staleMeetings?.length || 0;
    const returnedOpenCount = returnedOpenLeads?.length || 0;
    const returnedClosedCount = returnedClosedLeads?.length || 0;

    return NextResponse.json({
      updated: updated + staleMeetingsCount + returnedOpenCount + returnedClosedCount,
      staleMeetings: staleMeetingsCount,
      returned: returnedOpenCount + returnedClosedCount
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
