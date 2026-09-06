import type { LeadStatus } from "@/lib/types";

export const LEAD_OUTCOMES = ["callback", "meeting", "no_answer", "return", "contract", "resignation"] as const;
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];

export function isAfterMeeting(status: LeadStatus, meetingAt?: string | null, now = new Date()) {
  return status === "Po spotkaniu" || (status === "Spotkanie" && Boolean(meetingAt) && new Date(meetingAt!).getTime() <= now.getTime());
}

export function allowedOutcomes(status: LeadStatus, meetingAt?: string | null, now = new Date()): LeadOutcome[] {
  if (status === "Umowa" || status === "Rezygnacja") return [];
  if (isAfterMeeting(status, meetingAt, now)) return ["contract", "resignation", "callback", "return"];
  return ["callback", "meeting", "no_answer", "resignation", "return"];
}

export function validateLeadOutcome(
  status: LeadStatus,
  outcome: unknown,
  values: { callbackAt?: string; meetingAt?: string; address?: string; note?: string },
  now = new Date(),
  scheduledMeetingAt?: string | null
) {
  if (typeof outcome !== "string" || !LEAD_OUTCOMES.includes(outcome as LeadOutcome)) {
    return "Niepoprawny wynik kontaktu.";
  }
  if (!allowedOutcomes(status, scheduledMeetingAt, now).includes(outcome as LeadOutcome)) {
    return "Ta akcja nie jest dostępna na obecnym etapie leada.";
  }
  if (outcome === "callback") {
    const date = values.callbackAt ? new Date(values.callbackAt) : null;
    if (!date || Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) return "Wybierz przyszłą datę i godzinę call-backu.";
  }
  if (outcome === "meeting") {
    const date = values.meetingAt ? new Date(values.meetingAt) : null;
    if (!date || Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) return "Wybierz przyszły termin spotkania.";
    if (!values.address?.trim()) return "Wpisz adres spotkania.";
  }
  if ((outcome === "return" || outcome === "resignation" || outcome === "contract") && !values.note?.trim()) {
    return outcome === "return" ? "Zwrot wymaga notatki." : outcome === "resignation" ? "Wpisz powód rezygnacji." : "Wpisz notatkę po spotkaniu.";
  }
  return null;
}

export function isMandatoryLead(lead: { status: LeadStatus; callback_at: string | null; meeting_at: string | null }, now = new Date()) {
  if (lead.status === "Umowa" || lead.status === "Rezygnacja") return false;
  const callbackDue = lead.status === "Call back" && Boolean(lead.callback_at) && new Date(lead.callback_at!).getTime() <= now.getTime();
  const meetingDue = lead.status === "Spotkanie" && Boolean(lead.meeting_at) && new Date(lead.meeting_at!).getTime() <= now.getTime();
  return callbackDue || meetingDue;
}
