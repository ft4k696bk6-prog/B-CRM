export function canAccessAssignedLead(input: {
  role: string;
  profileId: string;
  assignedTo: string | null;
  managerTeamIds?: Set<string>;
}) {
  if (input.role === "owner" || input.role === "admin") return true;
  if (input.role === "menadzer") return input.assignedTo === null || input.assignedTo === input.profileId || Boolean(input.assignedTo && input.managerTeamIds?.has(input.assignedTo));
  return input.assignedTo === input.profileId;
}
