import { NextResponse } from "next/server";
import {
  normalizeLeadImportBatch,
  normalizeEmailKey,
  normalizePhoneKey,
  type NormalizedLeadImportRow,
  type RawLeadImportRow
} from "@/lib/lead-import";
import { canManageLeads } from "@/lib/roles";
import { checkServerRateLimit, isRequestBodyError, rateLimitResponse, readJsonBody } from "@/lib/request-security";
import { getServiceClient, requireApiProfile } from "@/lib/server-auth";

type ImportBody = {
  rows?: RawLeadImportRow[];
  source?: string;
  fileName?: string;
  dryRun?: boolean;
};

type ExistingLeadRow = {
  id: string;
  phone: string | null;
  email?: string | null;
  phone_key?: string | null;
  email_key?: string | null;
};

type ServiceClient = ReturnType<typeof getServiceClient>;

function safeText(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stripV2LeadColumns(row: Record<string, unknown>) {
  const { email, phone_key: phoneKey, email_key: emailKey, ...fallback } = row;
  void email;
  void phoneKey;
  void emailKey;
  return fallback;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function leadPayload(row: NormalizedLeadImportRow, crmEnvironment: string, fallbackSource: string) {
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
  input: { userId: string; crmEnvironment: string; source: string; fileName: string; totalRows: number }
) {
  const { data } = await supabaseAdmin
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
    .single();

  return data?.id as string | undefined;
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
    const result = await supabaseAdmin.from("leads").insert(chunk).select("id");
    if (result.error) return { inserted, error: result.error.message };
    inserted.push(...((result.data || []) as Array<{ id: string }>));
  }

  return { inserted, error: null };
}

async function insertLeadHistories(supabaseAdmin: ServiceClient, histories: Array<Record<string, unknown>>) {
  for (const chunk of chunkArray(histories, 500)) {
    await supabaseAdmin.from("lead_history").insert(chunk);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if (auth.error) return auth.error;

    if (!canManageLeads(auth.profile.role)) {
      return NextResponse.json({ error: "Tylko właściciel, admin albo kierownik może importować leady." }, { status: 403 });
    }

    if (!checkServerRateLimit(`lead-import:${auth.profile.id}`, 50, 15 * 60 * 1000)) {
      return rateLimitResponse("Za dużo prób importu. Odczekaj chwilę przed kolejnym plikiem.");
    }

    const body = await readJsonBody<ImportBody>(request, 4 * 1024 * 1024);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const source = safeText(body.source, 120) || "Import";
    const fileName = safeText(body.fileName, 220);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Brakuje wierszy do importu." }, { status: 400 });
    }

    if (rows.length > 10000) {
      return NextResponse.json({ error: "Jednorazowy import ma limit 10000 wierszy." }, { status: 400 });
    }

    const normalized = normalizeLeadImportBatch(rows, new Date());
    const validRows = normalized.valid;

    if (body.dryRun) {
      return NextResponse.json({
        dryRun: true,
        ready: validRows.length,
        duplicatesInFile: normalized.duplicates.length,
        failed: normalized.failed.length,
        statusPreview: validRows.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = (acc[row.status] || 0) + 1;
          return acc;
        }, {})
      });
    }

    const batchId = await tryInsertBatch(auth.supabaseAdmin, {
      userId: auth.profile.id,
      crmEnvironment: auth.profile.crm_environment,
      source,
      fileName,
      totalRows: rows.length
    }).catch(() => undefined);

    const existingKeys = new Set<string>();
    const phoneKeys = validRows.filter((row) => row.dedupe_key.startsWith("phone:")).map((row) => row.dedupe_key);
    const emailKeys = validRows
      .map((row) => normalizeEmailKey(row.email))
      .filter(Boolean);

    if (phoneKeys.length > 0 || emailKeys.length > 0) {
      let keyLookupFailed = false;

      for (const chunk of chunkArray(phoneKeys, 500)) {
        const result = await auth.supabaseAdmin
          .from("leads")
          .select("id,phone,email,phone_key,email_key")
          .eq("crm_environment", auth.profile.crm_environment)
          .in("phone_key", chunk);

        if (result.error) {
          keyLookupFailed = true;
          break;
        }

        (result.data as ExistingLeadRow[] | null)?.forEach((lead) => {
          if (lead.phone_key) existingKeys.add(lead.phone_key);
          if (lead.email_key) existingKeys.add(lead.email_key);
        });
      }

      if (!keyLookupFailed) {
        for (const chunk of chunkArray(emailKeys, 500)) {
          const result = await auth.supabaseAdmin
            .from("leads")
            .select("id,phone,email,phone_key,email_key")
            .eq("crm_environment", auth.profile.crm_environment)
            .in("email_key", chunk);

          if (result.error) {
            keyLookupFailed = true;
            break;
          }

          (result.data as ExistingLeadRow[] | null)?.forEach((lead) => {
            if (lead.phone_key) existingKeys.add(lead.phone_key);
            if (lead.email_key) existingKeys.add(lead.email_key);
          });
        }
      }

      if (keyLookupFailed) {
        const phones = validRows.map((row) => row.phone).filter(Boolean);
        for (const chunk of chunkArray(phones, 500)) {
          const { data: existingByPhone } = await auth.supabaseAdmin
            .from("leads")
            .select("id,phone")
            .eq("crm_environment", auth.profile.crm_environment)
            .in("phone", chunk);

          (existingByPhone as ExistingLeadRow[] | null)?.forEach((lead) => {
            if (lead.phone) existingKeys.add(normalizePhoneKey(lead.phone));
          });
        }
      }
    }

    const importedRows = validRows.filter((row) => !existingKeys.has(row.dedupe_key) && !existingKeys.has(normalizeEmailKey(row.email)));
    const existingDuplicates = validRows.filter((row) => !importedRows.includes(row));
    let payloads = importedRows.map((row) => leadPayload(row, auth.profile.crm_environment, source));

    let inserted: Array<{ id: string }> = [];
    let importError: string | null = null;

    if (payloads.length > 0) {
      let insertResult = await insertLeadPayloads(auth.supabaseAdmin, payloads);

      if (insertResult.error?.includes("email") || insertResult.error?.includes("phone_key")) {
        payloads = payloads.map(stripV2LeadColumns);
        insertResult = await insertLeadPayloads(auth.supabaseAdmin, payloads);
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
        user_id: auth.profile.id,
        action_type: "import_comment",
        description: `Import: ${item.row.comment}`
      }));

    if (histories.length > 0) {
      await insertLeadHistories(auth.supabaseAdmin, histories);
    }

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

    await tryInsertBatchRows(auth.supabaseAdmin, batchId, batchRows).catch(() => undefined);

    const failedRows = normalized.failed.length + normalized.duplicates.length + existingDuplicates.length + (importError ? importedRows.length : 0);
    await tryFinishBatch(auth.supabaseAdmin, batchId, {
      processedRows: inserted.length,
      failedRows,
      status: importError ? "failed" : failedRows > 0 ? "completed_with_errors" : "completed",
      errorSummary: importError || undefined
    }).catch(() => undefined);

    if (importError) {
      return NextResponse.json({ error: importError, imported: inserted.length, failed: failedRows }, { status: 400 });
    }

    return NextResponse.json({
      imported: inserted.length,
      skippedExisting: existingDuplicates.length,
      skippedInFile: normalized.duplicates.length,
      failed: normalized.failed.length,
      batchId: batchId || null
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd importu." },
      { status: 500 }
    );
  }
}
