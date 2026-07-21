import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import type { Lead, Profile } from "@/lib/types";

type AssignLeadBody = {
  leadIds?: unknown;
  assignedTo?: unknown;
};

const assignableRoles = ["handlowiec", "sales", "menadzer"];

function cleanUuidList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())))];
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if ("error" in auth) return auth.error;

    const { supabaseAdmin, profile } = auth;
    const body = (await request.json()) as AssignLeadBody;
    const leadIds = cleanUuidList(body.leadIds);
    const assignedTo = typeof body.assignedTo === "string" && body.assignedTo.trim() ? body.assignedTo.trim() : null;

    if (leadIds.length === 0) {
      return NextResponse.json({ error: "Wybierz leady do przypisania." }, { status: 400 });
    }

    if (leadIds.length > 1000) {
      return NextResponse.json({ error: "Na raz możesz przypisać maksymalnie 1000 leadów." }, { status: 400 });
    }

    if (!["owner", "admin", "menadzer"].includes(profile.role)) {
      return NextResponse.json({ error: "Nie masz uprawnień do przypisywania leadów." }, { status: 403 });
    }

    const { data: teamMembers, error: teamError } = await supabaseAdmin
      .from("profiles")
      .select("id,role,manager_id,crm_environment")
      .eq("crm_environment", profile.crm_environment)
      .in("role", assignableRoles);

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 400 });
    }

    const people = (teamMembers || []) as Pick<Profile, "id" | "role" | "manager_id" | "crm_environment">[];
    const teamIds = new Set(people.filter((person) => person.manager_id === profile.id).map((person) => person.id));
    const target = assignedTo ? people.find((person) => person.id === assignedTo) : null;

    if (assignedTo && !target) {
      return NextResponse.json({ error: "Nie znaleziono osoby do przypisania w tym CRM." }, { status: 404 });
    }

    if (profile.role === "menadzer" && assignedTo && assignedTo !== profile.id && !teamIds.has(assignedTo)) {
      return NextResponse.json({ error: "Menadżer może przypisywać tylko do siebie albo swojego zespołu." }, { status: 403 });
    }

    const { data: leads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("id,assigned_to,crm_environment,status")
      .eq("crm_environment", profile.crm_environment)
      .in("id", leadIds);

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 400 });
    }

    const foundLeads = (leads || []) as Pick<Lead, "id" | "assigned_to" | "crm_environment" | "status">[];
    if (foundLeads.length !== leadIds.length) {
      return NextResponse.json({ error: "Część leadów nie istnieje albo jest poza tym CRM." }, { status: 404 });
    }

    if (profile.role === "menadzer") {
      const canManageEveryLead = foundLeads.every((lead) => {
        return lead.assigned_to === null || lead.assigned_to === profile.id || teamIds.has(lead.assigned_to);
      });

      if (!canManageEveryLead) {
        return NextResponse.json({ error: "Nie możesz przypisać leadów spoza swojego zespołu." }, { status: 403 });
      }
    }

    const lockedContractLead = foundLeads.find(
      (lead) => ["Umowa", "Rezygnacja"].includes(lead.status) && lead.assigned_to !== assignedTo
    );

    if (lockedContractLead) {
      return NextResponse.json(
        { error: "Umowy i rezygnacje są zamknięte i nie można zmieniać ich przypisania." },
        { status: 409 }
      );
    }

    const assignmentPatch = assignedTo
      ? { assigned_to: assignedTo }
      : {
          assigned_to: null,
          status: "Nowy",
          callback_at: null,
          meeting_at: null,
          meeting_address: null,
          meeting_note: null,
          resignation_reason: null,
          contract_number: null,
          last_opened_at: null
        };

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update(assignmentPatch)
      .eq("crm_environment", profile.crm_environment)
      .in("id", leadIds);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ updated: leadIds.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
