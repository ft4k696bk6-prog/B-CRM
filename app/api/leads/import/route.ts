import { NextResponse } from "next/server";
import type { RawLeadImportRow } from "@/lib/lead-import";
import { canManageLeads } from "@/lib/roles";
import { checkServerRateLimit, isRequestBodyError, rateLimitResponse, readJsonBody } from "@/lib/request-security";
import { ingestRawLeadRows } from "@/lib/server-lead-ingest";
import { requireApiProfile } from "@/lib/server-auth";

type ImportBody = {
  rows?: RawLeadImportRow[];
  source?: string;
  fileName?: string;
  dryRun?: boolean;
};

function safeText(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if (auth.error) return auth.error;

    if (!canManageLeads(auth.profile.role)) {
      return NextResponse.json({ error: "Tylko właściciel, administrator albo kierownik może importować leady." }, { status: 403 });
    }

    if (!checkServerRateLimit(`lead-import:${auth.profile.id}`, 50, 15 * 60 * 1000)) {
      return rateLimitResponse("Za dużo prób importu. Odczekaj chwilę przed kolejnym plikiem.");
    }

    const body = await readJsonBody<ImportBody>(request, 4 * 1024 * 1024);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const source = safeText(body.source, 120) || "Import";
    const fileName = safeText(body.fileName, 220);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Brakuje wierszy do importu." }, { status: 400 });
    }

    if (rows.length > 10000) {
      return NextResponse.json({ error: "Jednorazowy import ma limit 10000 wierszy." }, { status: 400 });
    }

    const result = await ingestRawLeadRows({
      supabaseAdmin: auth.supabaseAdmin,
      rows,
      source,
      fileName,
      dryRun: body.dryRun,
      userId: auth.profile.id,
      crmEnvironment: auth.profile.crm_environment
    });

    if (result.error) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd importu." },
      { status: 500 }
    );
  }
}
