import { NextResponse } from "next/server";
import { importGoogleSheetsLeads } from "@/lib/google-sheets-lead-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function hasAccess(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : "";
  const importSecret = process.env.GOOGLE_SHEETS_IMPORT_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(token && (token === importSecret || token === cronSecret));
}

async function runImport(request: Request) {
  if (!hasAccess(request)) {
    return NextResponse.json({ error: "Brak dostępu do importu." }, { status: 401 });
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
