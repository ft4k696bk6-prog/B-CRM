import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export type Permission =
  | "dashboard:view:own"
  | "dashboard:view:team"
  | "dashboard:view:all"
  | "leads:view:own"
  | "leads:view:team"
  | "leads:view:all"
  | "leads:create:own"
  | "leads:create:pool"
  | "leads:edit:own"
  | "leads:edit:team"
  | "leads:edit:all"
  | "leads:assign"
  | "leads:delete"
  | "activities:create"
  | "activities:view"
  | "calls:manage"
  | "reminders:manage"
  | "files:manage"
  | "calendar:view"
  | "operations:view"
  | "offers:calculate"
  | "offers:configure-margin"
  | "reports:view:own"
  | "reports:view:team"
  | "reports:view:all"
  | "users:manage"
  | "settings:view"
  | "settings:manage"
  | "integrations:manage"
  | "data:import"
  | "data:export"
  | "audit:view";

type PermissionMatrix = Record<UserRole, Permission[]>;

export const PERMISSIONS: PermissionMatrix = {
  owner: [
    "dashboard:view:own",
    "dashboard:view:team",
    "dashboard:view:all",
    "leads:view:own",
    "leads:view:team",
    "leads:view:all",
    "leads:create:own",
    "leads:create:pool",
    "leads:edit:own",
    "leads:edit:team",
    "leads:edit:all",
    "leads:assign",
    "leads:delete",
    "activities:create",
    "activities:view",
    "calls:manage",
    "reminders:manage",
    "files:manage",
    "calendar:view",
    "operations:view",
    "offers:calculate",
    "offers:configure-margin",
    "reports:view:own",
    "reports:view:team",
    "reports:view:all",
    "users:manage",
    "settings:view",
    "settings:manage",
    "integrations:manage",
    "data:import",
    "data:export",
    "audit:view"
  ],
  admin: [
    "dashboard:view:own",
    "dashboard:view:team",
    "dashboard:view:all",
    "leads:view:own",
    "leads:view:team",
    "leads:view:all",
    "leads:create:own",
    "leads:create:pool",
    "leads:edit:own",
    "leads:edit:team",
    "leads:edit:all",
    "leads:assign",
    "leads:delete",
    "activities:create",
    "activities:view",
    "calls:manage",
    "reminders:manage",
    "files:manage",
    "calendar:view",
    "operations:view",
    "offers:calculate",
    "offers:configure-margin",
    "reports:view:own",
    "reports:view:team",
    "reports:view:all",
    "users:manage",
    "settings:view",
    "settings:manage",
    "data:import",
    "data:export",
    "audit:view"
  ],
  kierownik: [
    "dashboard:view:own",
    "dashboard:view:team",
    "leads:view:own",
    "leads:view:team",
    "leads:create:pool",
    "leads:edit:own",
    "leads:edit:team",
    "leads:assign",
    "activities:create",
    "activities:view",
    "calls:manage",
    "reminders:manage",
    "files:manage",
    "calendar:view",
    "operations:view",
    "offers:calculate",
    "reports:view:own",
    "reports:view:team",
    "settings:view",
    "data:import",
    "data:export"
  ],
  handlowiec: [
    "dashboard:view:own",
    "leads:view:own",
    "leads:create:own",
    "leads:edit:own",
    "activities:create",
    "activities:view",
    "calls:manage",
    "reminders:manage",
    "files:manage",
    "calendar:view",
    "operations:view",
    "offers:calculate",
    "reports:view:own",
    "settings:view"
  ],
  finance: [
    "dashboard:view:all",
    "leads:view:all",
    "activities:view",
    "calendar:view",
    "offers:calculate",
    "reports:view:all",
    "settings:view",
    "data:export"
  ],
  viewer: [
    "dashboard:view:all",
    "leads:view:all",
    "activities:view",
    "calendar:view",
    "reports:view:all",
    "settings:view"
  ],
  ksiegowosc: [
    "activities:view",
    "calendar:view",
    "operations:view",
    "reports:view:own",
    "data:export"
  ],
  logistyk: [
    "activities:view",
    "calendar:view",
    "operations:view"
  ],
  monter: [
    "activities:view",
    "calendar:view",
    "operations:view"
  ]
};

export function hasPermission(role: string | null | undefined, permission: Permission) {
  return PERMISSIONS[normalizeRole(role)].includes(permission);
}

export function hasAnyPermission(role: string | null | undefined, permissions: Permission[]) {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function canEditAnyLead(role: string | null | undefined) {
  return hasAnyPermission(role, ["leads:edit:all", "leads:edit:team"]);
}
