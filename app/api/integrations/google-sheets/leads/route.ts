import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { importGoogleSheetsLeadsPublic } from "@/lib/google-sheets-lead-import-public";
import { requireApiProfile } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const SUPABASE_SYNC_TOKEN_HASH = "04d1f23f962590d289464e86ba8a6ce79386d16b6cf60bd93f8fda83a52a61b3";

function hasImportSecret(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : "";
  const importSecret = process.env.GOOGLE_SHEETS_IMPORT_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(token && (token === importSecret || token === cronSecret));
}

function hasSupabaseSyncSecret(request: Request) {
  const token = request.headers.get("x-bcrm-sync-token")?.trim() || "";
  if (!token) return false;

  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(SUPABASE_SYNC_TOKEN_HASH, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isVercelCron(request: Request) {
  return request.headers.get("x-vercel-cron-schedule") === "0 6 * * *";
}

async function runImport(request: Request) {
  if (!hasImportSecret(request) && !hasSupabaseSyncSecret(request) && !isVercelCron(request)) {
    const auth = await requireApiProfile(request);
    if ("error" in auth) return auth.error;
    if (!["owner", "admin"].includes(auth.profile.role)) {
      return NextResponse.json({ error: "Tylko administrator może synchronizować bazę leadów." }, { status: 403 });
    }
  }

  try {
    const result = await importGoogleSheetsLeadsPublic();
    return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 200 });
  } catch (error) {
    console.error("Google Sheets lead import failed", error);
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
