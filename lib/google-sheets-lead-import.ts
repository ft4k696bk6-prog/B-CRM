import Papa from "papaparse";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { googleWorkspaceToken } from "@/lib/google-workspace";
import { sendEventPushToProfiles } from "@/lib/push-events";
import { normalizeCrmScope } from "@/lib/scope";
import type { CrmDataScope } from "@/lib/types";

type SheetRow = Record<string, string | undefined> & {
  id?: string;
  created_time?: string;
  full_name?: string;
  phone_number?: string;
  post_code?: string;
  "Województwo"?: string;
  campaign_name?: string;
  form_name?: string;
  platform?: string;
};

type PreparedLead = {
  full_name: string;
  phone: string;
  postal_code: string | null;
  voivodeship: string | null;
  source: string;
  source_before_resubmission: string | null;
  campaign: string | null;
  status: "Nowy";
  assigned_to: null;
  assigned_at: string | null;
  crm_environment: CrmDataScope;
  created_at: string;
  address: null;
  county: null;
  last_form_submission_at: string;
  form_submission_count: number;
  form_resubmission_pending: boolean;
  attention_at: string;
};

type ExistingLead = {
  id: string;
  phone: string;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  source: string | null;
  source_before_resubmission: string | null;
  last_form_submission_at: string | null;
  form_submission_count: number | null;
};

type RepeatCandidate = {
  lead: ExistingLead;
  latestSubmittedAt: string;
  newSubmissionCount: number;
  sourceSubmissionId: string | null;
  campaign: string | null;
  formName: string | null;
  platform: string | null;
  sheetName: string;
  formNote: string | null;
};

type PendingNewLead = {
  lead: PreparedLead;
  latestSubmittedAt: string;
  formNote: string | null;
};

type InsertedLead = {
  id: string;
  full_name: string;
  phone: string;
  campaign: string | null;
};

type ImportResult = {
  scanned: number;
  prepared: number;
  inserted: number;
  resubmitted: number;
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
  "Małopolskie magazyny",
  "Magazyny energii Podlaskie"
];

const VALID_VOIVODESHIPS = new Set([
  "dolnoslaskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "lodzkie",
  "malopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "slaskie",
  "swietokrzyskie",
  "warminsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie"
]);

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
  "is_organic"
]);

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Brakuje NEXT_PUBLIC_SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
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
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
}

function normalizePostalCode(value: unknown) {
  const raw = cleanPrefixedValue(value, "z:");
  const digits = raw.replace(/\D/g, "");

  if (digits.length >= 5) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}`;
  return raw.trim();
}

function normalizeVoivodeship(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/ą/g, "a")
    .replace(/ę/g, "e")
    .replace(/ó/g, "o")
    .replace(/ś/g, "s")
    .replace(/ż|ź/g, "z")
    .replace(/ć/g, "c")
    .replace(/ń/g, "n")
    .replace(/\s+/g, "-");

  return VALID_VOIVODESHIPS.has(normalized) ? normalized : null;
}

function voivodeshipFromSheetName(sheetName: string) {
  return normalizeVoivodeship(sheetName.replace(/magazyny energii|magazyny|formularz|copy|podkarpackie magazyn energii/gi, ""));
}

export function voivodeshipFromPostalCode(postalCode: string | null) {
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

function createdAtFromMeta(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function timestampMs(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeColumnName(value: string) {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase();
}

function questionLabel(value: string) {
  const trimmed = value.trim().replace(/^\uFEFF/, "");
  return trimmed.includes("_") ? trimmed.replace(/_+/g, " ") : trimmed;
}

function answerLabel(value: string) {
  return value.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
}

function isReviewForm(formName: string | null, campaign: string | null) {
  const source = `${formName || ""} ${campaign || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return source.includes("przegl");
}

function formNoteFromRow(row: SheetRow, formName: string | null, campaign: string | null) {
  if (!isReviewForm(formName, campaign)) return null;

  const answers = Object.entries(row)
    .filter(([column, rawValue]) => {
      const value = String(rawValue || "").trim();
      const normalized = normalizeColumnName(column);
      return Boolean(value)
        && !META_FORM_COLUMNS.has(normalized)
        && !["inbox_url", "lead_status", "priority", "created", "created_at", "updated", "updated_at", "status"].includes(normalized)
        && !normalized.startsWith("utm_")
        && normalized !== "fbclid"
        && normalized !== "gclid"
        && !value.startsWith("<test lead:");
    })
    .slice(0, 40)
    .map(([column, rawValue]) => `${questionLabel(column)} - ${answerLabel(String(rawValue || "")).slice(0, 1000)}`);

  if (!answers.length) return null;

  return [
    "Odpowiedzi z formularza:",
    ...answers
  ].join("\n").slice(0, 12000);
}
function csvUrl(spreadsheetId: string, sheetName: string) {
  const params = new URLSearchParams({
    tqx: "out:csv",
    sheet: sheetName,
    headers: "1",
    cache_bust: Date.now().toString()
  });
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
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

  return rows.map((row) =>
    normalizedHeaders.reduce<SheetRow>((record, header, index) => {
      if (header) record[header] = row[index] || "";
      return record;
    }, {})
  );
}

async function fetchSheetRowsViaGoogleApi(spreadsheetId: string, sheetName: string, accessToken: string) {
  const range = `'${sheetName.replace(/'/g, "''")}'!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  const body = (await response.json()) as { values?: string[][]; error?: { message?: string } };

  if (!response.ok) {
    throw new Error(body.error?.message || `Nie udało się pobrać zakładki "${sheetName}" z Google Sheets API.`);
  }

  return rowsFromValues(body.values || []);
}

async function fetchSheetRowsViaPublicCsv(spreadsheetId: string, sheetName: string) {
  const response = await fetch(csvUrl(spreadsheetId, sheetName), { cache: "no-store" });
  const csv = await response.text();

  if (!response.ok || csv.trim().startsWith("<")) {
    throw new Error(`Nie udało się pobrać zakładki "${sheetName}". Sprawdź, czy arkusz jest dostępny dla osób z linkiem.`);
  }

  const parsed = Papa.parse<SheetRow>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().replace(/^\uFEFF/, "")
  });

  if (parsed.errors.length > 0) {
    throw new Error(`Nie udało się odczytać CSV z zakładki "${sheetName}".`);
  }

  return parsed.data;
}

async function fetchSheetRows(spreadsheetId: string, sheetName: string, accessToken: string | null) {
  if (accessToken) {
    try {
      return await fetchSheetRowsViaGoogleApi(spreadsheetId, sheetName, accessToken);
    } catch (error) {
      console.warn("Google Sheets API read failed; using public CSV", {
        sheetName,
        error: error instanceof Error ? error.message : "unknown"
      });
      return fetchSheetRowsViaPublicCsv(spreadsheetId, sheetName);
    }
  }
  return fetchSheetRowsViaPublicCsv(spreadsheetId, sheetName);
}

async function fetchExistingLeadMap(supabase: SupabaseClient, crmEnvironment: CrmDataScope) {
  const leads = new Map<string, ExistingLead>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("id,phone,created_at,updated_at,assigned_at,source,source_before_resubmission,last_form_submission_at,form_submission_count")
      .eq("crm_environment", crmEnvironment)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    for (const row of data || []) {
      const key = phoneKey(row.phone);
      if (key && !leads.has(key)) leads.set(key, row as ExistingLead);
    }

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return leads;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function notifyNewLeadWatchers(
  supabase: SupabaseClient,
  crmEnvironment: CrmDataScope,
  insertedLeads: InsertedLead[]
) {
  if (!insertedLeads.length) return;

  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id,role,can_view_lead_pool")
      .eq("crm_environment", crmEnvironment);

    if (error) {
      console.error("New lead push recipients:", error.message);
      return;
    }

    const recipientIds = (profiles || [])
      .filter((person) => person.role === "owner" || person.role === "admin" || person.can_view_lead_pool === true)
      .map((person) => person.id);

    if (!recipientIds.length) return;

    const first = insertedLeads[0];
    const count = insertedLeads.length;
    await sendEventPushToProfiles(
      supabase,
      crmEnvironment,
      recipientIds,
      {
        title: count === 1 ? "Nowy lead w CRM" : `Nowe leady w CRM: ${count}`,
        body: count === 1
          ? `${first.full_name}${first.campaign ? ` · ${first.campaign}` : ""} czeka na obsługę.`
          : `${count} nowych leadów czeka na obsługę lub przypisanie.`,
        url: count === 1 ? `/leads/${first.id}` : "/admin",
        tag: `new-leads-${first.id}`
      }
    );
  } catch (error) {
    console.error("New lead push:", error);
  }
}

export async function importGoogleSheetsLeads(): Promise<ImportResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  const configuredSheetNames = (process.env.GOOGLE_SHEETS_LEADS_SHEET_NAMES || "")
    .split(",")
    .map((sheet) => sheet.trim())
    .filter(Boolean);
  const sheetNames = Array.from(new Set([...DEFAULT_SHEET_NAMES, ...configuredSheetNames]));
  const crmEnvironment = normalizeCrmScope(process.env.GOOGLE_SHEETS_LEADS_CRM_ENVIRONMENT);

  const result: ImportResult = {
    scanned: 0,
    prepared: 0,
    inserted: 0,
    resubmitted: 0,
    skipped: 0,
    errors: []
  };

  const supabase = adminClient();
  const accessToken = await googleAccessToken();
  const existingLeads = await fetchExistingLeadMap(supabase, crmEnvironment);
  const pendingNew = new Map<string, PendingNewLead>();
  const repeatCandidates = new Map<string, RepeatCandidate>();
  const seenSubmissionIds = new Set<string>();

  for (const sheetName of sheetNames) {
    let rows: SheetRow[] = [];

    try {
      rows = await fetchSheetRows(spreadsheetId, sheetName, accessToken);
      console.info("Google Sheets lead source scanned", { sheetName, rows: rows.length });
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : `Błąd zakładki "${sheetName}".`);
      continue;
    }

    for (const row of rows) {
      result.scanned += 1;

      const sourceSubmissionId = typeof row.id === "string" && row.id.trim() ? row.id.trim() : null;
      if (sourceSubmissionId && seenSubmissionIds.has(sourceSubmissionId)) {
        result.skipped += 1;
        continue;
      }
      if (sourceSubmissionId) seenSubmissionIds.add(sourceSubmissionId);

      const fullName = typeof row.full_name === "string" ? row.full_name.trim().slice(0, 180) : "";
      const phone = normalizePhoneDisplay(row.phone_number).slice(0, 60);
      const key = phoneKey(phone);

      if (!fullName || !phone || !key) {
        result.skipped += 1;
        continue;
      }

      const submittedAt = createdAtFromMeta(row.created_time);
      const postalCode = normalizePostalCode(row.post_code).slice(0, 20) || null;
      const voivodeship =
        voivodeshipFromSheetName(sheetName) ||
        voivodeshipFromPostalCode(postalCode) ||
        normalizeVoivodeship(row["Województwo"]);
      const campaign = (typeof row.campaign_name === "string" ? row.campaign_name.trim() : "") || sheetName;
      const formName = (typeof row.form_name === "string" ? row.form_name.trim() : "") || null;
      const platform = (typeof row.platform === "string" ? row.platform.trim() : "") || null;
      const formNote = formNoteFromRow(row, formName, campaign);
      const existing = existingLeads.get(key);

      if (existing) {
        const baseline = existing.last_form_submission_at || existing.created_at;

        if (!baseline || timestampMs(submittedAt) <= timestampMs(baseline)) {
          result.skipped += 1;
          continue;
        }

        const candidate = repeatCandidates.get(key);
        if (!candidate) {
          repeatCandidates.set(key, {
            lead: existing,
            latestSubmittedAt: submittedAt,
            newSubmissionCount: 1,
            sourceSubmissionId,
            campaign,
            formName,
            platform,
            sheetName,
            formNote
          });
        } else {
          candidate.newSubmissionCount += 1;
          if (timestampMs(submittedAt) > timestampMs(candidate.latestSubmittedAt)) {
            candidate.latestSubmittedAt = submittedAt;
            candidate.sourceSubmissionId = sourceSubmissionId;
            candidate.campaign = campaign;
            candidate.formName = formName;
            candidate.platform = platform;
            candidate.sheetName = sheetName;
            candidate.formNote = formNote;
          }
        }
        continue;
      }

      const pending = pendingNew.get(key);
      if (!pending) {
        pendingNew.set(key, {
          latestSubmittedAt: submittedAt,
          formNote,
          lead: {
            full_name: fullName,
            phone,
            postal_code: postalCode,
            voivodeship,
            source: "B2C",
            source_before_resubmission: null,
            campaign,
            status: "Nowy",
            assigned_to: null,
            assigned_at: null,
            crm_environment: crmEnvironment,
            created_at: submittedAt,
            address: null,
            county: null,
            last_form_submission_at: submittedAt,
            form_submission_count: 1,
            form_resubmission_pending: false,
            attention_at: submittedAt
          }
        });
        continue;
      }

      pending.lead.form_submission_count += 1;
      pending.lead.form_resubmission_pending = true;

      if (timestampMs(submittedAt) < timestampMs(pending.lead.created_at)) {
        pending.lead.created_at = submittedAt;
      }

      if (timestampMs(submittedAt) > timestampMs(pending.latestSubmittedAt)) {
        pending.latestSubmittedAt = submittedAt;
        pending.formNote = formNote;
        pending.lead.last_form_submission_at = submittedAt;
        pending.lead.attention_at = submittedAt;
        pending.lead.full_name = fullName;
        pending.lead.phone = phone;
        pending.lead.postal_code = postalCode;
        pending.lead.voivodeship = voivodeship;
        pending.lead.campaign = campaign;
      }
    }
  }

  const pendingEntries = Array.from(pendingNew.values());
  result.prepared = pendingEntries.length;
  console.info("Google Sheets lead import prepared", {
    ...result,
    repeatCandidates: repeatCandidates.size
  });

  const insertedLeads: InsertedLead[] = [];

  for (const pendingChunk of chunk(pendingEntries, 500)) {
    const { data: insertedData, error } = await supabase
      .from("leads")
      .insert(pendingChunk.map((entry) => entry.lead))
      .select("id,full_name,phone,campaign");

    if (error) {
      result.errors.push(error.message);
      continue;
    }

    const insertedRows = (insertedData || []) as InsertedLead[];
    result.inserted += insertedRows.length;
    insertedLeads.push(...insertedRows);

    const pendingByPhone = new Map(pendingChunk.map((entry) => [phoneKey(entry.lead.phone), entry]));
    const noteRows = insertedRows.flatMap((inserted) => {
      const pending = pendingByPhone.get(phoneKey(inserted.phone));
      if (!pending?.formNote) return [];
      return [{
        lead_id: inserted.id,
        user_id: null,
        action_type: "comment",
        description: pending.formNote,
        created_at: pending.latestSubmittedAt
      }];
    });

    if (noteRows.length) {
      const { error: noteError } = await supabase.from("lead_history").insert(noteRows);
      if (noteError) result.errors.push(`Notatki z formularzy: ${noteError.message}`);
    }
  }

  await notifyNewLeadWatchers(supabase, crmEnvironment, insertedLeads);

  for (const candidate of repeatCandidates.values()) {
    const previousCount = Math.max(candidate.lead.form_submission_count || 0, 1);
    const nextCount = previousCount + candidate.newSubmissionCount;
    const historicalBackfill = !candidate.lead.last_form_submission_at && (candidate.lead.form_submission_count || 0) <= 1;
    const updatePayload: Record<string, unknown> = {
      last_form_submission_at: candidate.latestSubmittedAt,
      form_submission_count: nextCount
    };

    if (!historicalBackfill) {
      updatePayload.form_resubmission_pending = true;
      updatePayload.attention_at = candidate.latestSubmittedAt;
    }

    const { error: updateError } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", candidate.lead.id)
      .eq("crm_environment", crmEnvironment);

    if (updateError) {
      result.errors.push(`Ponowne zgłoszenie ${candidate.lead.id}: ${updateError.message}`);
      continue;
    }

    const details = [
      candidate.formName ? `formularz: ${candidate.formName}` : null,
      candidate.campaign ? `kampania: ${candidate.campaign}` : null
    ].filter(Boolean).join(" · ");

    const { error: activityError } = await supabase.from("lead_activities").insert({
      lead_id: candidate.lead.id,
      user_id: null,
      activity_type: "form_resubmitted",
      title: historicalBackfill ? "Historyczne ponowne zgłoszenie" : "Ponownie wypełnił formularz",
      description: historicalBackfill
        ? `Wykryto historyczne ponowne zgłoszenie klienta${details ? `. ${details}` : "."}`
        : details
          ? `Klient ponownie wypełnił formularz. ${details}`
          : "Klient ponownie wypełnił formularz.",
      old_value: { form_submission_count: previousCount },
      new_value: {
        form_submission_count: nextCount,
        last_form_submission_at: candidate.latestSubmittedAt
      },
      metadata: {
        source_submission_id: candidate.sourceSubmissionId,
        source_sheet: candidate.sheetName,
        campaign: candidate.campaign,
        form_name: candidate.formName,
        platform: candidate.platform,
        new_submission_count: candidate.newSubmissionCount,
        historical_backfill: historicalBackfill
      },
      created_at: candidate.latestSubmittedAt
    });

    if (activityError) {
      result.errors.push(`Historia ponownego zgłoszenia ${candidate.lead.id}: ${activityError.message}`);
    }

    if (candidate.formNote) {
      const { error: noteError } = await supabase.from("lead_history").insert({
        lead_id: candidate.lead.id,
        user_id: null,
        action_type: "comment",
        description: candidate.formNote,
        created_at: candidate.latestSubmittedAt
      });
      if (noteError) result.errors.push(`Notatka ponownego zgłoszenia ${candidate.lead.id}: ${noteError.message}`);
    }

    result.resubmitted += 1;
  }

  return result;
}