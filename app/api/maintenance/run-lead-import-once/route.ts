import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { importGoogleSheetsLeads } from "@/lib/google-sheets-lead-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const EXPECTED_TOKEN_HASH = "0362e19a2d2d40b06e9452e110bd225dc7a23acd796294d4defd7945e28e30a0";

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
    const result = await importGoogleSheetsLeads();
    return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown lead import error" },
      { status: 500 }
    );
  }
}
