import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const KNOWLEDGE_BUCKET = "knowledge-assets";
const CONTRACT_BUCKET = "contract-files";

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

function safePath(value: string) {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== "." && part !== "..")
    .join("/");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const supabase = await authorize(token);
  if (!supabase) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });

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
