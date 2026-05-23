import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server-auth";
import type { MailEventType } from "@/lib/types";

const pixel = Buffer.from(
  "R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64"
);

const allowedEvents = new Set<MailEventType>(["opened", "visited", "clicked", "downloaded"]);

function eventPatch(eventType: MailEventType) {
  const now = new Date().toISOString();
  if (eventType === "downloaded") return { status: "downloaded", downloaded_at: now };
  if (eventType === "clicked") return { status: "clicked", clicked_at: now };
  if (eventType === "opened" || eventType === "visited") return { status: "opened", opened_at: now };
  return {};
}

async function recordEvent(token: string, eventType: MailEventType, payload: Record<string, unknown>) {
  const supabaseAdmin = getServiceClient();
  const { data: delivery } = await supabaseAdmin
    .from("offer_deliveries")
    .select("id,crm_environment,customer_id,owner_id,sent_by,status")
    .eq("public_token", token)
    .single<{
      id: string;
      crm_environment: string;
      customer_id: string | null;
      owner_id: string | null;
      sent_by: string | null;
      status: string;
    }>();

  if (!delivery) return false;

  await supabaseAdmin.from("offer_deliveries").update(eventPatch(eventType)).eq("id", delivery.id);

  await supabaseAdmin.from("mail_events").insert({
    offer_delivery_id: delivery.id,
    customer_id: delivery.customer_id,
    crm_environment: delivery.crm_environment,
    provider: "portal",
    event_type: eventType,
    payload
  });

  if (eventType === "opened" || eventType === "visited") {
    const recipientId = delivery.owner_id || delivery.sent_by;
    if (recipientId) {
      await supabaseAdmin.from("notifications").insert({
        recipient_id: recipientId,
        crm_environment: delivery.crm_environment,
        notification_type: "offer_opened",
        title: "Klient otworzył ofertę",
        body: "Oferta ma nowe zdarzenie otwarcia w portalu klienta.",
        entity_type: "offer_delivery",
        entity_id: delivery.id
      });
    }
  }

  return true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const eventType = (url.searchParams.get("event") || "opened") as MailEventType;

  if (token && allowedEvents.has(eventType)) {
    await recordEvent(token, eventType, {
      user_agent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
      mode: "pixel"
    }).catch(() => false);
  }

  return new NextResponse(pixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; event?: MailEventType; href?: string };
    const token = body.token?.trim() || "";
    const eventType = body.event || "visited";

    if (!token || !allowedEvents.has(eventType)) {
      return NextResponse.json({ error: "Niepoprawne zdarzenie oferty." }, { status: 400 });
    }

    const ok = await recordEvent(token, eventType, {
      href: body.href || null,
      user_agent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
      mode: "portal"
    });

    return NextResponse.json({ ok });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd zdarzenia." },
      { status: 500 }
    );
  }
}
