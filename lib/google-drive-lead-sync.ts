import crypto from "crypto";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { RawLeadImportRow } from "@/lib/lead-import";
import { ingestRawLeadRows, type LeadIngestResult } from "@/lib/server-lead-ingest";
import type { CrmDataScope } from "@/lib/types";

const driveReadonlyScope = "https://www.googleapis.com/auth/drive.readonly";
const googleSpreadsheetMime = "application/vnd.google-apps.spreadsheet";
const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const csvMime = "text/csv";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  md5Checksum?: string;
};

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

type SyncInput = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any;
  crmEnvironment?: CrmDataScope | string;
  userId?: string | null;
  dryRun?: boolean;
};

type FileSyncResult = LeadIngestResult & {
  fileId: string;
  fileName: string;
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

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function readServiceAccountConfig(): { account: GoogleServiceAccount | null; error?: string } {
  const json = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json) as Partial<GoogleServiceAccount>;
      if (parsed.client_email && parsed.private_key) {
        return {
          account: {
            client_email: parsed.client_email,
            private_key: parsed.private_key.replace(/\\n/g, "\n")
          }
        };
      }
      return { account: null, error: "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON nie zawiera client_email/private_key." };
    } catch {
      return { account: null, error: "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON nie jest poprawnym JSON." };
    }
  }

  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return { account: clientEmail && privateKey ? { client_email: clientEmail, private_key: privateKey } : null };
}

function serviceAccountConfig(): GoogleServiceAccount | null {
  const config = readServiceAccountConfig();
  if (config.error) throw new Error(config.error);
  return config.account;
}

export function googleDriveLeadSyncStatus() {
  const flag = envFlag(process.env.GOOGLE_DRIVE_LEAD_SYNC_ENABLED);
  const serviceAccount = readServiceAccountConfig();
  const fileIds = csvList(process.env.GOOGLE_DRIVE_LEAD_FILE_IDS);
  const hasFolder = Boolean(process.env.GOOGLE_DRIVE_LEAD_FOLDER_ID?.trim());
  const hasTargets = fileIds.length > 0 || hasFolder;
  const missing: string[] = [];

  if (serviceAccount.error) missing.push("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccount.account) missing.push("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON albo GOOGLE_DRIVE_CLIENT_EMAIL/GOOGLE_DRIVE_PRIVATE_KEY");
  if (!hasTargets) missing.push("GOOGLE_DRIVE_LEAD_FILE_IDS albo GOOGLE_DRIVE_LEAD_FOLDER_ID");

  return {
    enabled: flag === "enabled" || (flag === "unset" && Boolean(serviceAccount.account) && hasTargets),
    flag,
    configured: {
      serviceAccount: Boolean(serviceAccount.account),
      leadTargets: hasTargets,
      fileIds: fileIds.length,
      folder: hasFolder
    },
    missing,
    error: serviceAccount.error
  };
}

async function googleAccessToken() {
  const account = serviceAccountConfig();
  if (!account) throw new Error("Brakuje konta serwisowego Google Drive.");

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: driveReadonlyScope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(account.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const body = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || "Nie udało się pobrać tokenu Google Drive.");
  }

  return body.access_token;
}

function driveHeaders(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

async function driveJson<T>(accessToken: string, url: URL) {
  const response = await fetch(url, { headers: driveHeaders(accessToken) });
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || "Błąd Google Drive.");
  return body;
}

async function driveBuffer(accessToken: string, url: URL) {
  const response = await fetch(url, { headers: driveHeaders(accessToken) });
  if (!response.ok) throw new Error(`Nie udało się pobrać pliku z Google Drive (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function fileMetadata(accessToken: string, fileId: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  url.searchParams.set("fields", "id,name,mimeType,modifiedTime,md5Checksum");
  url.searchParams.set("supportsAllDrives", "true");
  return driveJson<DriveFile>(accessToken, url);
}

async function listFolderFiles(accessToken: string, folderId: string) {
  const files: DriveFile[] = [];
  let pageToken = "";

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,modifiedTime,md5Checksum)");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const result = await driveJson<{ files?: DriveFile[]; nextPageToken?: string }>(accessToken, url);
    files.push(...(result.files || []));
    pageToken = result.nextPageToken || "";
  } while (pageToken);

  return files.filter(isSupportedLeadFile);
}

function isSupportedLeadFile(file: DriveFile) {
  const name = file.name.toLowerCase();
  return (
    file.mimeType === googleSpreadsheetMime ||
    file.mimeType === xlsxMime ||
    file.mimeType === csvMime ||
    name.endsWith(".xlsx") ||
    name.endsWith(".csv")
  );
}

async function configuredFiles(accessToken: string) {
  const byId = await Promise.all(csvList(process.env.GOOGLE_DRIVE_LEAD_FILE_IDS).map((id) => fileMetadata(accessToken, id)));
  const folderId = process.env.GOOGLE_DRIVE_LEAD_FOLDER_ID;
  const byFolder = folderId ? await listFolderFiles(accessToken, folderId) : [];
  const unique = new Map<string, DriveFile>();
  [...byId, ...byFolder].filter(isSupportedLeadFile).forEach((file) => unique.set(file.id, file));
  return Array.from(unique.values());
}

function cellText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  if (typeof value === "object" && "result" in value) return cellText(value.result);
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
}

function looksLikeHeader(cells: string[]) {
  const joined = cells.map(normalizeHeader).join(" ");
  const matches = ["telefon", "phone", "full name", "imie", "nazwisko", "email", "komentarz", "status", "lead status"].filter((item) =>
    joined.includes(item)
  );
  return matches.length >= 2;
}

function phoneCell(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}

function rowValues(row: ExcelJS.Row) {
  const values: string[] = [];
  row.eachCell({ includeEmpty: true }, (cell, index) => {
    values[index - 1] = cellText(cell.value);
  });
  return values;
}

function headerRowsToRaw(sheet: ExcelJS.Worksheet, file: DriveFile, header: string[], startRow: number) {
  const rows: RawLeadImportRow[] = [];
  for (let rowNumber = startRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values = rowValues(sheet.getRow(rowNumber));
    if (values.every((value) => !value)) continue;
    const raw: RawLeadImportRow = { source: `${file.name} / ${sheet.name}` };
    header.forEach((key, index) => {
      if (key && values[index]) raw[key] = values[index];
    });
    rows.push(raw);
  }
  return rows;
}

function noHeaderRowsToRaw(sheet: ExcelJS.Worksheet, file: DriveFile) {
  const rows: RawLeadImportRow[] = [];
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values = rowValues(sheet.getRow(rowNumber));
    const phoneIndex = values.findIndex((value) => phoneCell(value));
    if (phoneIndex < 0) continue;

    const nameIndex = phoneIndex >= 3 ? 2 : Math.max(phoneIndex - 1, 0);
    const afterPhone = values.slice(phoneIndex + 1).filter(Boolean);
    const productOrNote = afterPhone.slice(2, 5).join(" | ");
    const comment = [`Google Drive: ${file.name}, ${sheet.name}, wiersz ${rowNumber}`, productOrNote].filter(Boolean).join(" | ");

    rows.push({
      full_name: values[nameIndex] || `Klient ${values[phoneIndex]}`,
      phone: values[phoneIndex],
      email: values.find((value) => value.includes("@")) || "",
      created_at: values[0],
      address: afterPhone.slice(0, 2).join(", "),
      voivodeship: afterPhone.find((value) => /podkarpackie|lubelskie|mazowieckie|ma[lł]opolskie|[sś]wi[eę]tokrzyskie|[lł][oó]dzkie/i.test(value)) || "",
      source: `${file.name} / ${sheet.name}`,
      comment
    });
  }
  return rows;
}

async function parseWorkbookRows(file: DriveFile, buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const rows: RawLeadImportRow[] = [];

  workbook.worksheets.forEach((sheet) => {
    const firstRows = [1, 2, 3].map((rowNumber) => rowValues(sheet.getRow(rowNumber)));
    const headerIndex = firstRows.findIndex(looksLikeHeader);

    if (headerIndex >= 0) {
      const header = firstRows[headerIndex];
      rows.push(...headerRowsToRaw(sheet, file, header, headerIndex + 2));
    } else {
      rows.push(...noHeaderRowsToRaw(sheet, file));
    }
  });

  return rows;
}

function parseCsvRows(file: DriveFile, content: string) {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: "greedy"
  });

  return result.data.map((row) => ({
    ...row,
    source: row.source || `${file.name} / Google Drive`
  }));
}

async function rowsFromDriveFile(accessToken: string, file: DriveFile) {
  if (file.mimeType === googleSpreadsheetMime) {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${file.id}/export`);
    url.searchParams.set("mimeType", xlsxMime);
    const buffer = await driveBuffer(accessToken, url);
    return parseWorkbookRows(file, buffer);
  }

  const downloadUrl = new URL(`https://www.googleapis.com/drive/v3/files/${file.id}`);
  downloadUrl.searchParams.set("alt", "media");
  downloadUrl.searchParams.set("supportsAllDrives", "true");
  const buffer = await driveBuffer(accessToken, downloadUrl);

  if (file.mimeType === csvMime || file.name.toLowerCase().endsWith(".csv")) {
    return parseCsvRows(file, buffer.toString("utf8"));
  }

  return parseWorkbookRows(file, buffer);
}

export async function syncGoogleDriveLeadFiles(input: SyncInput) {
  const status = googleDriveLeadSyncStatus();

  if (!status.enabled) {
    return { enabled: false, syncStatus: status, files: [], totals: { imported: 0, skippedExisting: 0, skippedInFile: 0, failed: 0 } };
  }

  const accessToken = await googleAccessToken();
  const files = await configuredFiles(accessToken);
  const results: FileSyncResult[] = [];

  for (const file of files) {
    const rows = await rowsFromDriveFile(accessToken, file);
    const result = await ingestRawLeadRows({
      supabaseAdmin: input.supabaseAdmin,
      rows,
      source: `Google Drive: ${file.name}`,
      fileName: file.name,
      userId: input.userId || null,
      crmEnvironment: input.crmEnvironment || "production",
      dryRun: input.dryRun
    });

    results.push({
      ...result,
      fileId: file.id,
      fileName: file.name,
      sourceRows: rows.length
    });
  }

  return {
    enabled: true,
    syncStatus: status,
    files: results,
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
