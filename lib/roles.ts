import type { UserRole } from "@/lib/types";

export const USER_ROLES: UserRole[] = [
  "admin",
  "menadzer",
  "handlowiec",
  "ksiegowosc",
  "logistyk",
  "monter"
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  handlowiec: "Handlowiec",
  menadzer: "Menadżer",
  ksiegowosc: "Księgowość",
  logistyk: "Logistyka",
  monter: "Monter"
};

const DEMO_EMAIL_ROLES: Record<string, UserRole> = {
  "demo-ksiegowy@example.com": "ksiegowosc",
  "demo-logistyk@example.com": "logistyk",
  "demo-monter@example.com": "monter"
};

export const DEMO_USER_EMAILS = [
  "demo@example.com",
  "demo-menadzer@example.com",
  "demo-handlowiec@example.com",
  "demo-ksiegowy@example.com",
  "demo-logistyk@example.com",
  "demo-monter@example.com"
];

export function isDemoUserEmail(email?: string | null) {
  return Boolean(email && DEMO_USER_EMAILS.includes(email.toLowerCase()));
}

export function isAdminRole(role?: string | null) {
  return role === "admin";
}

export function isManagerRole(role?: string | null) {
  return role === "menadzer" || role === "manager";
}

export function isSalesRole(role?: string | null) {
  return role === "handlowiec" || role === "sales";
}

export function isAccountingRole(role?: string | null) {
  return role === "ksiegowosc" || role === "ksiegowy" || role === "accounting";
}

export function isLogisticsRole(role?: string | null) {
  return role === "logistyk" || role === "logistyka" || role === "logistics";
}

export function isInstallerRole(role?: string | null) {
  return role === "monter" || role === "installer";
}

export function canManageLeads(role?: string | null) {
  return role === "admin" || role === "menadzer" || role === "manager";
}

export function canUseOperations(role?: string | null) {
  return (
    canManageLeads(role) ||
    isSalesRole(role) ||
    isAccountingRole(role) ||
    isLogisticsRole(role) ||
    isInstallerRole(role)
  );
}

export function homePathForRole(role?: string | null) {
  if (isAccountingRole(role) || isLogisticsRole(role) || isInstallerRole(role)) return "/realizacja";
  return canManageLeads(role) ? "/admin" : "/sales";
}

function mapRole(role?: string | null): UserRole | null {
  if (
    role === "admin" ||
    role === "menadzer" ||
    role === "handlowiec" ||
    role === "ksiegowosc" ||
    role === "logistyk" ||
    role === "monter"
  ) {
    return role;
  }
  if (role === "manager") return "menadzer";
  if (role === "sales") return "handlowiec";
  if (role === "ksiegowy" || role === "accounting") return "ksiegowosc";
  if (role === "logistyka" || role === "logistics") return "logistyk";
  if (role === "installer") return "monter";
  return null;
}

export function normalizeRole(
  role?: string | null,
  email?: string | null,
  trustedRole?: string | null
): UserRole {
  const demoRole = email ? DEMO_EMAIL_ROLES[email.toLowerCase()] : null;
  if (demoRole) return demoRole;

  return mapRole(trustedRole) || mapRole(role) || "handlowiec";
}
