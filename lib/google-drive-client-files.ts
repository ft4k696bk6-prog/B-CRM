import { googleWorkspaceToken } from "@/lib/google-workspace";

const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveFileResult = {
  id: string;
  name: string;
  webViewLink?: string;
  folderId: string;
};

function driveParentId() {
  return process.env.GOOGLE_CLIENT_FILES_FOLDER_ID?.trim() || process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || "";
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
  const result = await driveJson<{ files?: Array<{ id: string; name: string; webViewLink?: string }> }>(
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
  return driveJson<{ id: string; name: string; webViewLink?: string }>(
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

async function ensureClientFolder(token: string, leadId: string, customerName: string) {
  const parentId = driveParentId();
  if (!parentId) {
    throw new Error("Brakuje GOOGLE_CLIENT_FILES_FOLDER_ID lub GOOGLE_DRIVE_FOLDER_ID dla załączników klientów.");
  }

  let clientsRoot = await findFolder(
    token,
    parentId,
    "appProperties has { key='bcrm_folder' and value='clients_root' }"
  );
  if (!clientsRoot) {
    clientsRoot = await createFolder(token, parentId, "Klienci CRM", { bcrm_folder: "clients_root" });
  }

  const safeLeadId = escapeDriveQuery(leadId);
  let clientFolder = await findFolder(
    token,
    clientsRoot.id,
    `appProperties has { key='bcrm_lead_id' and value='${safeLeadId}' }`
  );
  if (!clientFolder) {
    clientFolder = await createFolder(token, clientsRoot.id, customerName.trim() || "Klient", {
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
  fileName,
  mimeType,
  bytes
}: {
  leadId: string;
  contractId: string;
  customerName: string;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
}): Promise<DriveFileResult> {
  const token = await driveToken();
  const folder = await ensureClientFolder(token, leadId, customerName);
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
