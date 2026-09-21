import { createSign } from "node:crypto";
import { getServiceClient } from "@/lib/server-auth";

function base64Url(value: string) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizePrivateKey(value: string) {
  let key = value.trim();

  if (key.startsWith("{")) {
    try {
      const parsed = JSON.parse(key) as { private_key?: string };
      if (parsed.private_key) key = parsed.private_key;
    } catch {
      // Fall through to the snippet/value handling below.
    }
  }

  if (key.includes('"private_key"')) {
    const match = key.match(/"private_key"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (match?.[1]) {
      try {
        key = JSON.parse(`"${match[1]}"`) as string;
      } catch {
        key = match[1];
      }
    }
  }

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\n/g, "\n").replace(/\\r/g, "").trim();

  if (!key.includes("-----BEGIN PRIVATE KEY-----") && !key.includes("-----END PRIVATE KEY-----")) {
    const compact = key.replace(/\s+/g, "");
    if (compact.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(compact)) {
      const lines = compact.match(/.{1,64}/g)?.join("\n") || compact;
      key = `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
    }
  }

  if (!key.includes("-----BEGIN PRIVATE KEY-----") || !key.includes("-----END PRIVATE KEY-----")) {
    throw new Error("Niepoprawny format klucza prywatnego konta serwisowego Google.");
  }

  return key;
}

async function googleUserOAuthToken() {
  const envClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || "";
  const envClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || "";
  const envRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() || "";

  let dbClientId = "";
  let dbClientSecret = "";
  let dbRefreshToken = "";
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("google_oauth_config")
      .select("client_id,client_secret,refresh_token")
      .eq("id", "default")
      .maybeSingle();
    dbClientId = data?.client_id?.trim() || "";
    dbClientSecret = data?.client_secret?.trim() || "";
    dbRefreshToken = data?.refresh_token?.trim() || "";
  } catch {
    // Database OAuth config is optional.
  }

  // A freshly reconnected token stored by the maintenance callback must win
  // over an older Vercel environment token that Google may have revoked.
  const clientId = dbClientId || envClientId;
  const clientSecret = dbClientSecret || envClientSecret;
  const refreshToken = dbRefreshToken || envRefreshToken;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    }),
    cache: "no-store"
  });
  const body = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || "Google OAuth nie zwrócił tokenu dostępu.");
  }
  return body.access_token;
}

export async function googleWorkspaceToken(scopes: string[], delegatedUser?: string) {
  let oauthError: unknown = null;
  try {
    const userToken = await googleUserOAuthToken();
    if (userToken) return userToken;
  } catch (error) {
    oauthError = error;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawPrivateKey) {
    if (oauthError instanceof Error) throw oauthError;
    throw new Error("Brakuje danych konta serwisowego Google.");
  }

  const privateKey = normalizePrivateKey(rawPrivateKey);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    ...(delegatedUser ? { sub: delegatedUser } : {})
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`
    }),
    cache: "no-store"
  });
  const body = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || "Google nie zwrócił tokenu dostępu.");
  }
  return body.access_token;
}
