import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const supabase = getServiceClient();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await supabase.from("maintenance_tokens").delete().eq("purpose", "knowledge_contract_transfer").lt("expires_at", new Date().toISOString());
  const { error } = await supabase.from("maintenance_tokens").insert({
    token_hash: tokenHash,
    purpose: "knowledge_contract_transfer",
    expires_at: expiresAt
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token, expiresAt });
}
