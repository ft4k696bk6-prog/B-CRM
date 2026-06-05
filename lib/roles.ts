import type { LegacyUserRole, UserRole } from "@/lib/types";

export const USER_ROLES = [
  "owner",
  "admin",
  "kierownik",
  "handlowiec",
  "finance",
  "viewer",
  "ksiegowosc",
  "logistyk",
  "monter"
] as const satisfies readonly UserRole[];

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Właściciel",
  admin: "Administrator",
  kierownik: "Kierownik",
  handlowiec: "Handlowiec",
  finance: "Finanse",
  viewer: "Podgląd",
  ksiegowosc: "Księgowość",
  logistyk: "Logistyka",
  monter: "Monter"
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Pełny dostęp do użytkowników, leadów, ustawień i eksportów.",
  admin: "Zarządza użytkownikami, bazą leadów i ustawieniami firmy.",
  kierownik: "Prowadzi zespół handlowców, rozdziela leady i kontroluje wyniki zespołu.",
  handlowiec: "Pracuje na własnych leadach, zadaniach, spotkaniach, ofertach i aktywnościach.",
  finance: "Widok finansowy: umowy, raporty i dane potrzebne do rozliczeń.",
  viewer: "Bezpieczny tryb tylko do odczytu dla audytu, zarządu lub obserwatorów.",
  ksiegowosc: "Obsługuje dokumenty, faktury, aneksy i rozliczenia po podpisaniu umowy.",
  logistyk: "Koordynuje zamówienia, kompletację oraz przygotowanie realizacji.",
  monter: "Obsługuje etap montażu i potwierdza wykonanie prac w terenie."
};

type RoleInput = UserRole | LegacyUserRole | string;

function mapRole(role?: RoleInput | null): UserRole | null {
  switch (role) {
    case "owner":
    case "admin":
    case "kierownik":
    case "handlowiec":
    case "finance":
    case "viewer":
    case "ksiegowosc":
    case "logistyk":
    case "monter":
      return role;
    case "menadzer":
    case "manager":
      return "kierownik";
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
  return normalizeRole(role) === "kierownik";
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
  return normalized === "owner" || normalized === "admin" || normalized === "kierownik";
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
    normalized === "kierownik" ||
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
  return normalized === "owner" || normalized === "admin" || normalized === "kierownik" || normalized === "finance";
}

export function canCreateManualLead(role?: RoleInput | null) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin" || normalized === "kierownik" || normalized === "handlowiec";
}

export function homePathForRole(role?: RoleInput | null) {
  const normalized = normalizeRole(role);
  if (normalized === "handlowiec") return "/sales";
  return "/admin";
}
