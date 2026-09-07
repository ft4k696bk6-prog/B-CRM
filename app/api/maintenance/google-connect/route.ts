import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server-auth";

export const runtime = "nodejs";

const CALLBACK_URL = "https://b-crm-berni.vercel.app/api/maintenance/google-callback";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function validSetupToken(token: string) {
  if (!token) return false;
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("maintenance_tokens")
    .select("token_hash")
    .eq("token_hash", sha256(token))
    .eq("purpose", "google_oauth_setup")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

function html(body: string, status = 200) {
  return new Response(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Połącz Google z B-CRM</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0b0b0b;color:#fff;max-width:720px;margin:0 auto;padding:32px}h1{font-size:30px}p{color:#c8c8c8;line-height:1.5}label{display:block;margin:18px 0 6px}input{box-sizing:border-box;width:100%;padding:14px;border-radius:10px;border:1px solid #333;background:#171717;color:#fff}button{margin-top:22px;width:100%;padding:15px;border:0;border-radius:10px;background:#fff;color:#000;font-weight:700;font-size:16px}.box{border:1px solid #2b2b2b;border-radius:14px;padding:22px;background:#111}.small{font-size:13px;color:#999;word-break:break-all}</style></head><body>${body}</body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!(await validSetupToken(token))) return html("<h1>Link wygasł</h1><p>Wygeneruj nowy link konfiguracji.</p>", 403);

  return html(`<h1>Połącz Google Drive z B-CRM</h1><div class="box"><p>Wklej dane klienta OAuth z Google Cloud. Potem przekieruję Cię do Google, gdzie tylko zaakceptujesz dostęp do Dysku.</p><form method="post" action="?token=${encodeURIComponent(token)}"><label>Client ID</label><input name="client_id" autocomplete="off" required><label>Client Secret</label><input name="client_secret" type="password" autocomplete="off" required><button type="submit">Połącz z Google</button></form><p class="small">Redirect URI do wpisania w Google Cloud:<br>${CALLBACK_URL}</p></div>`);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!(await validSetupToken(token))) return html("<h1>Link wygasł</h1>", 403);

  const form = await request.formData();
  const clientId = String(form.get("client_id") || "").trim();
  const clientSecret = String(form.get("client_secret") || "").trim();
  if (!clientId || !clientSecret) return html("<h1>Brakuje Client ID lub Client Secret.</h1>", 400);

  const state = randomBytes(32).toString("base64url");
  const supabase = getServiceClient();
  const { error } = await supabase.from("google_oauth_config").upsert({
    id: "default",
    client_id: clientId,
    client_secret: clientSecret,
    state_hash: sha256(state),
    state_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  });
  if (error) return html(`<h1>Błąd zapisu konfiguracji</h1><p>${error.message}</p>`, 500);

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", CALLBACK_URL);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "https://www.googleapis.com/auth/drive");
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("include_granted_scopes", "true");
  auth.searchParams.set("state", state);
  return NextResponse.redirect(auth, 303);
}
