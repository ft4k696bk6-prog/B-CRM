import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { googleWorkspaceToken } from "@/lib/google-workspace";
import { normalizeCrmScope } from "@/lib/scope";
import type { CrmDataScope } from "@/lib/types";

type SheetRow = Record<string, string | undefined> & {
  id?: string;
  created_time?: string;
  full_name?: string;
  phone_number?: string;
  campaign_name?: string;
  form_name?: string;
  ad_name?: string;
};

type LeadRef = {
  id: string;
  phone: string;
};

const META_FORM_COLUMNS = new Set([
  "id",
  "created_time",
  "full_name",
  "first_name",
  "last_name",
  "phone_number",
  "phone",
  "email",
  "email_address",
  "post_code",
  "postal_code",
  "inbox_url",
  "województwo",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "form_id",
  "form_name",
  "platform",
  "is_organic",
  "lead_status",
  "priority"
]);

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Brakuje konfiguracji Supabase dla notatek formularzy.");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function phoneKey(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

function normalizeColumnName(value: string) {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase();
}

function prettify(value: string) {
  return value.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
}

function friendlyCampaign(raw: string | null) {
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (/magazyn(y)? energii.*v\s*2([^0-9]|$)/i.test(raw)) return "Dodatek prądowy";
  if (/magazyn(y)? energii.*v\s*[0-9]+/i.test(raw)) return "Magazyny energii";
  if (normalized.includes("fotowoltaika się nie opłaca") || normalized.includes("fotowoltaika sie nie oplaca")) return "Magazyny energii";
  if (normalized.includes("podkarpacie nowa dotacja")) return "Magazyny energii";
  if (normalized.includes("podkarp") && normalized.includes("przegl")) return "Podkarpackie przeglądy";
  return raw;
}

function submittedAt(value: unknown) {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formNoteFromRow(row: SheetRow) {
  const formName = String(row.form_name || "").trim() || null;
  const campaign = friendlyCampaign(String(row.campaign_name || "").trim() || null);
  const source = `${formName || ""} ${campaign || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!source.includes("przegl")) return null;

  const answers = Object.entries(row)
    .filter(([column, rawValue]) => {
      const value = String(rawValue || "").trim();
      const normalized = normalizeColumnName(column);
      return Boolean(value)
        && !META_FORM_COLUMNS.has(normalized)
        && !["created", "created_at", "updated", "updated_at", "status"].includes(normalized)
        && !normalized.startsWith("utm_")
        && normalized !== "fbclid"
        && normalized !== "gclid"
        && !value.startsWith("<test lead:");
    })
    .slice(0, 40)
    .map(([column, rawValue]) => `${prettify(column)} - ${prettify(String(rawValue || "")).slice(0, 1000)}`);

  if (!answers.length) return null;

  return [
    "Odpowiedzi z formularza:",
    ...answers
  ].join("\n").slice(0, 12000);
}
async function googleAccessToken() {
  try {
    return await googleWorkspaceToken(["https://www.googleapis.com/auth/spreadsheets.readonly"]);
  } catch {
    return null;
  }
}

function rowsFromValues(values: string[][]) {
  const [headers = [], ...rows] = values;
  const normalizedHeaders = headers.map((header) => String(header || "").trim().replace(/^\uFEFF/, ""));
  return rows.map((row) => normalizedHeaders.reduce<SheetRow>((record, header, index) => {
    if (header) record[header] = row[index] || "";
    return record;
  }, {}));
}

async function fetchRows(spreadsheetId: string, sheetName: string, accessToken: string | null) {
  if (accessToken) {
    const range = `'${sheetName.replace(/'/g, "''")}'!A:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    const body = (await response.json()) as { values?: string[][]; error?: { message?: string } };
    if (response.ok) return rowsFromValues(body.values || []);
  }

  const params = new URLSearchParams({ tqx: "out:csv", sheet: sheetName, headers: "1", cache_bust: Date.now().toString() });
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`, { cache: "no-store" });
  const csv = await response.text();
  if (!response.ok || csv.trim().startsWith("<")) throw new Error(`Nie udało się pobrać zakładki "${sheetName}".`);

  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const parseCsvLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(current);
        current = "";
      } else current += char;
    }
    values.push(current);
    return values;
  };

  return rowsFromValues(lines.map(parseCsvLine));
}

async function loadLeadMap(supabase: SupabaseClient, crmEnvironment: CrmDataScope) {
  const map = new Map<string, LeadRef>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("id,phone")
      .eq("crm_environment", crmEnvironment)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const lead of data || []) {
      const key = phoneKey(lead.phone);
      if (key && !map.has(key)) map.set(key, lead as LeadRef);
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

export async function backfillGoogleSheetsFormNotes(sheetNames: string[]) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID || "1bTJ0WZGwpEgZh-IeUOMvt2KBaqrO52c-QNjBpR2h7so";
  const crmEnvironment = normalizeCrmScope(process.env.GOOGLE_SHEETS_LEADS_CRM_ENVIRONMENT);
  const supabase = adminClient();
  const accessToken = await googleAccessToken();
  const leadMap = await loadLeadMap(supabase, crmEnvironment);
  const candidates: Array<{ lead_id: string; created_at: string; description: string }> = [];

  for (const sheetName of sheetNames) {
    let rows: SheetRow[];
    try {
      rows = await fetchRows(spreadsheetId, sheetName, accessToken);
    } catch (error) {
      console.warn("Form-note backfill sheet read failed", { sheetName, error: error instanceof Error ? error.message : "unknown" });
      continue;
    }

    for (const row of rows) {
      const key = phoneKey(row.phone_number);
      const lead = key ? leadMap.get(key) : null;
      const createdAt = submittedAt(row.created_time);
      const description = formNoteFromRow(row);
      if (!lead || !createdAt || !description) continue;
      candidates.push({ lead_id: lead.id, created_at: createdAt, description });
    }
  }

  let inserted = 0;
  for (const candidate of candidates) {
    const start = new Date(candidate.created_at);
    const end = new Date(start.getTime() + 1000);
    const { data: existing, error: checkError } = await supabase
      .from("lead_history")
      .select("id,description")
      .eq("lead_id", candidate.lead_id)
      .eq("action_type", "comment")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .limit(10);

    if (checkError) {
      console.warn("Form-note backfill duplicate check failed", checkError.message);
      continue;
    }
    if ((existing || []).some((row) => {
      const description = String(row.description || "");
      return description.startsWith("Odpowiedzi z formularza:") || description.startsWith("Zgłoszenie z formularza:");
    })) continue;

    const { error: insertError } = await supabase.from("lead_history").insert({
      lead_id: candidate.lead_id,
      user_id: null,
      action_type: "comment",
      description: candidate.description,
      created_at: candidate.created_at
    });
    if (insertError) console.warn("Form-note backfill insert failed", insertError.message);
    else inserted += 1;
  }

  return { scanned: candidates.length, inserted };
}
