import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { GET as transferGet } from "../transfer/route";
import { getServiceClient } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function aggregateFailureErrors(value: unknown) {
  if (!Array.isArray(value)) return [];
  const counts = new Map<string, number>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const error = (item as { error?: unknown }).error;
    if (typeof error !== "string" || !error.trim()) continue;
    const message = error.trim();
    counts.set(message, (counts.get(message) || 0) + 1);
  }
  return [...counts.entries()].map(([error, count]) => ({ error, count }));
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const sourceUrl = new URL(request.url);
  const job = sourceUrl.searchParams.get("job") || "";
  if (job !== "contracts" && job !== "knowledge") {
    return NextResponse.json({ error: "Niepoprawne zadanie." }, { status: 400 });
  }

  const supabase = getServiceClient();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  const { error: tokenError } = await supabase.from("maintenance_tokens").insert({
    token_hash: tokenHash,
    purpose: "knowledge_contract_transfer",
    expires_at: expiresAt,
    created_at: now.toISOString()
  });
  if (tokenError) {
    return NextResponse.json({ error: "Nie udało się uruchomić migracji." }, { status: 500 });
  }

  try {
    const target = new URL("/api/maintenance/transfer", sourceUrl.origin);
    target.searchParams.set("token", token);
    target.searchParams.set("job", job);
    if (job === "contracts") {
      target.searchParams.set("limit", sourceUrl.searchParams.get("limit") || "10");
    } else {
      target.searchParams.set("skip", sourceUrl.searchParams.get("skip") || "0");
      target.searchParams.set("limit", sourceUrl.searchParams.get("limit") || "25");
    }

    const response = await transferGet(new Request(target, { method: "GET" }));
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return NextResponse.json({ error: typeof body.error === "string" ? body.error : "Migracja nie powiodła się." }, { status: response.status });
    }

    return NextResponse.json({
      job,
      attempted: numberOrNull(body.attempted),
      processed: numberOrNull(body.processed),
      failed: numberOrNull(body.failed),
      remaining: numberOrNull(body.remaining),
      total: numberOrNull(body.total),
      nextSkip: numberOrNull(body.nextSkip),
      done: typeof body.done === "boolean" ? body.done : null,
      failureErrors: aggregateFailureErrors(body.failures)
    });
  } finally {
    await supabase.from("maintenance_tokens").delete().eq("token_hash", tokenHash);
  }
}
