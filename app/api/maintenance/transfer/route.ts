import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { uploadClientAttachmentToDrive } from "@/lib/google-drive-client-files";
import { googleWorkspaceToken } from "@/lib/google-workspace";
import { getServiceClient } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const KNOWLEDGE_BUCKET = "knowledge-assets";
const CONTRACT_BUCKET = "contract-files";
const DEFAULT_PH_MATERIALS_FOLDER_ID = "1WVX8mi_q9K8rQYjJrLO6kVjVlZsX4YxU";
const FOLDER_MIME = "application/vnd.google-apps.folder";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function authorize(token: string) {
  if (!token) return null;
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("maintenance_tokens")
    .select("token_hash,purpose,expires_at")
    .eq("token_hash", sha256(token))
    .eq("purpose", "knowledge_contract_transfer")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data ? supabase : null;
}

function boundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function safeSegment(value: string) {
  return value.replace(/[\\/]/g, "-").replace(/[\u0000-\u001f\u007f]/g, "").trim() || "bez-nazwy";
}

function safePath(value: string) {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => safeSegment(part))
    .filter(Boolean)
    .filter((part) => part !== "." && part !== "..")
    .join("/");
}

async function backfillContracts(
  supabase: ReturnType<typeof getServiceClient>,
  limit: number
) {
  const { data: files, error: filesError } = await supabase
    .from("contract_files")
    .select("id,contract_id,file_name,file_path,mime_type")
    .is("drive_file_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (filesError) throw new Error(filesError.message);

  const batch = files || [];
  const contractIds = [...new Set(batch.map((item) => item.contract_id).filter(Boolean))];
  const { data: contracts, error: contractsError } = contractIds.length
    ? await supabase.from("contracts").select("id,lead_id,signed_at").in("id", contractIds)
    : { data: [], error: null };
  if (contractsError) throw new Error(contractsError.message);

  const contractMap = new Map((contracts || []).map((item) => [item.id, item]));
  const leadIds = [...new Set((contracts || []).map((item) => item.lead_id).filter(Boolean))];
  const { data: leads, error: leadsError } = leadIds.length
    ? await supabase.from("leads").select("id,full_name").in("id", leadIds)
    : { data: [], error: null };
  if (leadsError) throw new Error(leadsError.message);
  const leadMap = new Map((leads || []).map((item) => [item.id, item]));

  let processed = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const file of batch) {
    try {
      const contract = contractMap.get(file.contract_id);
      if (!contract?.lead_id) throw new Error("Brak powiązanej umowy lub leada.");
      const lead = leadMap.get(contract.lead_id);
      if (!lead) throw new Error("Brak klienta powiązanego z umową.");

      const download = await supabase.storage.from(CONTRACT_BUCKET).download(file.file_path);
      if (download.error || !download.data) {
        throw new Error(download.error?.message || "Nie udało się pobrać pliku z CRM.");
      }

      const driveFile = await uploadClientAttachmentToDrive({
        leadId: contract.lead_id,
        contractId: file.contract_id,
        customerName: lead.full_name,
        signedAt: contract.signed_at,
        fileName: file.file_name,
        mimeType: file.mime_type || "application/octet-stream",
        bytes: await download.data.arrayBuffer()
      });

      const { error: updateError } = await supabase
        .from("contract_files")
        .update({
          drive_file_id: driveFile.id,
          drive_folder_id: driveFile.folderId,
          drive_web_view_link: driveFile.webViewLink || null,
          drive_sync_error: null,
          drive_synced_at: new Date().toISOString()
        })
        .eq("id", file.id);
      if (updateError) throw new Error(updateError.message);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nieznany błąd synchronizacji.";
      failures.push({ id: file.id, error: message });
      await supabase.from("contract_files").update({ drive_sync_error: message }).eq("id", file.id);
    }
  }

  const { count: remaining, error: countError } = await supabase
    .from("contract_files")
    .select("id", { count: "exact", head: true })
    .is("drive_file_id", null);
  if (countError) throw new Error(countError.message);

  return { processed, attempted: batch.length, failed: failures.length, failures, remaining: remaining || 0 };
}

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
};

type SourceFile = DriveItem & { sourcePath: string[] };

async function driveJson<T>(token: string, url: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || `Google Drive HTTP ${response.status}`);
  return body;
}

async function listDriveFolder(token: string, folderId: string) {
  const files: DriveItem[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      pageSize: "1000",
      orderBy: "name_natural",
      fields: "nextPageToken,files(id,name,mimeType,size)"
    });
    params.set("q", `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`);
    if (pageToken) params.set("pageToken", pageToken);
    const body = await driveJson<{ files?: DriveItem[]; nextPageToken?: string }>(
      token,
      `https://www.googleapis.com/drive/v3/files?${params}`
    );
    files.push(...(body.files || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return files;
}

async function collectDriveFiles(token: string, folderId: string, path: string[] = []): Promise<SourceFile[]> {
  const children = await listDriveFolder(token, folderId);
  const output: SourceFile[] = [];
  for (const item of children) {
    if (item.mimeType === FOLDER_MIME) {
      output.push(...(await collectDriveFiles(token, item.id, [...path, item.name])));
    } else {
      output.push({ ...item, sourcePath: [...path, item.name] });
    }
  }
  return output;
}

function isVisual(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType.startsWith("video/");
}

function knowledgeDestination(item: SourceFile) {
  const parts = item.sourcePath.map(safeSegment);
  const first = parts[0] || "Inne";
  const fileName = parts.at(-1) || safeSegment(item.name);
  const visual = isVisual(item.mimeType);

  if (first === "Realizacje") {
    const second = parts[1] || "";
    if (second === "Wszystkie realizacje") {
      const rest = parts.slice(2);
      if (visual) return safePath(["Galeria", ...(rest.length > 1 ? rest : ["Inne", fileName])].join("/"));
      return safePath(["Papiery", "Realizacje", ...rest].join("/"));
    }
    if (second === "Klienci") {
      const rest = parts.slice(2);
      return safePath([visual ? "Galeria" : "Papiery", visual ? "Klienci" : "Realizacje", ...rest].join("/"));
    }
    return safePath([visual ? "Galeria" : "Papiery", visual ? "Realizacje" : "Realizacje", ...parts.slice(1)].join("/"));
  }

  if (first === "Umowy / Papiery") {
    return safePath(["Papiery", "Umowy i papiery", ...parts.slice(1)].join("/"));
  }
  if (first === "Skrypty") {
    return safePath(["Papiery", "Skrypty", ...parts.slice(1)].join("/"));
  }
  if (first === "Karty katalogowe i prezentacje") {
    return safePath(["Papiery", "Karty katalogowe i prezentacje", ...parts.slice(1)].join("/"));
  }

  return safePath([visual ? "Galeria" : "Papiery", visual ? "Inne" : first, ...parts.slice(1)].join("/"));
}

async function driveFileBytes(token: string, item: SourceFile) {
  if (item.mimeType.startsWith("application/vnd.google-apps.")) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}/export?mimeType=${encodeURIComponent("application/pdf")}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!response.ok) throw new Error(`Nie udało się wyeksportować ${item.name} (${response.status}).`);
    return { bytes: await response.arrayBuffer(), contentType: "application/pdf", forcePdf: true };
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!response.ok) throw new Error(`Nie udało się pobrać ${item.name} (${response.status}).`);
  return {
    bytes: await response.arrayBuffer(),
    contentType: item.mimeType || response.headers.get("content-type") || "application/octet-stream",
    forcePdf: false
  };
}

async function backfillKnowledge(
  supabase: ReturnType<typeof getServiceClient>,
  skip: number,
  limit: number
) {
  const delegatedUser = process.env.GOOGLE_WORKSPACE_DELEGATED_USER?.trim();
  const token = await googleWorkspaceToken(
    ["https://www.googleapis.com/auth/drive.readonly"],
    delegatedUser || undefined
  );
  const rootId = process.env.GOOGLE_PH_MATERIALS_FOLDER_ID?.trim() || DEFAULT_PH_MATERIALS_FOLDER_ID;
  const allFiles = await collectDriveFiles(token, rootId);
  allFiles.sort((left, right) => left.sourcePath.join("/").localeCompare(right.sourcePath.join("/"), "pl", { numeric: true }));
  const batch = allFiles.slice(skip, skip + limit);

  let processed = 0;
  const failures: Array<{ id: string; name: string; error: string }> = [];
  for (const item of batch) {
    try {
      const file = await driveFileBytes(token, item);
      let destination = knowledgeDestination(item);
      if (file.forcePdf && !destination.toLowerCase().endsWith(".pdf")) destination += ".pdf";
      const { error } = await supabase.storage.from(KNOWLEDGE_BUCKET).upload(destination, file.bytes, {
        contentType: file.contentType,
        upsert: true
      });
      if (error) throw new Error(error.message);
      processed += 1;
    } catch (error) {
      failures.push({
        id: item.id,
        name: item.name,
        error: error instanceof Error ? error.message : "Nieznany błąd przenoszenia."
      });
    }
  }

  const nextSkip = Math.min(allFiles.length, skip + batch.length);
  return {
    total: allFiles.length,
    skip,
    attempted: batch.length,
    processed,
    failed: failures.length,
    failures,
    nextSkip,
    done: nextSkip >= allFiles.length
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const supabase = await authorize(token);
  if (!supabase) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });

  try {
    const job = url.searchParams.get("job") || "";
    if (job === "contracts") {
      const limit = boundedInt(url.searchParams.get("limit"), 10, 1, 20);
      return NextResponse.json(await backfillContracts(supabase, limit));
    }
    if (job === "knowledge") {
      const skip = boundedInt(url.searchParams.get("skip"), 0, 0, 100000);
      const limit = boundedInt(url.searchParams.get("limit"), 25, 1, 50);
      return NextResponse.json(await backfillKnowledge(supabase, skip, limit));
    }

    const id = url.searchParams.get("contract_file_id") || "";
    const { data: row, error } = await supabase
      .from("contract_files")
      .select("id,file_name,file_path,mime_type")
      .eq("id", id)
      .maybeSingle();
    if (error || !row) return NextResponse.json({ error: "Nie znaleziono pliku." }, { status: 404 });

    const download = await supabase.storage.from(CONTRACT_BUCKET).download(row.file_path);
    if (download.error || !download.data) {
      return NextResponse.json({ error: download.error?.message || "Nie udało się pobrać pliku." }, { status: 404 });
    }

    return new Response(await download.data.arrayBuffer(), {
      headers: {
        "Content-Type": row.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się wykonać migracji danych." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const supabase = await authorize(token);
  if (!supabase) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const path = safePath(String(form.get("path") || ""));
  if (!(file instanceof File) || !path || !(path.startsWith("Galeria/") || path.startsWith("Papiery/"))) {
    return NextResponse.json({ error: "Niepoprawny plik lub ścieżka." }, { status: 400 });
  }

  const { error } = await supabase.storage.from(KNOWLEDGE_BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type || "application/octet-stream",
    upsert: true
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ uploaded: path, size: file.size });
}
