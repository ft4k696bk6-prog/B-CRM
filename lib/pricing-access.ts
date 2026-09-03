export function canManagePricing(role: string) {
  return role === "owner" || role === "admin";
}
