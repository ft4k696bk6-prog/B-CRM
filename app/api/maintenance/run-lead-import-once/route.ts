import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { importGoogleSheetsLeadsPublic } from "@/lib/google-sheets-lead-import-public";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const EXPECTED_TOKEN_HASH = "afd5de12e487bce6c9648116c21cec8c972ca84afefa4854c15d78df003c0247";

function authorized(request: Request) {
  if (process.env.VERCEL_ENV !== "production") return false;
  const token = new URL(request.url).searchParams.get("token") || "";
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(EXPECTED_TOKEN_HASH, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await importGoogleSheetsLeadsPublic();
    return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown lead import error" },
      { status: 500 }
    );
  }
}
