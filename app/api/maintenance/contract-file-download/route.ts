import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const CONTRACT_FILES_BUCKET = "contract-files";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeDispositionName(name: string) {
  return name.replace(/[\r\n"]/g, "_");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const fileId = url.searchParams.get("file_id") || "";
  if (!token || !fileId) return new Response("Brak tokenu lub pliku.", { status: 400 });

  if (url.searchParams.get("raw") !== "1") {
    const raw = new URL(url);
    raw.searchParams.set("raw", "1");
    return new Response(`<!doctype html><html><body><a href="${raw.toString()}">Pobierz plik</a></body></html>`, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const supabase = getServiceClient();
  const { data: validToken } = await supabase
    .from("maintenance_tokens")
    .select("token_hash")
    .eq("token_hash", sha256(token))
    .in("purpose", ["contract_file_bridge", "google_oauth_setup"])
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!validToken) return new Response("Link wygasł.", { status: 403 });

  const { data: file } = await supabase
    .from("contract_files")
    .select("id,contract_id,file_name,file_path,mime_type")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return new Response("Nie znaleziono pliku.", { status: 404 });

  const { data: contract } = await supabase
    .from("contracts")
    .select("id,crm_environment")
    .eq("id", file.contract_id)
    .maybeSingle();
  if (!contract || contract.crm_environment !== "production") {
    return new Response("Brak dostępu do pliku.", { status: 403 });
  }

  const download = await supabase.storage
    .from(CONTRACT_FILES_BUCKET)
    .download(file.file_path);
  if (download.error || !download.data) {
    return new Response(download.error?.message || "Nie udało się pobrać pliku.", { status: 500 });
  }

  return new Response(await download.data.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": file.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeDispositionName(file.file_name)}"`,
      "Cache-Control": "no-store"
    }
  });
}
