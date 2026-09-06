const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/**
 * Canonical storage/dial format used by B-CRM.
 *
 * - Polish local 9-digit numbers become +48XXXXXXXXX.
 * - 48XXXXXXXXX becomes +48XXXXXXXXX.
 * - 00CC... becomes +CC....
 * - Other international numbers must include an explicit country code.
 * - Ambiguous local formats are rejected instead of guessing a country.
 */
export function normalizePhoneE164(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return null;

  let normalized = raw.replace(/[^\d+]/g, "");

  if ((normalized.match(/\+/g) || []).length > 1 || normalized.includes("+", 1)) return null;

  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  if (!normalized.startsWith("+") && /^\d{9}$/.test(normalized)) normalized = `+48${normalized}`;
  if (!normalized.startsWith("+") && /^48\d{9}$/.test(normalized)) normalized = `+${normalized}`;

  return E164_PATTERN.test(normalized) ? normalized : null;
}

export function normalizePhoneForDial(value: string | null | undefined) {
  return normalizePhoneE164(value);
}

export function formatPhoneReadable(value: string | null | undefined) {
  const normalized = normalizePhoneE164(value);
  if (!normalized) return value || "";

  if (normalized.startsWith("+48") && normalized.length === 12) {
    return `+48 ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9, 12)}`;
  }

  return normalized.replace(/^(\+\d{1,3})(\d{3})(\d{3})(.*)$/, (_, prefix, first, second, rest) =>
    `${prefix} ${first} ${second}${rest ? ` ${rest}` : ""}`
  );
}
