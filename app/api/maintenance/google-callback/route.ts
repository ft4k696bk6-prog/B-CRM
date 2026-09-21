import { createHash } from "node:crypto";
import { uploadClientAttachmentToDrive } from "@/lib/google-drive-client-files";
import { getServiceClient } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const CONTRACT_FILES_BUCKET = "contract-files";

const CALLBACK_URL = "https://b-crm-berni.vercel.app/api/maintenance/google-callback";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function html(body: string, status = 200) {
  return new Response(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google połączony</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0b0b0b;color:#fff;max-width:720px;margin:0 auto;padding:32px}h1{font-size:30px}p{color:#c8c8c8;line-height:1.5}.box{border:1px solid #2b2b2b;border-radius:14px;padding:22px;background:#111}</style></head><body>${body}</body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const oauthError = url.searchParams.get("error") || "";
  if (oauthError) return html(`<h1>Google nie udzielił dostępu</h1><p>${oauthError}</p>`, 400);
  if (!code || !state) return html("<h1>Brakuje kodu autoryzacji.</h1>", 400);

  const supabase = getServiceClient();
  const { data: config, error: configError } = await supabase
    .from("google_oauth_config")
    .select("client_id,client_secret,state_hash,state_expires_at")
    .eq("id", "default")
    .maybeSingle();
  if (configError || !config?.client_id || !config?.client_secret) return html("<h1>Brakuje konfiguracji OAuth.</h1>", 500);
  if (config.state_hash !== sha256(state) || !config.state_expires_at || new Date(config.state_expires_at).getTime() < Date.now()) {
    return html("<h1>Sesja autoryzacji wygasła albo jest nieprawidłowa.</h1>", 403);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: CALLBACK_URL
    }),
    cache: "no-store"
  });
  const body = (await response.json().catch(() => ({}))) as { refresh_token?: string; access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !body.refresh_token) {
    return html(`<h1>Google nie zwrócił refresh tokena.</h1><p>${body.error_description || body.error || "Nieznany błąd OAuth"}</p>`, 500);
  }

  const { error: saveError } = await supabase.from("google_oauth_config").update({
    refresh_token: body.refresh_token,
    state_hash: null,
    state_expires_at: null,
    updated_at: new Date().toISOString()
  }).eq("id", "default");
  if (saveError) return html(`<h1>Nie udało się zapisać tokena.</h1><p>${saveError.message}</p>`, 500);

  const { data: pendingFiles } = await supabase
    .from("contract_files")
    .select("id,contract_id,file_name,file_path,mime_type")
    .is("drive_file_id", null);

  let synced = 0;
  const failed: string[] = [];
  for (const file of pendingFiles || []) {
    try {
      const { data: contract } = await supabase
        .from("contracts")
        .select("id,lead_id,customer_name,signed_at,crm_environment")
        .eq("id", file.contract_id)
        .maybeSingle();
      if (!contract || contract.crm_environment !== "production") continue;

      const download = await supabase.storage
        .from(CONTRACT_FILES_BUCKET)
        .download(file.file_path);
      if (download.error || !download.data) throw new Error(download.error?.message || "Nie udało się pobrać pliku z CRM.");

      const driveFile = await uploadClientAttachmentToDrive({
        leadId: contract.lead_id,
        contractId: contract.id,
        customerName: contract.customer_name,
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
      if (updateError) throw updateError;
      synced += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Błąd synchronizacji.";
      failed.push(`${file.file_name}: ${message}`);
      await supabase.from("contract_files").update({ drive_sync_error: message }).eq("id", file.id);
    }
  }

  const repairText = failed.length
    ? `Ponowiono synchronizację. Zapisano na Drive: ${synced}. Nadal z błędem: ${failed.length}.`
    : `Automatycznie dosłano na Drive ${synced} oczekujących plików.`;

  return html(`<div class="box"><h1>Google Drive połączony z B-CRM</h1><p>${repairText}</p><p>Możesz zamknąć tę kartę.</p></div>`);
}
