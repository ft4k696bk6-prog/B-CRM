import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { canBulkReturnLead, postgrestInValues, RETURN_PROTECTED_STATUSES } from "@/lib/admin-leads";
import type { Lead, Profile } from "@/lib/types";

type ReturnLeadBody = {
  leadIds?: unknown;
  ownOpen?: unknown;
};

function cleanUuidList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())))];
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if ("error" in auth) return auth.error;

    const { supabaseAdmin, profile } = auth;
    const body = (await request.json()) as ReturnLeadBody;
    const ownOpen = body.ownOpen === true;
    let leadIds = cleanUuidList(body.leadIds);

    if (ownOpen) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("crm_environment", profile.crm_environment)
        .eq("assigned_to", profile.id)
        .not("status", "in", postgrestInValues(RETURN_PROTECTED_STATUSES))
        .is("callback_at", null)
        .is("meeting_at", null);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      leadIds = ((data || []) as Pick<Lead, "id">[]).map((lead) => lead.id);
    }

    if (leadIds.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    if (leadIds.length > 1000) {
      return NextResponse.json({ error: "Na raz możesz zwrócić maksymalnie 1000 leadów." }, { status: 400 });
    }

    const { data: leads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("id,assigned_to,crm_environment,status,callback_at,meeting_at")
      .eq("crm_environment", profile.crm_environment)
      .in("id", leadIds);

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 400 });
    }

    const foundLeads = (leads || []) as Pick<
      Lead,
      "id" | "assigned_to" | "crm_environment" | "status" | "callback_at" | "meeting_at"
    >[];
    if (foundLeads.length !== leadIds.length) {
      return NextResponse.json({ error: "Część leadów nie istnieje albo jest poza tym CRM." }, { status: 404 });
    }

    let teamIds = new Set<string>();
    if (profile.role === "menadzer") {
      const { data: teamMembers, error: teamError } = await supabaseAdmin
        .from("profiles")
        .select("id,manager_id,crm_environment")
        .eq("crm_environment", profile.crm_environment)
        .eq("manager_id", profile.id);

      if (teamError) return NextResponse.json({ error: teamError.message }, { status: 400 });
      teamIds = new Set(((teamMembers || []) as Pick<Profile, "id">[]).map((person) => person.id));
    }

    const canReturnEveryLead = foundLeads.every((lead) => {
      if (profile.role === "owner" || profile.role === "admin") return true;
      if (profile.role === "menadzer") {
        return lead.assigned_to === null || lead.assigned_to === profile.id || teamIds.has(lead.assigned_to);
      }
      return lead.assigned_to === profile.id;
    });

    if (!canReturnEveryLead) {
      return NextResponse.json({ error: "Nie masz uprawnień do zwrotu tych leadów." }, { status: 403 });
    }

    const returnableIds = foundLeads.filter(canBulkReturnLead).map((lead) => lead.id);
    if (returnableIds.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update({
        status: "Zwrot",
        assigned_to: null
      })
      .eq("crm_environment", profile.crm_environment)
      .in("id", returnableIds);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ updated: returnableIds.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
