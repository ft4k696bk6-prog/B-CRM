import { NextResponse } from "next/server";
import { uuidString } from "@/lib/api-validation";
import { canAccessLead, requireApiProfile } from "@/lib/server-auth";
import type { Lead } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const leadId = uuidString(url.searchParams.get("lead_id"), "lead_id");

    if (!leadId.ok) {
      return NextResponse.json({ error: leadId.error }, { status: 400 });
    }

    const { data: lead } = await auth.supabaseAdmin
      .from("leads")
      .select("id,assigned_to,crm_environment")
      .eq("id", leadId.data!)
      .eq("crm_environment", auth.profile.crm_environment)
      .single<Pick<Lead, "id" | "assigned_to" | "crm_environment">>();

    if (!lead || !canAccessLead(auth.profile, lead)) {
      return NextResponse.json({ error: "Brak dostępu do leada." }, { status: 403 });
    }

    const { data, error } = await auth.supabaseAdmin
      .from("lead_calls")
      .select("*, user_profile:user_id(id,email,full_name,role)")
      .eq("lead_id", leadId.data!)
      .eq("crm_environment", auth.profile.crm_environment)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      if (error.message.includes("lead_calls")) {
        return NextResponse.json([]);
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
