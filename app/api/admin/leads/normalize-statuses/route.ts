import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";

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

    return NextResponse.json({ updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
