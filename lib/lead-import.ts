import { LEAD_STATUSES } from "@/lib/constants";
import { normalizePhoneForDial } from "@/lib/phone";
import type { LeadStatus } from "@/lib/types";

export type RawLeadImportRow = Record<string, unknown>;

export type NormalizedLeadImportRow = {
  full_name: string;
  phone: string;
  email: string | null;
  postal_code: string | null;
  address: string | null;
  voivodeship: string | null;
  county: string | null;
  source: string;
  status: LeadStatus;
  comment: string | null;
  created_at: string | null;
  dedupe_key: string;
};

export type LeadImportNormalizeResult =
  | { ok: true; row: NormalizedLeadImportRow }
  | { ok: false; error: string; raw: RawLeadImportRow };

const statusAliases: Array<[RegExp, LeadStatus]> = [
  [/zimn|stara baza|cold/i, "Zimna baza"],
  [/um[oó]w|spotkan|kalendarz|wizyta/i, "Spotkanie"],
  [/callback|call back|oddzwo|ponowny kontakt/i, "Call back"],
  [/\bn\.?\s*o\.?\b|nie\s*odbiera|nieodebra|nie odebra|brak kontaktu/i, "Nie odebrał"],
  [/pomy[lł]ka numeru|nie ma takiego numeru|s[lł]u[zż]bowy numer|b[lł][eę]dny|z[lł]y numer|niepoprawny numer/i, "Błędny numer"],
  [/rezygn|nie chce|brak zgody|ju[zż] ma|nie potrzebuje|nie op[lł]aca|nic nie dop[lł]aca|nie aktualne/i, "Rezygnacja"],
  [/zwrot/i, "Zwrot"],
  [/weryfik/i, "Do weryfikacji"],
  [/umowa|podpis/i, "Umowa"],
  [/po spotk/i, "Po spotkaniu"],
  [/przypis/i, "Przypisany"],
  [/nie dzwonione|niedzwonione|created|utworzon|now/i, "Nowy"]
];

const fieldAliases = {
  full_name: [
    "full_name",
    "name",
    "imie",
    "imię",
    "imie i nazwisko",
    "imię i nazwisko",
    "imie i naziwsko",
    "imię i naziwsko",
    "osoba kontaktowa",
    "klient",
    "nazwa"
  ],
  phone: ["phone", "phone_number", "telefon", "tel", "numer", "numer telefonu", "telefon klienta"],
  email: ["email", "e-mail", "mail", "adres email", "adres e-mail"],
  postal_code: ["postal_code", "post_code", "kod", "kod pocztowy", "postal", "postcode"],
  address: ["address", "adres", "adres montażu", "adres montazu"],
  voivodeship: ["voivodeship", "wojewodztwo", "województwo"],
  county: ["county", "powiat"],
  source: ["source", "źródło", "zrodlo", "kampania", "formularz"],
  status: ["status", "lead_status", "etap", "stan"],
  comment: ["comment", "komentarz", "notatka", "uwagi", "opis", "ostatni komentarz"],
  created_at: ["created_at", "created_time", "data", "data zgłoszenia", "data zgloszenia", "created", "utworzono"]
} as const;

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
}

function valueText(value: unknown, maxLength = 500) {
  if (value == null) return "";
  return String(value).trim().slice(0, maxLength);
}

function firstValue(row: RawLeadImportRow, aliases: readonly string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeKey(key), value] as const);
  const normalizedAliases = aliases.map(normalizeKey);
  const match = normalizedEntries.find(([key]) => normalizedAliases.includes(key));
  return match ? match[1] : null;
}

export function normalizePhoneKey(phone: string) {
  const dial = normalizePhoneForDial(phone);
  if (dial) return `phone:${dial}`;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? `phone:${digits.slice(-9)}` : "";
}

export function normalizeEmailKey(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return normalized && normalized.includes("@") ? `email:${normalized}` : "";
}

export function parseImportDate(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 20000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 24 * 60 * 60 * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = valueText(value, 80);
  const localMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (localMatch) {
    const year = Number(localMatch[3].length === 2 ? `20${localMatch[3]}` : localMatch[3]);
    const date = new Date(year, Number(localMatch[2]) - 1, Number(localMatch[1]), 12, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mapLeadImportStatus(input: {
  status?: string | null;
  comment?: string | null;
  createdAt?: Date | null;
  now?: Date;
}): LeadStatus {
  const now = input.now || new Date();
  const exactStatus = LEAD_STATUSES.find((status) => status.toLowerCase() === input.status?.trim().toLowerCase());
  if (exactStatus) return exactStatus;

  const context = [input.status, input.comment].filter(Boolean).join(" ");
  const alias = statusAliases.find(([pattern]) => pattern.test(context));
  if (alias) return alias[1];

  const fresh = input.createdAt ? input.createdAt.getFullYear() >= now.getFullYear() : false;
  if (fresh) return "Nowy";
  return "Zimna baza";
}

export function normalizeLeadImportRow(row: RawLeadImportRow, now = new Date()): LeadImportNormalizeResult {
  const fullName = valueText(firstValue(row, fieldAliases.full_name), 180);
  const phone = valueText(firstValue(row, fieldAliases.phone), 60);
  const email = valueText(firstValue(row, fieldAliases.email), 180) || null;
  const source = valueText(firstValue(row, fieldAliases.source), 120) || "Import";
  const comment = valueText(firstValue(row, fieldAliases.comment), 2000) || null;
  const createdAtDate = parseImportDate(firstValue(row, fieldAliases.created_at));
  const phoneKey = normalizePhoneKey(phone);
  const emailKey = normalizeEmailKey(email);

  if (!fullName) return { ok: false, error: "Brakuje imienia i nazwiska.", raw: row };
  if (!phone && !emailKey) return { ok: false, error: "Brakuje telefonu albo e-maila.", raw: row };
  if (!phoneKey && !emailKey) return { ok: false, error: "Telefon/e-mail nie nadaje się do deduplikacji.", raw: row };

  return {
    ok: true,
    row: {
      full_name: fullName,
      phone: phone || email!,
      email,
      postal_code: valueText(firstValue(row, fieldAliases.postal_code), 20) || null,
      address: valueText(firstValue(row, fieldAliases.address), 300) || null,
      voivodeship: valueText(firstValue(row, fieldAliases.voivodeship), 80) || null,
      county: valueText(firstValue(row, fieldAliases.county), 120) || null,
      source,
      status: mapLeadImportStatus({
        status: valueText(firstValue(row, fieldAliases.status), 80) || null,
        comment,
        createdAt: createdAtDate,
        now
      }),
      comment,
      created_at: createdAtDate && createdAtDate.getFullYear() >= now.getFullYear() ? createdAtDate.toISOString() : null,
      dedupe_key: phoneKey || emailKey
    }
  };
}

export function normalizeLeadImportBatch(rows: RawLeadImportRow[], now = new Date()) {
  const seen = new Set<string>();
  const valid: NormalizedLeadImportRow[] = [];
  const failed: Array<{ rowNumber: number; error: string; raw: RawLeadImportRow }> = [];
  const duplicates: Array<{ rowNumber: number; dedupe_key: string; raw: RawLeadImportRow }> = [];

  rows.forEach((raw, index) => {
    const rowNumber = index + 1;
    const normalized = normalizeLeadImportRow(raw, now);
    if (!normalized.ok) {
      failed.push({ rowNumber, error: normalized.error, raw });
      return;
    }

    if (seen.has(normalized.row.dedupe_key)) {
      duplicates.push({ rowNumber, dedupe_key: normalized.row.dedupe_key, raw });
      return;
    }

    seen.add(normalized.row.dedupe_key);
    valid.push(normalized.row);
  });

  return { valid, failed, duplicates };
}
