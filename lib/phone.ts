export function normalizePhoneE164(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return null;

  let normalized = raw.replace(/[^\d+]/g, "");
  if ((normalized.match(/\+/g) || []).length > 1 || (normalized.includes("+") && !normalized.startsWith("+"))) {
    return null;
  }
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  if (!normalized.startsWith("+") && normalized.length === 9) normalized = `+48${normalized}`;
  if (!normalized.startsWith("+") && normalized.startsWith("48") && normalized.length === 11) {
    normalized = `+${normalized}`;
  }

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
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
