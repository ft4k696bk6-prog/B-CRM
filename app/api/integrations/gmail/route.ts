import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { googleWorkspaceToken } from "@/lib/google-workspace";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (!hasPermission(auth.profile.role, "integrations:manage")) {
    return NextResponse.json(
      { error: "Nie masz uprawnień do skrzynki firmowej." },
      { status: 403 }
    );
  }

  const mailbox = process.env.GOOGLE_WORKSPACE_DELEGATED_USER?.trim();
  if (!mailbox) {
    return NextResponse.json(
      {
        error: "Ustaw GOOGLE_WORKSPACE_DELEGATED_USER i delegację Gmail w Google Workspace.",
        needsConfiguration: true
      },
      { status: 503 }
    );
  }

  try {
    const token = await googleWorkspaceToken(
      ["https://www.googleapis.com/auth/gmail.readonly"],
      mailbox
    );
    const listResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in%3Ainbox",
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    const list = (await listResponse.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };
    if (!listResponse.ok) {
      throw new Error(list.error?.message || "Nie udało się pobrać skrzynki.");
    }

    const messages = await Promise.all(
      (list.messages || []).map(async ({ id }) => {
        const response = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
        );
        const item = (await response.json()) as {
          id: string;
          snippet?: string;
          payload?: { headers?: Array<{ name: string; value: string }> };
        };
        const headers = Object.fromEntries(
          (item.payload?.headers || []).map((header) => [header.name.toLowerCase(), header.value])
        );
        return {
          id: item.id,
          from: headers.from || "",
          subject: headers.subject || "(bez tematu)",
          date: headers.date || "",
          snippet: item.snippet || "",
          url: `https://mail.google.com/mail/u/0/#inbox/${item.id}`
        };
      })
    );

    return NextResponse.json({ mailbox, messages });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Błąd Gmail." },
      { status: 503 }
    );
  }
}
