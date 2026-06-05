import { NextResponse } from "next/server";
import { syncGoogleDriveLeadFiles } from "@/lib/google-drive-lead-sync";
import { getServiceClient } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.GOOGLE_DRIVE_SYNC_SECRET || process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const url = new URL(request.url);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret");
  return token === secret;
}

async function run(request: Request) {
  try {
    if (process.env.GOOGLE_DRIVE_LEAD_SYNC_ENABLED !== "true") {
      return NextResponse.json({ enabled: false, files: [], totals: { imported: 0, skippedExisting: 0, skippedInFile: 0, failed: 0 } });
    }

    if (!authorized(request)) {
      return NextResponse.json({ error: "Brak dostępu do synchronizacji Google Drive." }, { status: 401 });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";
    const supabaseAdmin = getServiceClient();
    const result = await syncGoogleDriveLeadFiles({ supabaseAdmin, crmEnvironment: "production", dryRun });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd synchronizacji Google Drive." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
