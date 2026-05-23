import { NextResponse } from "next/server";
import { isSalesRole } from "@/lib/roles";
import { requireApiProfile } from "@/lib/server-auth";

type ClaimBody = {
  leadId?: string;
};

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if (auth.error) return auth.error;

    const body = (await request.json().catch(() => ({}))) as ClaimBody;
    const leadId = body.leadId?.trim();

    if (!leadId) {
      return NextResponse.json({ error: "Brak leada do przejęcia." }, { status: 400 });
    }

    if (!isSalesRole(auth.profile.role) || !auth.profile.can_view_lead_pool) {
      return NextResponse.json({ error: "Nie masz dostępu do puli leadów." }, { status: 403 });
    }

    const { data: lead, error: leadError } = await auth.supabaseAdmin
      .from("leads")
      .select("id,assigned_to,status,crm_environment")
      .eq("id", leadId)
      .eq("crm_environment", auth.profile.crm_environment)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Nie znaleziono leada w puli." }, { status: 404 });
    }

    if (lead.assigned_to) {
      return NextResponse.json({ error: "Ten lead jest już przypisany." }, { status: 409 });
    }

    const { error: updateError } = await auth.supabaseAdmin
      .from("leads")
      .update({
        assigned_to: auth.profile.id,
        status: lead.status === "Nowy" ? "Przypisany" : lead.status
      })
      .eq("id", leadId)
      .is("assigned_to", null)
      .eq("crm_environment", auth.profile.crm_environment);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await auth.supabaseAdmin.from("lead_history").insert({
      lead_id: leadId,
      user_id: auth.profile.id,
      action_type: "assigned",
      description: "Handlowiec przejął lead ze wspólnej puli."
    });

    return NextResponse.json({ id: leadId, assigned_to: auth.profile.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się przejąć leada." },
      { status: 500 }
    );
  }
}
