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
  return googleWorkspaceToken(
    ["https://www.googleapis.com/auth/drive"],
    delegatedUser || undefined,
    { requireStorageQuota: true }
  );
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
    fields: "files(id,name,webViewLink,appProperties)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true"
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

function normalizedFolderName(name: string) {
  return name.trim().toLocaleLowerCase("pl-PL");
}

async function findNamedFolder(token: string, parentId: string, name: string) {
  const params = new URLSearchParams({
    pageSize: "1000",
    fields: "files(id,name,webViewLink,appProperties)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true"
  });
  params.set(
    "q",
    `'${escapeDriveQuery(parentId)}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`
  );
  const result = await driveJson<{ files?: DriveFolder[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?${params}`
  );
  const expectedName = normalizedFolderName(name);
  return result.files?.find((folder) => normalizedFolderName(folder.name) === expectedName) || null;
}

async function createFolder(
  token: string,
  parentId: string,
  name: string,
  appProperties: Record<string, string>
) {
  return driveJson<DriveFolder>(
    token,
    "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true",
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
  const existing = await findNamedFolder(token, parentId, name);
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

async function uploadResumable(
  token: string,
  metadata: Record<string, unknown>,
  mimeType: string,
  bytes: ArrayBuffer
) {
  const createResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType || "application/octet-stream",
        "X-Upload-Content-Length": String(bytes.byteLength)
      },
      body: JSON.stringify(metadata),
      cache: "no-store"
    }
  );

  if (!createResponse.ok) {
    const body = (await createResponse.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message || `Google Drive HTTP ${createResponse.status}`);
  }

  const uploadUrl = createResponse.headers.get("location");
  if (!uploadUrl) throw new Error("Google Drive nie zwrócił adresu do przesłania pliku.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength)
    },
    body: Buffer.from(bytes),
    cache: "no-store"
  });

  const body = (await uploadResponse.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    webViewLink?: string;
    error?: { message?: string };
  };

  if (!uploadResponse.ok || !body.id || !body.name) {
    throw new Error(body.error?.message || `Google Drive HTTP ${uploadResponse.status}`);
  }

  return {
    id: body.id,
    name: body.name,
    webViewLink: body.webViewLink
  };
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
  const metadata = {
    name: fileName,
    parents: [folder.id],
    appProperties: {
      bcrm_lead_id: leadId,
      bcrm_contract_id: contractId
    }
  };

  const response = await uploadResumable(
    token,
    metadata,
    mimeType || "application/octet-stream",
    bytes
  );

  return {
    id: response.id,
    name: response.name,
    webViewLink: response.webViewLink,
    folderId: folder.id
  };
}
