import { NextResponse } from "next/server";
import { canViewContractForRole } from "@/lib/contracts";
import { uploadClientAttachmentToDrive } from "@/lib/google-drive-client-files";
import { requireApiProfile } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const CONTRACT_FILES_BUCKET = "contract-files";

async function ensureContractFilesBucket(
  storage: ReturnType<typeof import("@/lib/server-auth").getServiceClient>["storage"]
) {
  const { data: existing } = await storage.getBucket(CONTRACT_FILES_BUCKET);
  if (existing) return null;

  const { error } = await storage.createBucket(CONTRACT_FILES_BUCKET, {
    public: false,
    allowedMimeTypes: ["application/pdf", "image/*", "video/*"]
  });
  if (error && !/already exists|duplicate/i.test(error.message)) return error.message;
  return null;
}

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  const path = new URL(request.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Brak pliku." }, { status: 400 });
  if (!path.startsWith(`${auth.profile.crm_environment}/`)) {
    return NextResponse.json({ error: "Brak dostępu do pliku." }, { status: 403 });
  }

  const { data: file } = await auth.supabaseAdmin
    .from("contract_files")
    .select(
      "contract:contracts!inner(created_by,crm_environment,submission_status,creator:profiles!contracts_created_by_fkey(manager_id))"
    )
    .eq("file_path", path)
    .maybeSingle();

  const rawContract = file?.contract;
  const contract = Array.isArray(rawContract) ? rawContract[0] : rawContract;
  const rawCreator = contract?.creator;
  const creator = Array.isArray(rawCreator) ? rawCreator[0] : rawCreator;
  const allowed = Boolean(
    contract &&
      contract.crm_environment === auth.profile.crm_environment &&
      canViewContractForRole({
        role: auth.profile.role,
        profileId: auth.profile.id,
        createdBy: contract.created_by,
        creatorManagerId: creator?.manager_id || null,
        submissionStatus: contract.submission_status === "draft" ? "draft" : "submitted"
      })
  );

  if (!allowed) {
    return NextResponse.json({ error: "Brak dostępu do pliku." }, { status: 403 });
  }

  const bucketError = await ensureContractFilesBucket(auth.supabaseAdmin.storage);
  if (bucketError) {
    return NextResponse.json(
      { error: `Nie udało się przygotować magazynu plików: ${bucketError}` },
      { status: 500 }
    );
  }

  const { data, error } = await auth.supabaseAdmin.storage
    .from(CONTRACT_FILES_BUCKET)
    .createSignedUrl(path, 300);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ url: data.signedUrl });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action || "");
  const leadId = String(body.lead_id || "");
  const contractId = String(body.contract_id || "");
  const kind = String(body.kind || "");
  const fileName = String(body.file_name || "");
  const mime = String(body.mime || "application/octet-stream");
  const size = Number(body.size || 0);
  if (!leadId || !contractId || !fileName || !["contract_pdf", "photo", "video"].includes(kind)) {
    return NextResponse.json({ error: "Niepoprawny plik." }, { status: 400 });
  }
  const limits: Record<string, number> = { contract_pdf: 25, photo: 15, video: 50 };
  if (!Number.isFinite(size) || size <= 0 || size > limits[kind] * 1024 * 1024) {
    return NextResponse.json(
      { error: `Plik przekracza limit ${limits[kind]} MB albo jest pusty.` },
      { status: 400 }
    );
  }
  if (kind === "contract_pdf" && mime !== "application/pdf") {
    return NextResponse.json({ error: "Umowa musi być plikiem PDF." }, { status: 400 });
  }
  if (kind === "photo" && !mime.startsWith("image/")) {
    return NextResponse.json({ error: "Wybierz zdjęcie." }, { status: 400 });
  }
  if (kind === "video" && !mime.startsWith("video/")) {
    return NextResponse.json({ error: "Wybierz plik wideo." }, { status: 400 });
  }

  const [{ data: lead }, { data: contract }] = await Promise.all([
    auth.supabaseAdmin
      .from("leads")
      .select("id,full_name")
      .eq("id", leadId)
      .eq("crm_environment", auth.profile.crm_environment)
      .single(),
    auth.supabaseAdmin
      .from("contracts")
      .select(
        "id,lead_id,created_by,process_status,submission_status,creator:profiles!contracts_created_by_fkey(manager_id)"
      )
      .eq("id", contractId)
      .eq("lead_id", leadId)
      .eq("crm_environment", auth.profile.crm_environment)
      .maybeSingle()
  ]);

  if (!lead) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });
  if (!contract) return NextResponse.json({ error: "Nie znaleziono umowy." }, { status: 404 });

  const creator = Array.isArray(contract.creator) ? contract.creator[0] : contract.creator;
  const allowed =
    ["owner", "admin"].includes(auth.profile.role) ||
    (contract.created_by === auth.profile.id && contract.submission_status === "draft") ||
    (auth.profile.role === "menadzer" &&
      creator?.manager_id === auth.profile.id &&
      contract.submission_status !== "draft");
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          contract.created_by === auth.profile.id
            ? "Po wysłaniu kompletu nie można już dodawać załączników."
            : "Brak dostępu do tej umowy."
      },
      { status: 403 }
    );
  }

  const bucketError = await ensureContractFilesBucket(auth.supabaseAdmin.storage);
  if (bucketError) {
    return NextResponse.json(
      { error: `Nie udało się utworzyć miejsca na załączniki: ${bucketError}` },
      { status: 500 }
    );
  }

  const prefix = `${auth.profile.crm_environment}/${leadId}/`;
  if (action === "prepare") {
    const path = `${prefix}${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data, error } = await auth.supabaseAdmin.storage
      .from(CONTRACT_FILES_BUCKET)
      .createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ path, token: data.token });
  }

  if (action !== "finalize") {
    return NextResponse.json({ error: "Niepoprawna operacja przesyłania." }, { status: 400 });
  }

  const path = String(body.path || "");
  if (!path.startsWith(prefix)) {
    return NextResponse.json({ error: "Niepoprawna ścieżka pliku." }, { status: 400 });
  }

  const record: Record<string, unknown> = {
    id: crypto.randomUUID(),
    name: fileName,
    kind,
    path,
    mime,
    size,
    created_at: new Date().toISOString()
  };
  const fileResult = await auth.supabaseAdmin.from("contract_files").insert({
    id: record.id,
    contract_id: contractId,
    uploaded_by: auth.profile.id,
    kind,
    file_name: fileName,
    file_path: path,
    mime_type: mime,
    file_size: size
  });
  if (fileResult.error) {
    await auth.supabaseAdmin.storage.from(CONTRACT_FILES_BUCKET).remove([path]);
    return NextResponse.json(
      { error: "Nie udało się zapisać informacji o załączniku." },
      { status: 400 }
    );
  }

  let driveWarning = "";
  try {
    const download = await auth.supabaseAdmin.storage.from(CONTRACT_FILES_BUCKET).download(path);
    if (download.error || !download.data) {
      throw new Error(download.error?.message || "Nie udało się odczytać pliku po wysłaniu.");
    }
    const driveFile = await uploadClientAttachmentToDrive({
      leadId,
      contractId,
      customerName: lead.full_name,
      fileName,
      mimeType: mime,
      bytes: await download.data.arrayBuffer()
    });
    const driveSyncedAt = new Date().toISOString();
    const drivePatch = {
      drive_file_id: driveFile.id,
      drive_folder_id: driveFile.folderId,
      drive_web_view_link: driveFile.webViewLink || null,
      drive_sync_error: null,
      drive_synced_at: driveSyncedAt
    };
    const { error: driveDbError } = await auth.supabaseAdmin
      .from("contract_files")
      .update(drivePatch)
      .eq("id", String(record.id));
    if (driveDbError) throw new Error(`Plik jest na Drive, ale CRM nie zapisał linku: ${driveDbError.message}`);
    Object.assign(record, drivePatch);
  } catch (error) {
    driveWarning = error instanceof Error ? error.message : "Nie udało się zsynchronizować pliku z Google Drive.";
    await auth.supabaseAdmin
      .from("contract_files")
      .update({ drive_sync_error: driveWarning })
      .eq("id", String(record.id));
  }

  await auth.supabaseAdmin.from("lead_history").insert({
    lead_id: leadId,
    user_id: auth.profile.id,
    action_type: "contract_file",
    description: driveWarning
      ? `Dodano załącznik: ${fileName}. Synchronizacja Google Drive wymaga ponowienia.`
      : `Dodano załącznik: ${fileName}. Zapisano również na Google Drive.`,
    new_value: record
  });

  return NextResponse.json({
    file: record,
    driveSynced: !driveWarning,
    ...(driveWarning ? { driveWarning } : {})
  });
}
