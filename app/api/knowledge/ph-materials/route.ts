import { NextResponse } from "next/server";
import { googleWorkspaceToken } from "@/lib/google-workspace";
import { requireApiProfile } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_PH_MATERIALS_FOLDER_ID = "1WVX8mi_q9K8rQYjJrLO6kVjVlZsX4YxU";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_DOCUMENT_MIMES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.drawing"
]);

function rootFolderId() {
  return process.env.GOOGLE_PH_MATERIALS_FOLDER_ID?.trim() || DEFAULT_PH_MATERIALS_FOLDER_ID;
}

async function phDriveToken() {
  const delegatedUser = process.env.GOOGLE_WORKSPACE_DELEGATED_USER?.trim();
  return googleWorkspaceToken(
    ["https://www.googleapis.com/auth/drive.readonly"],
    delegatedUser || undefined
  );
}

async function driveFetch(token: string, url: string) {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
}

async function itemMeta(token: string, id: string) {
  const response = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,parents,size,modifiedTime`
  );
  if (!response.ok) return null;
  return response.json() as Promise<{
    id: string;
    name: string;
    mimeType: string;
    parents?: string[];
    size?: string;
    modifiedTime?: string;
  }>;
}

async function isWithinRoot(token: string, itemId: string, rootId: string) {
  if (itemId === rootId) return true;
  const queue = [itemId];
  const seen = new Set<string>();
  let steps = 0;

  while (queue.length && steps < 40) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    steps += 1;
    const meta = await itemMeta(token, current);
    if (!meta) return false;
    for (const parent of meta.parents || []) {
      if (parent === rootId) return true;
      if (!seen.has(parent)) queue.push(parent);
    }
  }
  return false;
}

function inlineName(name: string, pdf = false) {
  const finalName = pdf && !name.toLowerCase().endsWith(".pdf") ? `${name}.pdf` : name;
  return `inline; filename*=UTF-8''${encodeURIComponent(finalName)}`;
}

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  try {
    const token = await phDriveToken();
    const rootId = rootFolderId();
    const url = new URL(request.url);
    const fileId = url.searchParams.get("file_id")?.trim() || "";

    if (fileId) {
      if (!(await isWithinRoot(token, fileId, rootId))) {
        return NextResponse.json({ error: "Plik nie należy do Skarbnicy wiedzy." }, { status: 403 });
      }
      const meta = await itemMeta(token, fileId);
      if (!meta || meta.mimeType === FOLDER_MIME) {
        return NextResponse.json({ error: "Nie znaleziono pliku." }, { status: 404 });
      }

      const isGoogleDocument = GOOGLE_DOCUMENT_MIMES.has(meta.mimeType);
      const size = Number(meta.size || 0);
      if (!isGoogleDocument && Number.isFinite(size) && size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Plik jest zbyt duży do otwarcia bezpośrednio w CRM." },
          { status: 413 }
        );
      }

      const mediaUrl = isGoogleDocument
        ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent("application/pdf")}`
        : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
      const media = await driveFetch(token, mediaUrl);
      if (!media.ok) {
        return NextResponse.json({ error: "Nie udało się otworzyć pliku w CRM." }, { status: 502 });
      }

      const buffer = await media.arrayBuffer();
      return new Response(buffer, {
        headers: {
          "Content-Type": isGoogleDocument
            ? "application/pdf"
            : meta.mimeType || media.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition": inlineName(meta.name, isGoogleDocument),
          "Cache-Control": "private, max-age=300"
        }
      });
    }

    const folderId = url.searchParams.get("folder_id")?.trim() || rootId;
    if (!(await isWithinRoot(token, folderId, rootId))) {
      return NextResponse.json({ error: "Folder nie należy do Skarbnicy wiedzy." }, { status: 403 });
    }

    const current = await itemMeta(token, folderId);
    if (!current || current.mimeType !== FOLDER_MIME) {
      return NextResponse.json({ error: "Nie znaleziono folderu." }, { status: 404 });
    }

    const params = new URLSearchParams({
      pageSize: "1000",
      orderBy: "name_natural",
      fields: "files(id,name,mimeType,modifiedTime,size,parents)"
    });
    params.set("q", `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`);
    const response = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?${params}`);
    const body = (await response.json()) as {
      files?: Array<{
        id: string;
        name: string;
        mimeType: string;
        modifiedTime?: string;
        size?: string;
        parents?: string[];
      }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(body.error?.message || "Nie udało się pobrać materiałów.");
    }

    const items = (body.files || []).sort((left, right) => {
      const leftFolder = left.mimeType === FOLDER_MIME;
      const rightFolder = right.mimeType === FOLDER_MIME;
      if (leftFolder !== rightFolder) return leftFolder ? -1 : 1;
      return left.name.localeCompare(right.name, "pl", { numeric: true });
    });

    return NextResponse.json({
      rootId,
      folder: { id: current.id, name: current.name, parents: current.parents || [] },
      items
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Błąd Skarbnicy wiedzy." },
      { status: 503 }
    );
  }
}
