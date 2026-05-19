import type { LegacyUserRole, UserRole } from "@/lib/types";

export const USER_ROLES = [
  "owner",
  "admin",
  "menadzer",
  "handlowiec",
  "finance",
  "viewer",
  "ksiegowosc",
  "logistyk",
  "monter"
] as const satisfies readonly UserRole[];

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Właściciel",
  admin: "Admin",
  menadzer: "Menadżer",
  handlowiec: "Handlowiec",
  finance: "Finanse",
  viewer: "Podgląd",
  ksiegowosc: "Księgowość",
  logistyk: "Logistyka",
  monter: "Monter"
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Pełna kontrola nad CRM, rolami, danymi, ustawieniami i eksportem.",
  admin: "Zarządza operacyjnie CRM, użytkownikami, importem, leadami i ustawieniami.",
  menadzer: "Prowadzi zespół handlowców, rozdziela leady i kontroluje wyniki zespołu.",
  handlowiec: "Pracuje na własnych leadach, zadaniach, spotkaniach, ofertach i aktywnościach.",
  finance: "Widok finansowy: umowy, raporty i dane potrzebne do rozliczeń.",
  viewer: "Bezpieczny tryb tylko do odczytu dla audytu, zarządu lub obserwatorów.",
  ksiegowosc: "Obsługuje dokumenty, faktury, aneksy i rozliczenia po podpisaniu umowy.",
  logistyk: "Koordynuje zamówienia, kompletację oraz przygotowanie realizacji.",
  monter: "Obsługuje etap montażu i potwierdza wykonanie prac w terenie."
};

const DEMO_EMAIL_ROLES: Record<string, UserRole> = {
  "demo@example.com": "admin",
  "demo-menadzer@example.com": "menadzer",
  "demo-handlowiec@example.com": "handlowiec",
  "demo-ksiegowy@example.com": "ksiegowosc",
  "demo-logistyk@example.com": "logistyk",
  "demo-monter@example.com": "monter",
  "demo-owner@example.com": "owner",
  "demo-dyrektor-sprzedazy@example.com": "menadzer",
  "demo-regionalny-wschod@example.com": "menadzer",
  "demo-kierownik-b2b@example.com": "menadzer",
  "demo-kierownik-b2c@example.com": "menadzer",
  "demo-handlowiec-b2b@example.com": "handlowiec",
  "demo-handlowiec-b2c@example.com": "handlowiec",
  "demo-handlowiec-field@example.com": "handlowiec",
  "demo-finanse@example.com": "finance",
  "demo-dyrektor-operacyjny@example.com": "menadzer",
  "demo-magazyn@example.com": "logistyk",
  "demo-monter-2@example.com": "monter",
  "demo-audyt@example.com": "viewer"
};

export const DEMO_USER_EMAILS = Object.keys(DEMO_EMAIL_ROLES);

type RoleInput = UserRole | LegacyUserRole | string;

export function isDemoUserEmail(email?: string | null) {
  return Boolean(email && DEMO_USER_EMAILS.includes(email.toLowerCase()));
}

function mapRole(role?: RoleInput | null): UserRole | null {
  switch (role) {
    case "owner":
    case "admin":
    case "menadzer":
    case "handlowiec":
    case "finance":
    case "viewer":
    case "ksiegowosc":
    case "logistyk":
    case "monter":
      return role;
    case "manager":
      return "menadzer";
    case "sales":
      return "handlowiec";
    case "accounting":
    case "ksiegowy":
      return "ksiegowosc";
    case "logistics":
    case "logistyka":
      return "logistyk";
    case "installer":
      return "monter";
    default:
      return null;
  }
}

export function normalizeRole(
  role?: RoleInput | null,
  email?: string | null,
  trustedRole?: RoleInput | null
): UserRole {
  const demoRole = email ? DEMO_EMAIL_ROLES[email.toLowerCase()] : null;
  if (demoRole) return demoRole;

  return mapRole(trustedRole) || mapRole(role) || "handlowiec";
}

export function isOwnerRole(role?: RoleInput | null) {
  return normalizeRole(role) === "owner";
}

export function isAdminRole(role?: RoleInput | null) {
  return normalizeRole(role) === "admin";
}

export function isSystemAdminRole(role?: RoleInput | null) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin";
}

export function isManagerRole(role?: RoleInput | null) {
  return normalizeRole(role) === "menadzer";
}

export function isSalesRole(role?: RoleInput | null) {
  return normalizeRole(role) === "handlowiec";
}

export function isFinanceRole(role?: RoleInput | null) {
  return normalizeRole(role) === "finance";
}

export function isViewerRole(role?: RoleInput | null) {
  return normalizeRole(role) === "viewer";
}

export function isAccountingRole(role?: RoleInput | null) {
  return normalizeRole(role) === "ksiegowosc";
}

export function isLogisticsRole(role?: RoleInput | null) {
  return normalizeRole(role) === "logistyk";
}

export function isInstallerRole(role?: RoleInput | null) {
  return normalizeRole(role) === "monter";
}

export function canManageLeads(role?: RoleInput | null) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin" || normalized === "menadzer";
}

export function canUseOperations(role?: RoleInput | null) {
  return (
    canManageLeads(role) ||
    isSalesRole(role) ||
    isAccountingRole(role) ||
    isLogisticsRole(role) ||
    isInstallerRole(role)
  );
}

export function canViewManagementDashboard(role?: RoleInput | null) {
  const normalized = normalizeRole(role);
  return (
    normalized === "owner" ||
    normalized === "admin" ||
    normalized === "menadzer" ||
    normalized === "finance" ||
    normalized === "viewer"
  );
}

export function canManageUsers(role?: RoleInput | null) {
  return isSystemAdminRole(role);
}

export function canManageSystemSettings(role?: RoleInput | null) {
  return isSystemAdminRole(role);
}

export function canExportData(role?: RoleInput | null) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin" || normalized === "menadzer" || normalized === "finance";
}

export function canCreateManualLead(role?: RoleInput | null) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin" || normalized === "menadzer" || normalized === "handlowiec";
}

export function homePathForRole(role?: RoleInput | null) {
  const normalized = normalizeRole(role);
  if (normalized === "handlowiec") return "/sales";
  if (normalized === "finance") return "/finance";
  if (normalized === "ksiegowosc") return "/accounting";
  if (normalized === "logistyk") return "/logistics";
  if (normalized === "monter") return "/installation";
  return "/admin";
}
