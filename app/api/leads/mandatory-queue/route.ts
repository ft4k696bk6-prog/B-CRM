import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { getScheduledLeadsSinceRollout } from "@/lib/server-lead-work";
import { isMandatoryLead } from "@/lib/lead-outcomes";

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (auth.profile.role !== "handlowiec") return NextResponse.json({ leads: [] });

  try {
    const { data: queueProfile, error: profileError } = await auth.supabaseAdmin
      .from("profiles")
      .select("mandatory_queue_snoozed_until")
      .eq("id", auth.profile.id)
      .single();
    if (profileError) throw new Error(profileError.message);
    const snoozedUntil = queueProfile?.mandatory_queue_snoozed_until || null;
    if (snoozedUntil && new Date(snoozedUntil).getTime() > Date.now()) {
      return NextResponse.json({ leads: [], scheduledLeadIds: [], snoozedUntil });
    }
    const scheduled = await getScheduledLeadsSinceRollout(auth.supabaseAdmin, auth.profile);
    return NextResponse.json({
      leads: scheduled.filter((lead) => isMandatoryLead(lead)),
      scheduledLeadIds: scheduled.map((lead) => lead.id),
      snoozedUntil: null
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nie udało się pobrać kolejki." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (!["owner", "admin"].includes(auth.profile.role)) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  const body = await request.json() as { salespersonId?: unknown };
  const salespersonId = typeof body.salespersonId === "string" ? body.salespersonId : "";
  if (!salespersonId) return NextResponse.json({ error: "Wybierz handlowca." }, { status: 400 });
  const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await auth.supabaseAdmin
    .from("profiles")
    .update({ mandatory_queue_snoozed_until: snoozedUntil })
    .eq("id", salespersonId)
    .eq("crm_environment", auth.profile.crm_environment)
    .in("role", ["handlowiec", "sales"])
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Nie znaleziono handlowca w tym CRM." }, { status: 404 });
  return NextResponse.json({ snoozedUntil });
}
