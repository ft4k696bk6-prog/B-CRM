import { NextResponse } from "next/server";
import { allowedOutcomes, type LeadOutcome, validateLeadOutcome } from "@/lib/lead-outcomes";
import { canAccessLeadWithTeam, requireApiProfile } from "@/lib/server-auth";
import { getMandatoryLeads } from "@/lib/server-lead-work";
import type { Lead } from "@/lib/types";

type OutcomeBody = {
  leadId?: unknown;
  outcome?: unknown;
  callbackAt?: unknown;
  meetingAt?: unknown;
  address?: unknown;
  note?: unknown;
};

const outcomeLabels: Record<LeadOutcome, string> = {
  callback: "Ustawiono nowy call-back.",
  meeting: "Umówiono spotkanie.",
  no_answer: "Klient nie odebrał.",
  return: "Zwrócono leada do puli.",
  contract: "Rozpoczęto przygotowanie umowy.",
  resignation: "Zapisano rezygnację klienta."
};

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  const body = (await request.json()) as OutcomeBody;
  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  const outcome = body.outcome as LeadOutcome;
  const callbackAt = typeof body.callbackAt === "string" ? body.callbackAt : "";
  const meetingAt = typeof body.meetingAt === "string" ? body.meetingAt : "";
  const address = typeof body.address === "string" ? body.address : "";
  const note = typeof body.note === "string" ? body.note : "";
  if (!leadId) return NextResponse.json({ error: "Brak leada." }, { status: 400 });

  const { data, error } = await auth.supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("crm_environment", auth.profile.crm_environment)
    .single();
  if (error || !data) return NextResponse.json({ error: "Nie znaleziono leada." }, { status: 404 });
  const lead = data as Lead;
  if (!(await canAccessLeadWithTeam(auth.supabaseAdmin, auth.profile, lead))) {
    return NextResponse.json({ error: "Nie masz dostępu do tego leada." }, { status: 403 });
  }

  if (auth.profile.role === "handlowiec") {
    const mandatory = await getMandatoryLeads(auth.supabaseAdmin, auth.profile);
    if (mandatory.length > 0 && !mandatory.some((item) => item.id === lead.id)) {
      return NextResponse.json({ error: "Najpierw obsłuż zaległy call-back lub spotkanie z obowiązkowej kolejki." }, { status: 423 });
    }
  }

  const validationError = validateLeadOutcome(lead.status, outcome, { callbackAt, meetingAt, address, note }, new Date(), lead.meeting_at);
  if (validationError) return NextResponse.json({ error: validationError, allowedOutcomes: allowedOutcomes(lead.status, lead.meeting_at) }, { status: 400 });

  const clearSchedule = { callback_at: null, meeting_at: null };
  let patch: Record<string, unknown> = {};
  if (outcome === "callback") patch = { ...clearSchedule, status: "Call back", callback_at: new Date(callbackAt).toISOString() };
  if (outcome === "meeting") patch = { ...clearSchedule, status: "Spotkanie", meeting_at: new Date(meetingAt).toISOString(), meeting_address: address.trim(), address: address.trim() };
  if (outcome === "no_answer") patch = { ...clearSchedule, status: "Nie odebrał" };
  if (outcome === "return") patch = { ...clearSchedule, status: "Nowy", assigned_to: null, meeting_address: null, meeting_note: null, resignation_reason: null, contract_number: null, last_opened_at: null };
  if (outcome === "contract") patch = { ...clearSchedule, status: "Po spotkaniu", meeting_note: note.trim() };
  if (outcome === "resignation") patch = { ...clearSchedule, status: "Rezygnacja", resignation_reason: note.trim() };

  const { error: updateError } = await auth.supabaseAdmin.from("leads").update(patch).eq("id", lead.id).eq("crm_environment", auth.profile.crm_environment);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await auth.supabaseAdmin.from("lead_history").insert({
    lead_id: lead.id,
    user_id: auth.profile.id,
    action_type: outcome === "return" ? "return" : "status_change",
    description: note.trim() ? `${outcomeLabels[outcome]} ${note.trim()}` : outcomeLabels[outcome],
    old_value: { status: lead.status, assigned_to: lead.assigned_to, callback_at: lead.callback_at, meeting_at: lead.meeting_at },
    new_value: patch
  });

  return NextResponse.json({
    lead: { ...lead, ...patch },
    redirect: outcome === "contract" ? `/realizacja/nowa?leadId=${lead.id}` : null
  });
}
