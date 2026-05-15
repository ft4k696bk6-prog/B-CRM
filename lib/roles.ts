import type { UserRole } from "@/lib/types";

export const USER_ROLES: UserRole[] = ["admin", "handlowiec", "menadzer"];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  handlowiec: "Handlowiec",
  menadzer: "Menadżer"
};

export function isAdminRole(role?: string | null) {
  return role === "admin";
}

export function isManagerRole(role?: string | null) {
  return role === "menadzer" || role === "manager";
}

export function isSalesRole(role?: string | null) {
  return role === "handlowiec" || role === "sales";
}

export function canManageLeads(role?: string | null) {
  return role === "admin" || role === "menadzer" || role === "manager";
}

export function homePathForRole(role?: string | null) {
  return canManageLeads(role) ? "/admin" : "/sales";
}

export function normalizeRole(role?: string | null): UserRole {
  if (role === "admin" || role === "menadzer" || role === "handlowiec") return role;
  if (role === "manager") return "menadzer";
  return "handlowiec";
}
