import type { getServiceClient } from "@/lib/server-auth";
import type { Lead } from "@/lib/types";
import { isMandatoryLead } from "@/lib/lead-outcomes";

const mandatoryLeadSelect = "id,full_name,phone,status,callback_at,meeting_at,meeting_address,address,assigned_to,crm_environment,created_at,updated_at,last_opened_at,source,postal_code,voivodeship,county,meeting_note,resignation_reason,contract_number";

// Existing overdue work is intentionally grandfathered. Only callbacks and
// meetings scheduled from the rollout day onward can enter the blocking queue.
export const MANDATORY_QUEUE_ROLLOUT_AT = "2026-09-02T22:00:00.000Z"; // 2026-09-03 00:00 Europe/Warsaw

type ScheduleHistory = {
  lead_id: string;
  created_at: string;
  new_value: Record<string, unknown> | null;
};

export function wasCurrentScheduleSetAfterRollout(lead: Pick<Lead, "id" | "status" | "callback_at" | "meeting_at">, history: ScheduleHistory[]) {
  const field = lead.status === "Call back" ? "callback_at" : lead.status === "Spotkanie" ? "meeting_at" : null;
  const currentSchedule = field ? lead[field] : null;
  if (!field || !currentSchedule) return false;
  return history.some((entry) => entry.lead_id === lead.id && entry.created_at >= MANDATORY_QUEUE_ROLLOUT_AT && entry.new_value?.[field] === currentSchedule);
}

export async function getScheduledLeadsSinceRollout(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  profile: { id: string; crm_environment: string }
) {
  const scheduled = await supabaseAdmin
    .from("leads")
    .select(mandatoryLeadSelect)
    .eq("crm_environment", profile.crm_environment)
    .eq("assigned_to", profile.id)
    .in("status", ["Call back", "Spotkanie"])
    .or("callback_at.not.is.null,meeting_at.not.is.null");
  if (scheduled.error) throw new Error(scheduled.error.message);
  const uniqueItems = [...new Map(((scheduled.data || []) as unknown as Lead[]).map((lead) => [lead.id, lead])).values()];
  if (!uniqueItems.length) return [];
  const historyResult = await supabaseAdmin
    .from("lead_history")
    .select("lead_id,created_at,new_value")
    .in("lead_id", uniqueItems.map((lead) => lead.id))
    .eq("action_type", "status_change")
    .gte("created_at", MANDATORY_QUEUE_ROLLOUT_AT)
    .order("created_at", { ascending: false });
  if (historyResult.error) throw new Error(historyResult.error.message);
  const scheduleHistory = (historyResult.data || []) as ScheduleHistory[];
  return uniqueItems.filter((lead) => wasCurrentScheduleSetAfterRollout(lead, scheduleHistory)).sort((left, right) => {
    const leftAt = left.callback_at || left.meeting_at || "";
    const rightAt = right.callback_at || right.meeting_at || "";
    return leftAt.localeCompare(rightAt);
  });
}

export async function getMandatoryLeads(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  profile: { id: string; crm_environment: string },
  now = new Date()
) {
  return (await getScheduledLeadsSinceRollout(supabaseAdmin, profile)).filter((lead) => isMandatoryLead(lead, now));
}
