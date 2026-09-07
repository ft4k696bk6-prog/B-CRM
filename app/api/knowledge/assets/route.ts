import { NextResponse } from "next/server";
import { isSystemAdminRole } from "@/lib/roles";
import { requireApiProfile } from "@/lib/server-auth";

export const runtime = "nodejs";

const BUCKET = "knowledge-assets";
const MAX_NAME_LENGTH = 180;

function normalizePath(value: unknown) {
  if (typeof value !== "string") return "";
  const parts = value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) throw new Error("Niepoprawna ścieżka.");
  return parts.join("/");
}

function safeFileName(value: unknown) {
  if (typeof value !== "string") return "";
  const name = value
    .replace(/[\\/]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  if (!name || name === "." || name === "..") return "";
  return name;
}

function objectPath(folder: string, fileName: string) {
  return folder ? `${folder}/${fileName}` : fileName;
}

async function requireKnowledgeAdmin(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth;
  if (!isSystemAdminRole(auth.profile.role)) {
    return { error: NextResponse.json({ error: "Tylko właściciel lub admin może zmieniać pliki Skarbnicy." }, { status: 403 }) };
  }
  return auth;
}

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const filePath = normalizePath(url.searchParams.get("file"));

    if (filePath) {
      const download = url.searchParams.get("download") === "1";
      const { data, error } = await auth.supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 60 * 60, download ? { download: filePath.split("/").pop() || true } : undefined);
      if (error || !data?.signedUrl) {
        return NextResponse.json({ error: error?.message || "Nie udało się otworzyć pliku." }, { status: 404 });
      }
      return NextResponse.json({ url: data.signedUrl });
    }

    const folder = normalizePath(url.searchParams.get("path"));
    const { data, error } = await auth.supabaseAdmin.storage.from(BUCKET).list(folder || undefined, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || [])
      .filter((item) => item.name !== ".emptyFolderPlaceholder")
      .map((item) => {
        const isFolder = !item.id || !item.metadata;
        return {
          id: item.id || null,
          name: item.name,
          path: objectPath(folder, item.name),
          isFolder,
          mimeType: isFolder ? null : String(item.metadata?.mimetype || item.metadata?.contentType || "application/octet-stream"),
          size: isFolder ? null : Number(item.metadata?.size || 0),
          updatedAt: item.updated_at || item.created_at || null
        };
      })
      .sort((left, right) => {
        if (left.isFolder !== right.isFolder) return left.isFolder ? -1 : 1;
        return left.name.localeCompare(right.name, "pl", { numeric: true });
      });

    return NextResponse.json({ bucket: BUCKET, path: folder, items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Błąd Skarbnicy wiedzy." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const auth = await requireKnowledgeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    if (action !== "create_upload") {
      return NextResponse.json({ error: "Nieznana akcja." }, { status: 400 });
    }

    const folder = normalizePath(body.folderPath);
    const relativeFolder = normalizePath(body.relativeFolder);
    const fileName = safeFileName(body.fileName);
    if (!fileName) return NextResponse.json({ error: "Niepoprawna nazwa pliku." }, { status: 400 });

    const finalFolder = [folder, relativeFolder].filter(Boolean).join("/");
    const path = objectPath(finalFolder, fileName);
    const { data, error } = await auth.supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error || !data?.token) {
      return NextResponse.json({ error: error?.message || "Nie udało się przygotować wysyłki." }, { status: 400 });
    }

    return NextResponse.json({ bucket: BUCKET, path, token: data.token });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nie udało się przygotować wysyłki." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireKnowledgeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const path = normalizePath(body.path);
    if (!path) return NextResponse.json({ error: "Wybierz plik do usunięcia." }, { status: 400 });
    const { error } = await auth.supabaseAdmin.storage.from(BUCKET).remove([path]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ deleted: path });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nie udało się usunąć pliku." }, { status: 400 });
  }
}
