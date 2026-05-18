import { isDemoUserEmail } from "@/lib/roles";
import type { CrmDataScope } from "@/lib/types";

export const DEFAULT_CRM_SCOPE: CrmDataScope = "production";

export function normalizeCrmScope(
  value?: string | null,
  email?: string | null
): CrmDataScope {
  if (value === "demo" || isDemoUserEmail(email)) return "demo";
  return DEFAULT_CRM_SCOPE;
}

export function isDemoScope(scope?: CrmDataScope | string | null) {
  return scope === "demo";
}

export function sameCrmScope(
  left?: CrmDataScope | string | null,
  right?: CrmDataScope | string | null
) {
  return normalizeCrmScope(left) === normalizeCrmScope(right);
}
