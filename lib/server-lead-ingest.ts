import {
  normalizeEmailKey,
  normalizeLeadImportBatch,
  normalizePhoneKey,
  type NormalizedLeadImportRow,
  type RawLeadImportRow
} from "@/lib/lead-import";
import type { CrmDataScope } from "@/lib/types";

type ServiceClient = {
  // Supabase query builders are heavily generic; the shared importer only needs the fluent runtime surface.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type ExistingLeadRow = {
  id: string;
  phone: string | null;
  email?: string | null;
  phone_key?: string | null;
  email_key?: string | null;
};

export type LeadIngestInput = {
  supabaseAdmin: ServiceClient;
  rows: RawLeadImportRow[];
  source: string;
  fileName?: string;
  userId?: string | null;
  crmEnvironment: CrmDataScope | string;
  dryRun?: boolean;
  now?: Date;
};

export type LeadIngestResult = {
  imported: number;
  importedIds: string[];
  skippedExisting: number;
  skippedInFile: number;
  failed: number;
  batchId: string | null;
  dryRun?: boolean;
  ready?: number;
  statusPreview?: Record<string, number>;
  error?: string;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function stripV2LeadColumns(row: Record<string, unknown>) {
  const { email, phone_key: phoneKey, email_key: emailKey, ...fallback } = row;
  void email;
  void phoneKey;
  void emailKey;
  return fallback;
}

function leadPayload(row: NormalizedLeadImportRow, crmEnvironment: CrmDataScope | string, fallbackSource: string) {
  const payload: Record<string, unknown> = {
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    phone_key: row.dedupe_key.startsWith("phone:") ? row.dedupe_key : null,
    email_key: row.email ? normalizeEmailKey(row.email) : null,
    postal_code: row.postal_code,
    address: row.address,
    voivodeship: row.voivodeship,
    county: row.county,
    source: row.source || fallbackSource,
    status: row.status,
    assigned_to: null,
    crm_environment: crmEnvironment
  };

  if (row.created_at) payload.created_at = row.created_at;
  return payload;
}

async function tryInsertBatch(
  supabaseAdmin: ServiceClient,
  input: { userId?: string | null; crmEnvironment: CrmDataScope | string; source: string; fileName?: string; totalRows: number }
) {
  if (!input.userId) return undefined;

  const result = (await supabaseAdmin
    .from("import_batches")
    .insert({
      created_by: input.userId,
      crm_environment: input.crmEnvironment,
      source: input.source,
      entity_type: "leads",
      status: "processing",
      file_name: input.fileName || null,
      total_rows: input.totalRows,
      started_at: new Date().toISOString()
    })
    .select("id")
    .single()) as { data?: { id?: string } | null };

  return result.data?.id;
}

async function tryFinishBatch(
  supabaseAdmin: ServiceClient,
  batchId: string | undefined,
  input: { processedRows: number; failedRows: number; status: "completed" | "completed_with_errors" | "failed"; errorSummary?: string }
) {
  if (!batchId) return;

  await supabaseAdmin
    .from("import_batches")
    .update({
      status: input.status,
      processed_rows: input.processedRows,
      failed_rows: input.failedRows,
      finished_at: new Date().toISOString(),
      error_summary: input.errorSummary || null
    })
    .eq("id", batchId);
}

async function tryInsertBatchRows(
  supabaseAdmin: ServiceClient,
  batchId: string | undefined,
  rows: Array<Record<string, unknown>>
) {
  if (!batchId || rows.length === 0) return;
  for (const chunk of chunkArray(rows, 500)) {
    await supabaseAdmin.from("import_batch_rows").insert(chunk);
  }
}

async function insertLeadPayloads(supabaseAdmin: ServiceClient, payloads: Array<Record<string, unknown>>) {
  const inserted: Array<{ id: string }> = [];

  for (const chunk of chunkArray(payloads, 500)) {
    const result = (await supabaseAdmin.from("leads").insert(chunk).select("id")) as {
      data?: Array<{ id: string }> | null;
      error?: { message?: string } | null;
    };
    if (result.error) return { inserted, error: result.error.message || "Błąd zapisu leadów." };
    inserted.push(...(result.data || []));
  }

  return { inserted, error: null };
}

async function insertLeadHistories(supabaseAdmin: ServiceClient, histories: Array<Record<string, unknown>>) {
  for (const chunk of chunkArray(histories, 500)) {
    await supabaseAdmin.from("lead_history").insert(chunk);
  }
}

async function readExistingKeys(
  supabaseAdmin: ServiceClient,
  validRows: NormalizedLeadImportRow[],
  crmEnvironment: CrmDataScope | string
) {
  const existingKeys = new Set<string>();
  const phoneKeys = validRows.filter((row) => row.dedupe_key.startsWith("phone:")).map((row) => row.dedupe_key);
  const emailKeys = validRows.map((row) => normalizeEmailKey(row.email)).filter(Boolean);

  if (phoneKeys.length === 0 && emailKeys.length === 0) return existingKeys;

  let keyLookupFailed = false;

  for (const chunk of chunkArray(phoneKeys, 500)) {
    const result = (await supabaseAdmin
      .from("leads")
      .select("id,phone,email,phone_key,email_key")
      .eq("crm_environment", crmEnvironment)
      .in("phone_key", chunk)) as { data?: ExistingLeadRow[] | null; error?: { message?: string } | null };

    if (result.error) {
      keyLookupFailed = true;
      break;
    }

    result.data?.forEach((lead) => {
      if (lead.phone_key) existingKeys.add(lead.phone_key);
      if (lead.email_key) existingKeys.add(lead.email_key);
    });
  }

  if (!keyLookupFailed) {
    for (const chunk of chunkArray(emailKeys, 500)) {
      const result = (await supabaseAdmin
        .from("leads")
        .select("id,phone,email,phone_key,email_key")
        .eq("crm_environment", crmEnvironment)
        .in("email_key", chunk)) as { data?: ExistingLeadRow[] | null; error?: { message?: string } | null };

      if (result.error) {
        keyLookupFailed = true;
        break;
      }

      result.data?.forEach((lead) => {
        if (lead.phone_key) existingKeys.add(lead.phone_key);
        if (lead.email_key) existingKeys.add(lead.email_key);
      });
    }
  }

  if (keyLookupFailed) {
    const phones = validRows.map((row) => row.phone).filter(Boolean);
    for (const chunk of chunkArray(phones, 500)) {
      const result = (await supabaseAdmin
        .from("leads")
        .select("id,phone")
        .eq("crm_environment", crmEnvironment)
        .in("phone", chunk)) as { data?: ExistingLeadRow[] | null };

      result.data?.forEach((lead) => {
        if (lead.phone) existingKeys.add(normalizePhoneKey(lead.phone));
      });
    }
  }

  return existingKeys;
}

export async function ingestRawLeadRows(input: LeadIngestInput): Promise<LeadIngestResult> {
  const normalized = normalizeLeadImportBatch(input.rows, input.now || new Date());
  const validRows = normalized.valid;

  if (input.dryRun) {
    return {
      dryRun: true,
      imported: 0,
      importedIds: [],
      skippedExisting: 0,
      skippedInFile: normalized.duplicates.length,
      failed: normalized.failed.length,
      batchId: null,
      ready: validRows.length,
      statusPreview: validRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {})
    };
  }

  const batchId = await tryInsertBatch(input.supabaseAdmin, {
    userId: input.userId,
    crmEnvironment: input.crmEnvironment,
    source: input.source,
    fileName: input.fileName,
    totalRows: input.rows.length
  }).catch(() => undefined);

  const existingKeys = await readExistingKeys(input.supabaseAdmin, validRows, input.crmEnvironment);
  const importedRows = validRows.filter((row) => !existingKeys.has(row.dedupe_key) && !existingKeys.has(normalizeEmailKey(row.email)));
  const existingDuplicates = validRows.filter((row) => !importedRows.includes(row));
  let payloads = importedRows.map((row) => leadPayload(row, input.crmEnvironment, input.source));

  let inserted: Array<{ id: string }> = [];
  let importError: string | null = null;

  if (payloads.length > 0) {
    let insertResult = await insertLeadPayloads(input.supabaseAdmin, payloads);

    if (insertResult.error?.includes("email") || insertResult.error?.includes("phone_key")) {
      payloads = payloads.map(stripV2LeadColumns);
      insertResult = await insertLeadPayloads(input.supabaseAdmin, payloads);
    }

    if (insertResult.error) {
      importError = insertResult.error;
    } else {
      inserted = insertResult.inserted;
    }
  }

  const histories = importedRows
    .map((row, index) => ({ row, id: inserted[index]?.id }))
    .filter((item) => item.id && item.row.comment)
    .map((item) => ({
      lead_id: item.id,
      user_id: input.userId || null,
      action_type: "import_comment",
      description: `Import: ${item.row.comment}`
    }));

  if (histories.length > 0) await insertLeadHistories(input.supabaseAdmin, histories);

  const batchRows = [
    ...normalized.failed.map((item) => ({
      import_batch_id: batchId,
      row_number: item.rowNumber,
      status: "failed",
      raw_data: item.raw,
      normalized_data: {},
      error_message: item.error
    })),
    ...normalized.duplicates.map((item) => ({
      import_batch_id: batchId,
      row_number: item.rowNumber,
      status: "skipped",
      raw_data: item.raw,
      normalized_data: { dedupe_key: item.dedupe_key },
      error_message: "Duplikat w tym samym pliku."
    })),
    ...existingDuplicates.map((row, index) => ({
      import_batch_id: batchId,
      row_number: index + 1,
      status: "skipped",
      raw_data: row,
      normalized_data: row,
      error_message: "Duplikat istniejącego leada."
    }))
  ].filter((row) => row.import_batch_id);

  await tryInsertBatchRows(input.supabaseAdmin, batchId, batchRows).catch(() => undefined);

  const failedRows = normalized.failed.length + normalized.duplicates.length + existingDuplicates.length + (importError ? importedRows.length : 0);
  await tryFinishBatch(input.supabaseAdmin, batchId, {
    processedRows: inserted.length,
    failedRows,
    status: importError ? "failed" : failedRows > 0 ? "completed_with_errors" : "completed",
    errorSummary: importError || undefined
  }).catch(() => undefined);

  return {
    imported: inserted.length,
    importedIds: inserted.map((item) => item.id),
    skippedExisting: existingDuplicates.length,
    skippedInFile: normalized.duplicates.length,
    failed: normalized.failed.length,
    batchId: batchId || null,
    error: importError || undefined
  };
}
