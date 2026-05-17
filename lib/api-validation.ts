export type ValidationResult<T> = { ok: boolean; data?: T; error?: string };

export function requiredString(value: unknown, field: string, maxLength = 500): ValidationResult<string> {
  if (typeof value !== "string") return { ok: false, error: `Pole ${field} jest wymagane.` };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: `Pole ${field} jest wymagane.` };
  if (trimmed.length > maxLength) return { ok: false, error: `Pole ${field} jest za długie.` };
  return { ok: true, data: trimmed };
}

export function optionalString(value: unknown, field: string, maxLength = 2000): ValidationResult<string | null> {
  if (value == null || value === "") return { ok: true, data: null };
  if (typeof value !== "string") return { ok: false, error: `Pole ${field} musi być tekstem.` };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return { ok: false, error: `Pole ${field} jest za długie.` };
  return { ok: true, data: trimmed || null };
}

export function optionalNumber(value: unknown, field: string): ValidationResult<number | null> {
  if (value == null || value === "") return { ok: true, data: null };
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return { ok: false, error: `Pole ${field} musi być liczbą nieujemną.` };
  return { ok: true, data: numeric };
}

export function uuidString(value: unknown, field: string): ValidationResult<string> {
  const result = requiredString(value, field, 80);
  if (!result.ok) return result;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.data!)) {
    return { ok: false, error: `Pole ${field} ma niepoprawny format.` };
  }
  return result;
}

export function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): ValidationResult<T> {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return { ok: false, error: `Pole ${field} ma niedozwoloną wartość.` };
  }
  return { ok: true, data: value as T };
}

export function optionalRecord(value: unknown, field: string): ValidationResult<Record<string, unknown> | null> {
  if (value == null) return { ok: true, data: null };
  if (typeof value !== "object" || Array.isArray(value)) return { ok: false, error: `Pole ${field} musi być obiektem.` };
  return { ok: true, data: value as Record<string, unknown> };
}
