import type { Lead } from "@/lib/types";

export const ASSIGNMENT_BATCH_SIZES = [5, 10, 15, 25, 50, 100] as const;

export const FOCUSED_LEAD_STATUSES = ["Call back", "Spotkanie", "Po spotkaniu", "Umowa", "Rezygnacja"] as const;

export const RETURN_PROTECTED_STATUSES = ["Call back", "Spotkanie", "Umowa", "Rezygnacja"] as const;

const VOIVODESHIP_POSTAL_PREFIXES: Record<string, string[]> = {
  lubelskie: ["20", "21", "22", "23", "24"]
};

export function voivodeshipFilterTerms(voivodeship: string) {
  const normalized = voivodeship.trim().toLowerCase().replace(/[,%]/g, "");
  const terms = [`voivodeship.ilike.%${normalized}%`];
  for (const prefix of VOIVODESHIP_POSTAL_PREFIXES[normalized] || []) {
    terms.push(`postal_code.ilike.${prefix}-%`);
  }
  return terms.join(",");
}

export function postgrestInValues(values: readonly string[]) {
  return `(${values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(",")})`;
}

export function canBulkReturnLead(
  lead: Pick<Lead, "status" | "callback_at" | "meeting_at">
) {
  return (
    !RETURN_PROTECTED_STATUSES.some((status) => status === lead.status) &&
    !lead.callback_at &&
    !lead.meeting_at
  );
}

export function startOfDay(value: string) {
  return `${value}T00:00:00.000Z`;
}

export function endOfDay(value: string) {
  return `${value}T23:59:59.999Z`;
}

export function needsNextAction(lead: Pick<Lead, "status" | "callback_at" | "meeting_at">) {
  if (["Umowa", "Rezygnacja"].includes(lead.status)) return false;
  return !lead.callback_at && !lead.meeting_at;
}

export function escapeCsv(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
