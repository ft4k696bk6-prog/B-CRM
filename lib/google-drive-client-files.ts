import { googleWorkspaceToken } from "@/lib/google-workspace";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DEFAULT_CONTRACTS_ROOT_FOLDER_ID = "1N3x3PXTPRNNQPD4cr4DpjqJVCd7tl2OM";
const MONTHS_PL = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień"
];

type DriveFolder = {
  id: string;
  name: string;
  webViewLink?: string;
};

type DriveFileResult = {
  id: string;
  name: string;
  webViewLink?: string;
  folderId: string;
};

function driveContractsRootId() {
  return process.env.GOOGLE_CONTRACTS_FOLDER_ID?.trim() || DEFAULT_CONTRACTS_ROOT_FOLDER_ID;
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function driveToken() {
  const delegatedUser = process.env.GOOGLE_WORKSPACE_DELEGATED_USER?.trim();
  return googleWorkspaceToken(["https://www.googleapis.com/auth/drive"], delegatedUser || undefined);
}

async function driveJson<T>(token: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || `Google Drive HTTP ${response.status}`);
  return body;
}

async function findFolder(token: string, parentId: string, queryExtra: string) {
  const params = new URLSearchParams({
    pageSize: "10",
    fields: "files(id,name,webViewLink,appProperties)"
  });
  params.set(
    "q",
    `'${escapeDriveQuery(parentId)}' in parents and mimeType='${FOLDER_MIME}' and trashed=false and ${queryExtra}`
  );
  const result = await driveJson<{ files?: DriveFolder[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?${params}`
  );
  return result.files?.[0] || null;
}

async function createFolder(
  token: string,
  parentId: string,
  name: string,
  appProperties: Record<string, string>
) {
  return driveJson<DriveFolder>(
    token,
    "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        parents: [parentId],
        appProperties
      })
    }
  );
}

async function ensureNamedFolder(
  token: string,
  parentId: string,
  name: string,
  appProperties: Record<string, string>
) {
  const existing = await findFolder(token, parentId, `name='${escapeDriveQuery(name)}'`);
  return existing || createFolder(token, parentId, name, appProperties);
}

function periodForContract(signedAt?: string | null) {
  const simpleDate = signedAt?.match(/^(\d{4})-(\d{2})/);
  if (simpleDate) {
    const year = Number(simpleDate[1]);
    const monthIndex = Number(simpleDate[2]) - 1;
    if (year >= 2000 && monthIndex >= 0 && monthIndex < 12) {
      return { year: String(year), month: `${MONTHS_PL[monthIndex]} ${year}` };
    }
  }

  const parsed = signedAt ? new Date(signedAt) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const year = safeDate.getFullYear();
  return { year: String(year), month: `${MONTHS_PL[safeDate.getMonth()]} ${year}` };
}

async function ensureClientFolder(
  token: string,
  leadId: string,
  customerName: string,
  signedAt?: string | null
) {
  const rootId = driveContractsRootId();
  if (!rootId) throw new Error("Brakuje folderu docelowego dla umów.");

  const period = periodForContract(signedAt);
  const yearFolder = await ensureNamedFolder(token, rootId, period.year, {
    bcrm_folder: "contracts_year",
    bcrm_year: period.year
  });
  const monthFolder = await ensureNamedFolder(token, yearFolder.id, period.month, {
    bcrm_folder: "contracts_month",
    bcrm_month: period.month
  });

  const safeLeadId = escapeDriveQuery(leadId);
  let clientFolder = await findFolder(
    token,
    monthFolder.id,
    `appProperties has { key='bcrm_lead_id' and value='${safeLeadId}' }`
  );
  if (!clientFolder) {
    clientFolder = await createFolder(token, monthFolder.id, customerName.trim() || "Klient", {
      bcrm_folder: "client",
      bcrm_lead_id: leadId
    });
  }
  return clientFolder;
}

export async function uploadClientAttachmentToDrive({
  leadId,
  contractId,
  customerName,
  signedAt,
  fileName,
  mimeType,
  bytes
}: {
  leadId: string;
  contractId: string;
  customerName: string;
  signedAt?: string | null;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
}): Promise<DriveFileResult> {
  const token = await driveToken();
  const folder = await ensureClientFolder(token, leadId, customerName, signedAt);
  const boundary = `bcrm_${crypto.randomUUID().replace(/-/g, "")}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folder.id],
    appProperties: {
      bcrm_lead_id: leadId,
      bcrm_contract_id: contractId
    }
  });
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([prefix, Buffer.from(bytes), suffix]);

  const response = await driveJson<{ id: string; name: string; webViewLink?: string }>(
    token,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    }
  );

  return {
    id: response.id,
    name: response.name,
    webViewLink: response.webViewLink,
    folderId: folder.id
  };
}
