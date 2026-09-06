import type { Lead, LeadStatus } from "./types";

export const LEAD_PIPELINE_STATUSES: LeadStatus[] = [
  "Nowy",
  "Nie odebrał",
  "Call back",
  "Spotkanie",
  "Po spotkaniu",
  "Umowa",
  "Rezygnacja"
];

export function groupLeadsByStatus(leads: Lead[]) {
  const groups = new Map<LeadStatus, Lead[]>(LEAD_PIPELINE_STATUSES.map((status) => [status, []]));

  for (const lead of leads) {
    const bucket = groups.get(lead.status);
    if (bucket) bucket.push(lead);
  }

  return LEAD_PIPELINE_STATUSES.map((status) => ({
    status,
    leads: groups.get(status) || []
  }));
}
