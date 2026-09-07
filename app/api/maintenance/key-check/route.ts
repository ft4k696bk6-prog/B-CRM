import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
  const delegatedUser = process.env.GOOGLE_WORKSPACE_DELEGATED_USER || "";
  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "";
  const trimmed = key.trim();

  return NextResponse.json({
    hasEmail: Boolean(email),
    hasKey: Boolean(key),
    hasDelegatedUser: Boolean(delegatedUser.trim()),
    delegatedUserDomain: delegatedUser.includes("@") ? delegatedUser.split("@").at(-1) : null,
    hasOAuthClientId: Boolean(oauthClientId.trim()),
    hasOAuthClientSecret: Boolean(oauthClientSecret.trim()),
    hasOAuthRefreshToken: Boolean(oauthRefreshToken.trim()),
    keyLength: key.length,
    startsJson: trimmed.startsWith("{"),
    containsPrivateKeyLabel: trimmed.includes('"private_key"'),
    containsBeginMarker: trimmed.includes("-----BEGIN PRIVATE KEY-----"),
    containsEndMarker: trimmed.includes("-----END PRIVATE KEY-----"),
    containsEscapedNewlines: trimmed.includes("\\n"),
    containsRealNewlines: trimmed.includes("\n"),
    wrappedInDoubleQuotes: trimmed.startsWith('"') && trimmed.endsWith('"'),
    wrappedInSingleQuotes: trimmed.startsWith("'") && trimmed.endsWith("'")
  });
}
