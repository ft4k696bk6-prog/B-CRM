import { createHash } from "node:crypto";
import { googleWorkspaceToken } from "@/lib/google-workspace";
import { getServiceClient } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROJECT_NUMBER = "1022903109661";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/secret|token/i.test(key))
        .map(([key, val]) => [key, sanitize(val)])
    );
  }
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const setupToken = url.searchParams.get("token") || "";
  if (!setupToken) return Response.json({ error: "Brak tokenu." }, { status: 400 });

  const supabase = getServiceClient();
  const { data: validToken } = await supabase
    .from("maintenance_tokens")
    .select("token_hash,purpose")
    .eq("token_hash", sha256(setupToken))
    .in("purpose", ["google_oauth_setup", "contract_file_bridge"])
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!validToken) return Response.json({ error: "Token wygasł." }, { status: 403 });

  let accessToken = "";
  try {
    accessToken = await googleWorkspaceToken(["https://www.googleapis.com/auth/cloud-platform"]);
  } catch (error) {
    return Response.json({
      stage: "mint_cloud_token",
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }

  const endpoints = [
    `https://clientauthconfig.clients6.google.com/v1/clients?projectNumber=${PROJECT_NUMBER}&returnDisabledClients=true`,
    `https://clientauthconfig.googleapis.com/v1/clients?projectNumber=${PROJECT_NUMBER}&returnDisabledClients=true`
  ];

  const results = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Goog-User-Project": PROJECT_NUMBER
        },
        cache: "no-store"
      });
      const text = await response.text();
      let body: unknown = text;
      try { body = JSON.parse(text); } catch {}
      results.push({
        host: new URL(endpoint).host,
        status: response.status,
        ok: response.ok,
        body: sanitize(body)
      });
    } catch (error) {
      results.push({
        host: new URL(endpoint).host,
        status: 0,
        ok: false,
        body: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  return Response.json({ projectNumber: PROJECT_NUMBER, results });
}
