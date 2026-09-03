import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { getScheduledLeadsSinceRollout } from "@/lib/server-lead-work";
import { isMandatoryLead } from "@/lib/lead-outcomes";

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (auth.profile.role !== "handlowiec") return NextResponse.json({ leads: [], scheduledLeadIds: [] });

  try {
    const scheduled = await getScheduledLeadsSinceRollout(auth.supabaseAdmin, auth.profile);
    return NextResponse.json({
      leads: scheduled.filter((lead) => isMandatoryLead(lead)),
      scheduledLeadIds: scheduled.map((lead) => lead.id)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nie udało się pobrać kolejki." }, { status: 400 });
  }
}
