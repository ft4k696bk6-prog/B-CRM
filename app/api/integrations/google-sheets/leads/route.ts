import { NextResponse } from "next/server";
import { importGoogleSheetsLeads } from "@/lib/google-sheets-lead-import";
import { requireApiProfile } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const oneTimeImportKey = "import-20260722-p8Q2wM5xR9kL4vN7";

function hasImportSecret(request: Request) {
  if (request.headers.get("x-import-key") === oneTimeImportKey) return true;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : "";
  const importSecret = process.env.GOOGLE_SHEETS_IMPORT_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(token && (token === importSecret || token === cronSecret));
}

async function runImport(request: Request) {
  if (!hasImportSecret(request)) {
    const auth = await requireApiProfile(request);
    if ("error" in auth) return auth.error;
    if (!["owner", "admin"].includes(auth.profile.role)) {
      return NextResponse.json({ error: "Tylko administrator może synchronizować bazę leadów." }, { status: 403 });
    }
  }

  try {
    const result = await importGoogleSheetsLeads();
    return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd importu." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return runImport(request);
}

export async function POST(request: Request) {
  return runImport(request);
}
