import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { uploadClientAttachmentToDrive } from "@/lib/google-drive-client-files";
import { getServiceClient } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const CONTRACT_FILES_BUCKET = "contract-files";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const contractId = url.searchParams.get("contract_id") || "";
  if (!token || !contractId) {
    return NextResponse.json({ error: "Brak tokenu lub umowy." }, { status: 400 });
  }

  const supabase = getServiceClient();
  const tokenHash = sha256(token);
  const { data: maintenanceToken } = await supabase
    .from("maintenance_tokens")
    .select("token_hash")
    .eq("token_hash", tokenHash)
    .eq("purpose", "google_drive_repair")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!maintenanceToken) {
    return NextResponse.json({ error: "Link naprawczy wygasł albo jest nieprawidłowy." }, { status: 403 });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id,lead_id,customer_name,signed_at")
    .eq("id", contractId)
    .eq("crm_environment", "production")
    .maybeSingle();
  if (!contract) {
    return NextResponse.json({ error: "Nie znaleziono umowy." }, { status: 404 });
  }

  const { data: files, error: filesError } = await supabase
    .from("contract_files")
    .select("id,file_name,file_path,mime_type,drive_file_id")
    .eq("contract_id", contractId)
    .is("drive_file_id", null);
  if (filesError) {
    return NextResponse.json({ error: filesError.message }, { status: 400 });
  }

  let synced = 0;
  const failed: string[] = [];
  for (const file of files || []) {
    try {
      const download = await supabase.storage
        .from(CONTRACT_FILES_BUCKET)
        .download(file.file_path);
      if (download.error || !download.data) {
        throw new Error(download.error?.message || "Nie udało się pobrać pliku z CRM.");
      }

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
      await supabase
        .from("contract_files")
        .update({ drive_sync_error: message })
        .eq("id", file.id);
    }
  }

  if (!failed.length) {
    await supabase.from("maintenance_tokens").delete().eq("token_hash", tokenHash);
  }

  return NextResponse.json(
    { contract: contract.customer_name, pending: (files || []).length, synced, failed },
    { status: failed.length ? 207 : 200 }
  );
}
