import { supabase } from "@/lib/supabase";
import type { ActivityType } from "@/lib/types";

export async function createActivity(
  leadId: string,
  userId: string,
  activityType: ActivityType,
  title: string,
  options?: {
    description?: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    user_id: userId,
    activity_type: activityType,
    title,
    description: options?.description || null,
    old_value: options?.oldValue || null,
    new_value: options?.newValue || null,
    metadata: options?.metadata || null
  });

  if (error) {
    console.error("Error creating activity:", error);
    throw error;
  }
}

export async function logStatusChange(
  leadId: string,
  userId: string,
  oldStatus: string,
  newStatus: string
) {
  return createActivity(leadId, userId, "status_change", `Status zmieniony z "${oldStatus}" na "${newStatus}"`, {
    oldValue: { status: oldStatus },
    newValue: { status: newStatus }
  });
}

export async function logCallbackScheduled(
  leadId: string,
  userId: string,
  callbackAt: string
) {
  return createActivity(leadId, userId, "callback_scheduled", `Call-back zaplanowany na ${callbackAt}`, {
    metadata: { callback_at: callbackAt }
  });
}

export async function logMeetingScheduled(
  leadId: string,
  userId: string,
  meetingAt: string,
  address?: string
) {
  return createActivity(leadId, userId, "meeting_scheduled", `Spotkanie zaplanowane na ${meetingAt}`, {
    metadata: { meeting_at: meetingAt, meeting_address: address }
  });
}

export async function logComment(
  leadId: string,
  userId: string,
  comment: string
) {
  return createActivity(leadId, userId, "comment", "Dodano komentarz", {
    description: comment
  });
}

export async function logAssignment(
  leadId: string,
  userId: string,
  assignedToName: string,
  assignedToId?: string
) {
  return createActivity(leadId, userId, "assigned", `Lead przypisany do ${assignedToName}`, {
    metadata: { assigned_to_id: assignedToId }
  });
}

export async function logUnassignment(
  leadId: string,
  userId: string
) {
  return createActivity(leadId, userId, "unassigned", "Lead odznaczony");
}

export async function logContractNumber(
  leadId: string,
  userId: string,
  contractNumber: string
) {
  return createActivity(leadId, userId, "contract_number_set", `Numer umowy ustawiony na ${contractNumber}`, {
    metadata: { contract_number: contractNumber }
  });
}

export async function logResignation(
  leadId: string,
  userId: string,
  reason?: string
) {
  return createActivity(leadId, userId, "resignation_recorded", "Zanotowano rezygnację", {
    description: reason,
    metadata: { resignation_reason: reason }
  });
}
