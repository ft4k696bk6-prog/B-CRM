import type { RawLeadImportRow } from "@/lib/lead-import";
import { ingestRawLeadRows, type LeadIngestResult } from "@/lib/server-lead-ingest";
import type { CrmDataScope } from "@/lib/types";

export type MetaLeadField = {
  name: string;
  values?: string[];
};

export type MetaLeadgenPayload = {
  id?: string;
  created_time?: string;
  field_data?: MetaLeadField[];
  form_id?: string;
  page_id?: string;
  ad_id?: string;
  campaign_id?: string;
  adset_id?: string;
  platform?: string;
};

type MetaLeadForm = {
  id: string;
  name?: string;
};

type MetaGraphList<T> = {
  data?: T[];
  paging?: {
    next?: string;
  };
};

type MetaGraphError = {
  error?: {
    message?: string;
  };
};

type SyncInput = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any;
  crmEnvironment?: CrmDataScope | string;
  userId?: string | null;
  dryRun?: boolean;
};

type MetaFormSyncResult = LeadIngestResult & {
  formId: string;
  formName?: string;
  sourceRows: number;
};

function csvList(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function envFlag(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "unset";
  if (["1", "true", "yes", "on"].includes(normalized)) return "enabled";
  if (["0", "false", "no", "off"].includes(normalized)) return "disabled";
  return "invalid";
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function metaAccessToken() {
  return process.env.META_PAGE_ACCESS_TOKEN || process.env.META_LEAD_ADS_ACCESS_TOKEN || "";
}

function metaGraphVersion() {
  return process.env.META_GRAPH_VERSION || "v20.0";
}

export function metaLeadAdsSyncStatus() {
  const flag = envFlag(process.env.META_LEAD_ADS_SYNC_ENABLED);
  const formIds = csvList(process.env.META_LEAD_ADS_FORM_IDS);
  const pageIds = csvList(process.env.META_LEAD_ADS_PAGE_IDS || process.env.META_PAGE_ID);
  const hasAccessToken = Boolean(metaAccessToken());
  const hasSources = formIds.length > 0 || pageIds.length > 0;
  const missing: string[] = [];

  if (!hasAccessToken) missing.push("META_PAGE_ACCESS_TOKEN albo META_LEAD_ADS_ACCESS_TOKEN");
  if (!hasSources) missing.push("META_LEAD_ADS_FORM_IDS albo META_LEAD_ADS_PAGE_IDS");

  return {
    enabled: flag === "enabled" || (flag === "unset" && hasAccessToken && hasSources),
    flag,
    configured: {
      accessToken: hasAccessToken,
      formIds: formIds.length,
      pageIds: pageIds.length
    },
    missing
  };
}

export function fieldValue(fields: MetaLeadField[] | undefined, names: string[]) {
  const normalizedNames = names.map((name) => name.toLowerCase());
  const match = fields?.find((field) => normalizedNames.includes(field.name.toLowerCase()));
  return match?.values?.[0] || "";
}

async function metaGraphJson<T>(url: URL, accessToken: string) {
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const body = (await response.json()) as T & MetaGraphError;
  if (!response.ok) throw new Error(body.error?.message || `Błąd Meta Graph API (${response.status}).`);
  return body;
}

async function metaGraphPages<T>(url: URL, accessToken: string, maxPages: number) {
  const rows: T[] = [];
  let pageUrl: URL | null = url;
  let pages = 0;

  while (pageUrl && pages < maxPages) {
    const body: MetaGraphList<T> = await metaGraphJson<MetaGraphList<T>>(pageUrl, accessToken);
    rows.push(...(body.data || []));
    pageUrl = body.paging?.next ? new URL(body.paging.next) : null;
    pages += 1;
  }

  return rows;
}

export async function fetchMetaLeadgen(leadgenId: string) {
  const accessToken = metaAccessToken();
  if (!accessToken) return { data: null, error: "Brakuje tokenu Meta do pobrania danych leadgen." };

  try {
    const url = new URL(`https://graph.facebook.com/${metaGraphVersion()}/${leadgenId}`);
    url.searchParams.set("fields", "id,created_time,field_data,form_id,page_id,ad_id,campaign_id,adset_id,platform");
    return { data: await metaGraphJson<MetaLeadgenPayload>(url, accessToken), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Nie udało się pobrać danych leadgen." };
  }
}

async function fetchPageLeadForms(accessToken: string, pageId: string) {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion()}/${pageId}/leadgen_forms`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("limit", "100");
  return metaGraphPages<MetaLeadForm>(url, accessToken, 10);
}

async function fetchFormLeads(accessToken: string, formId: string, maxPages: number) {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion()}/${formId}/leads`);
  url.searchParams.set("fields", "id,created_time,field_data,form_id,page_id,ad_id,campaign_id,adset_id,platform");
  url.searchParams.set("limit", "100");
  return metaGraphPages<MetaLeadgenPayload>(url, accessToken, maxPages);
}

export function metaLeadgenToRawLead(details: MetaLeadgenPayload, fallback: { leadgenId?: string; formId?: string; pageId?: string }) {
  const fields = details.field_data;
  const firstName = fieldValue(fields, ["first_name", "firstname", "imię", "imie"]);
  const lastName = fieldValue(fields, ["last_name", "lastname", "nazwisko"]);
  const fullName =
    fieldValue(fields, ["full_name", "name", "imie_i_nazwisko", "imię_i_nazwisko", "imie i nazwisko", "imię i nazwisko"]) ||
    [firstName, lastName].filter(Boolean).join(" ");
  const leadgenId = details.id || fallback.leadgenId || "";
  const formId = details.form_id || fallback.formId || "";
  const pageId = details.page_id || fallback.pageId || "";

  return {
    full_name: fullName || `Meta lead ${leadgenId || formId}`.trim(),
    phone: fieldValue(fields, ["phone_number", "phone", "telefon", "numer_telefonu", "numer telefonu"]),
    email: fieldValue(fields, ["email", "e-mail", "mail"]),
    source: "Meta Lead Ads",
    status: "Nowy",
    created_at: details.created_time,
    comment: [
      leadgenId ? `Meta Lead Ads: leadgen_id=${leadgenId}` : "Meta Lead Ads",
      formId ? `form_id=${formId}` : "",
      pageId ? `page_id=${pageId}` : "",
      details.ad_id ? `ad_id=${details.ad_id}` : "",
      details.campaign_id ? `campaign_id=${details.campaign_id}` : "",
      details.platform ? `platform=${details.platform}` : ""
    ]
      .filter(Boolean)
      .join(" | ")
  } satisfies RawLeadImportRow;
}

async function configuredForms(accessToken: string) {
  const forms = new Map<string, MetaLeadForm>();
  csvList(process.env.META_LEAD_ADS_FORM_IDS).forEach((id) => forms.set(id, { id }));

  for (const pageId of csvList(process.env.META_LEAD_ADS_PAGE_IDS || process.env.META_PAGE_ID)) {
    const pageForms = await fetchPageLeadForms(accessToken, pageId);
    pageForms.forEach((form) => forms.set(form.id, form));
  }

  return Array.from(forms.values());
}

export async function syncMetaLeadAds(input: SyncInput) {
  const status = metaLeadAdsSyncStatus();
  if (!status.enabled) {
    return { enabled: false, syncStatus: status, forms: [], totals: { imported: 0, skippedExisting: 0, skippedInFile: 0, failed: 0 } };
  }

  const accessToken = metaAccessToken();
  const maxPages = parsePositiveInt(process.env.META_LEAD_ADS_MAX_PAGES, 25);
  const forms = await configuredForms(accessToken);
  const results: MetaFormSyncResult[] = [];

  for (const form of forms) {
    const leads = await fetchFormLeads(accessToken, form.id, maxPages);
    const rows = leads.map((lead) => metaLeadgenToRawLead(lead, { formId: form.id }));
    const result = await ingestRawLeadRows({
      supabaseAdmin: input.supabaseAdmin,
      rows,
      source: "Meta Lead Ads",
      fileName: `meta-form-${form.name || form.id}`,
      userId: input.userId || null,
      crmEnvironment: input.crmEnvironment || "production",
      dryRun: input.dryRun
    });

    results.push({
      ...result,
      formId: form.id,
      formName: form.name,
      sourceRows: rows.length
    });
  }

  return {
    enabled: true,
    syncStatus: status,
    forms: results,
    totals: results.reduce(
      (acc, result) => ({
        imported: acc.imported + result.imported,
        skippedExisting: acc.skippedExisting + result.skippedExisting,
        skippedInFile: acc.skippedInFile + result.skippedInFile,
        failed: acc.failed + result.failed
      }),
      { imported: 0, skippedExisting: 0, skippedInFile: 0, failed: 0 }
    )
  };
}
