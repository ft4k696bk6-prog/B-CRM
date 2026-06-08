import { NextResponse } from "next/server";
import { metaLeadAdsSyncStatus, syncMetaLeadAds } from "@/lib/meta-lead-ads-sync";
import { getServiceClient } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secrets = [process.env.META_LEAD_ADS_SYNC_SECRET, process.env.CRON_SECRET].filter((secret): secret is string =>
    Boolean(secret?.trim())
  );
  if (secrets.length === 0) return process.env.NODE_ENV !== "production";

  const url = new URL(request.url);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret");
  return Boolean(token && secrets.includes(token));
}

async function run(request: Request) {
  try {
    const syncStatus = metaLeadAdsSyncStatus();

    if (!authorized(request)) {
      return NextResponse.json({ error: "Brak dostępu do synchronizacji Meta Lead Ads." }, { status: 401 });
    }

    if (!syncStatus.enabled) {
      return NextResponse.json({
        enabled: false,
        syncStatus,
        forms: [],
        totals: { imported: 0, skippedExisting: 0, skippedInFile: 0, failed: 0 }
      });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";
    const supabaseAdmin = getServiceClient();
    const result = await syncMetaLeadAds({ supabaseAdmin, crmEnvironment: "production", dryRun });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd synchronizacji Meta Lead Ads." },
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
