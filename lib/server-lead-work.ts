import type { getServiceClient } from "@/lib/server-auth";
import type { Lead } from "@/lib/types";

const mandatoryLeadSelect = "id,full_name,phone,status,callback_at,meeting_at,meeting_address,address,assigned_to,crm_environment,created_at,updated_at,last_opened_at,source,postal_code,voivodeship,county,meeting_note,resignation_reason,contract_number";

export async function getMandatoryLeads(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  profile: { id: string; crm_environment: string },
  now = new Date()
) {
  const timestamp = now.toISOString();
  const [callbacks, meetings] = await Promise.all([
    supabaseAdmin.from("leads").select(mandatoryLeadSelect).eq("crm_environment", profile.crm_environment).eq("assigned_to", profile.id).eq("status", "Call back").lte("callback_at", timestamp),
    supabaseAdmin.from("leads").select(mandatoryLeadSelect).eq("crm_environment", profile.crm_environment).eq("assigned_to", profile.id).eq("status", "Spotkanie").lte("meeting_at", timestamp)
  ]);
  if (callbacks.error) throw new Error(callbacks.error.message);
  if (meetings.error) throw new Error(meetings.error.message);
  const items = [...(callbacks.data || []), ...(meetings.data || [])] as unknown as Lead[];
  return [...new Map(items.map((lead) => [lead.id, lead])).values()].sort((left, right) => {
    const leftAt = left.callback_at || left.meeting_at || "";
    const rightAt = right.callback_at || right.meeting_at || "";
    return leftAt.localeCompare(rightAt);
  });
}
