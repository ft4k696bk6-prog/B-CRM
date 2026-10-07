import type { LeadStatus } from "@/lib/types";

export const LEAD_OUTCOMES = ["callback", "meeting", "no_answer", "return", "contract", "resignation", "meeting_no_show"] as const;
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];

function warsawDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const pick = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function nextBusinessDateKey(value: Date) {
  const [year, month, day] = warsawDateKey(value).split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day + 1));
  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;
}

export function isAfterMeeting(status: LeadStatus, meetingAt?: string | null, now = new Date()) {
  return status === "Po spotkaniu" || (status === "Spotkanie" && Boolean(meetingAt) && new Date(meetingAt!).getTime() <= now.getTime());
}

export function allowedOutcomes(status: LeadStatus, meetingAt?: string | null, now = new Date()): LeadOutcome[] {
  if (status === "Umowa" || status === "Rezygnacja") return [];
  if (isAfterMeeting(status, meetingAt, now)) {
    return ["return", "callback", "resignation", "meeting", "contract", "meeting_no_show"];
  }
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

  const afterMeeting = isAfterMeeting(status, scheduledMeetingAt, now);
  if (!allowedOutcomes(status, scheduledMeetingAt, now).includes(outcome as LeadOutcome)) {
    return "Ta akcja nie jest dostępna na obecnym etapie leada.";
  }

  if (outcome === "meeting_no_show") {
    if (!afterMeeting) return "Brak spotkania można oznaczyć dopiero po jego terminie.";
    return null;
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

  if (afterMeeting && !values.note?.trim()) {
    return "Rozliczenie odbytego spotkania wymaga notatki.";
  }

  if (!afterMeeting && (outcome === "return" || outcome === "resignation") && !values.note?.trim()) {
    return outcome === "return" ? "Zwrot wymaga notatki." : "Wpisz powód rezygnacji.";
  }

  return null;
}

export function isMandatoryLead(lead: { status: LeadStatus; callback_at: string | null; meeting_at: string | null }, now = new Date()) {
  if (lead.status === "Umowa" || lead.status === "Rezygnacja") return false;

  const callbackDue = lead.status === "Call back" && Boolean(lead.callback_at) && new Date(lead.callback_at!).getTime() <= now.getTime();

  let meetingDue = false;
  if (lead.status === "Spotkanie" && lead.meeting_at) {
    const meetingDate = new Date(lead.meeting_at);
    if (!Number.isNaN(meetingDate.getTime()) && meetingDate.getTime() <= now.getTime()) {
      meetingDue = warsawDateKey(now) >= nextBusinessDateKey(meetingDate);
    }
  }

  return callbackDue || meetingDue;
}
