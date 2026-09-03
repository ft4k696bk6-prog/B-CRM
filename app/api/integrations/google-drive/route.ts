import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { googleWorkspaceToken } from "@/lib/google-workspace";

export async function GET(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  try {
    const token = await googleWorkspaceToken(["https://www.googleapis.com/auth/drive.readonly"]);
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
    const params = new URLSearchParams({ pageSize: "100", orderBy: "modifiedTime desc", fields: "files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)" });
    params.set("q", folderId ? `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false` : "trashed=false");
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json() as { files?: unknown[]; error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message || "Nie udało się pobrać plików Drive.");
    return NextResponse.json({ files: body.files || [], configuredFolder: Boolean(folderId) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Błąd Google Drive." }, { status: 503 }); }
}
