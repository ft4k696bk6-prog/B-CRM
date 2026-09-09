import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";
import { normalizeCrmScope } from "@/lib/scope";
import type { CrmDataScope } from "@/lib/types";

type SheetRow = {
  created_time?: string;
  full_name?: string;
  phone_number?: string;
  post_code?: string;
  "Województwo"?: string;
  campaign_name?: string;
};

type PreparedLead = {
  full_name: string;
  phone: string;
  postal_code: string | null;
  voivodeship: string | null;
  source: "B2C";
  campaign: string | null;
  status: "Nowy";
  assigned_to: null;
  crm_environment: CrmDataScope;
  created_at: string;
  address: null;
  county: null;
};

export type PublicLeadImportResult = {
  scanned: number;
  prepared: number;
  inserted: number;
  skipped: number;
  errors: string[];
};

const DEFAULT_SPREADSHEET_ID = "1bTJ0WZGwpEgZh-IeUOMvt2KBaqrO52c-QNjBpR2h7so";
const DEFAULT_SHEET_NAMES = [
  "Formularz PODKARPACKIE MAGAZYN ENERGII-copy",
  "Lubelskie Magazyny Energii",
  "Mazowieckie Magazyny",
  "Świętokrzyskie Magazyny Energii",
  "Łódzkie  Magazyny Energii",
  "Małopolskie magazyny"
];

const VALID_VOIVODESHIPS = new Set([
  "dolnoslaskie", "kujawsko-pomorskie", "lubelskie", "lubuskie", "lodzkie", "malopolskie",
  "mazowieckie", "opolskie", "podkarpackie", "podlaskie", "pomorskie", "slaskie",
  "swietokrzyskie", "warminsko-mazurskie", "wielkopolskie", "zachodniopomorskie"
]);

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Brakuje konfiguracji Supabase dla importu leadów.");
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function cleanPrefixedValue(value: unknown, prefix: string) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length).trim() : trimmed;
}

function normalizePhoneDisplay(value: unknown) {
  const raw = cleanPrefixedValue(value, "p:");
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return `+48${digits}`;
  if (digits.length === 11 && digits.startsWith("48")) return `+${digits}`;
  if (raw.startsWith("+")) return raw.replace(/\s+/g, "");
  return raw;
}

function phoneKey(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

function normalizePostalCode(value: unknown) {
  const raw = cleanPrefixedValue(value, "z:");
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 5) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}`;
  return raw.trim();
}

function normalizeVoivodeship(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l").replace(/ą/g, "a").replace(/ę/g, "e").replace(/ó/g, "o")
    .replace(/ś/g, "s").replace(/ż|ź/g, "z").replace(/ć/g, "c").replace(/ń/g, "n")
    .replace(/\s+/g, "-");
  return VALID_VOIVODESHIPS.has(normalized) ? normalized : null;
}

function voivodeshipFromPostalCode(postalCode: string | null) {
  if (!postalCode) return null;
  const prefix = Number.parseInt(postalCode.replace(/\D/g, "").slice(0, 2), 10);
  if (!Number.isFinite(prefix)) return null;
  if (prefix <= 7) return "mazowieckie";
  if (prefix >= 8 && prefix <= 24) return "lubelskie";
  if (prefix >= 25 && prefix <= 29) return "swietokrzyskie";
  if (prefix >= 30 && prefix <= 34) return "malopolskie";
  if (prefix >= 35 && prefix <= 39) return "podkarpackie";
  if (prefix >= 90 && prefix <= 99) return "lodzkie";
  return null;
}

function voivodeshipFromSheetName(sheetName: string) {
  return normalizeVoivodeship(sheetName.replace(/magazyny energii|magazyny|formularz|copy|podkarpackie magazyn energii/gi, ""));
}

function createdAtFromMeta(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function csvUrl(spreadsheetId: string, sheetName: string) {
  const params = new URLSearchParams({ tqx: "out:csv", sheet: sheetName });
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
}

async function fetchRows(spreadsheetId: string, sheetName: string) {
  const response = await fetch(csvUrl(spreadsheetId, sheetName), { cache: "no-store" });
  const csv = await response.text();
  if (!response.ok || csv.trim().startsWith("<")) {
    throw new Error(`Nie udało się pobrać zakładki "${sheetName}" przez CSV.`);
  }
  const parsed = Papa.parse<SheetRow>(csv, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().replace(/^\uFEFF/, "") });
  if (parsed.errors.length > 0) throw new Error(`Nie udało się odczytać CSV z zakładki "${sheetName}".`);
  return parsed.data;
}

async function existingPhoneKeys(supabase: ReturnType<typeof adminClient>, crmEnvironment: CrmDataScope) {
  const keys = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from("leads").select("phone").eq("crm_environment", crmEnvironment).range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data || []) {
      const key = phoneKey(row.phone);
      if (key) keys.add(key);
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return keys;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function importGoogleSheetsLeadsPublic(): Promise<PublicLeadImportResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  const sheetNames = (process.env.GOOGLE_SHEETS_LEADS_SHEET_NAMES || DEFAULT_SHEET_NAMES.join(","))
    .split(",").map((s) => s.trim()).filter(Boolean);
  const crmEnvironment = normalizeCrmScope(process.env.GOOGLE_SHEETS_LEADS_CRM_ENVIRONMENT);
  const result: PublicLeadImportResult = { scanned: 0, prepared: 0, inserted: 0, skipped: 0, errors: [] };
  const supabase = adminClient();
  const existing = await existingPhoneKeys(supabase, crmEnvironment);
  const batchKeys = new Set<string>();
  const leads: PreparedLead[] = [];

  for (const sheetName of sheetNames) {
    let rows: SheetRow[];
    try {
      rows = await fetchRows(spreadsheetId, sheetName);
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : `Błąd zakładki "${sheetName}".`);
      continue;
    }

    for (const row of rows) {
      result.scanned += 1;
      const fullName = typeof row.full_name === "string" ? row.full_name.trim().slice(0, 180) : "";
      const phone = normalizePhoneDisplay(row.phone_number).slice(0, 60);
      const key = phoneKey(phone);
      if (!fullName || !phone || !key || existing.has(key) || batchKeys.has(key)) {
        result.skipped += 1;
        continue;
      }
      const postalCode = normalizePostalCode(row.post_code).slice(0, 20) || null;
      const voivodeship = voivodeshipFromPostalCode(postalCode) || normalizeVoivodeship(row["Województwo"]) || voivodeshipFromSheetName(sheetName);
      leads.push({
        full_name: fullName,
        phone,
        postal_code: postalCode,
        voivodeship,
        source: "B2C",
        campaign: (typeof row.campaign_name === "string" ? row.campaign_name.trim() : "") || sheetName,
        status: "Nowy",
        assigned_to: null,
        crm_environment: crmEnvironment,
        created_at: createdAtFromMeta(row.created_time),
        address: null,
        county: null
      });
      batchKeys.add(key);
    }
  }

  result.prepared = leads.length;
  for (const leadChunk of chunk(leads, 500)) {
    const { error } = await supabase.from("leads").insert(leadChunk);
    if (error) result.errors.push(error.message);
    else result.inserted += leadChunk.length;
  }
  return result;
}
