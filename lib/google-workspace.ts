import { createSign } from "node:crypto";

function base64Url(value: string) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function googleWorkspaceToken(scopes: string[], delegatedUser?: string) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawPrivateKey) throw new Error("Brakuje danych konta serwisowego Google.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: email, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600, iat: now, ...(delegatedUser ? { sub: delegatedUser } : {})
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
  const signature = signer.sign(rawPrivateKey, "base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    cache: "no-store"
  });
  const body = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error_description || "Google nie zwrócił tokenu dostępu.");
  return body.access_token;
}
