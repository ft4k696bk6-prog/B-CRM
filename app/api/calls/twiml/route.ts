import { NextResponse } from "next/server";
import { appBaseUrl, getServiceClient } from "@/lib/server-auth";

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function handler(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new NextResponse("<Response><Reject /></Response>", {
      status: 400,
      headers: { "Content-Type": "text/xml; charset=utf-8" }
    });
  }

  const supabaseAdmin = getServiceClient();
  const { data: call } = await supabaseAdmin
    .from("lead_calls")
    .select("id,customer_phone,recording_consent,webhook_token")
    .eq("webhook_token", token)
    .single();

  if (!call) {
    return new NextResponse("<Response><Reject /></Response>", {
      status: 404,
      headers: { "Content-Type": "text/xml; charset=utf-8" }
    });
  }

  await supabaseAdmin.from("lead_calls").update({ status: "connecting_customer" }).eq("id", call.id);

  const baseUrl = appBaseUrl(request);
  const statusUrl = `${baseUrl}/api/calls/status?token=${encodeURIComponent(token)}&event=dial`;
  const recordingAttrs = call.recording_consent
    ? ` record="record-from-answer-dual" recordingStatusCallback="${xmlEscape(
        `${baseUrl}/api/calls/status?token=${encodeURIComponent(token)}&event=recording`
      )}" recordingStatusCallbackMethod="POST"`
    : "";
  const callerId = process.env.TWILIO_CALLER_ID || "";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pl-PL">Łączę rozmowę z klientem z CRM.</Say>
  <Dial callerId="${xmlEscape(callerId)}" action="${xmlEscape(statusUrl)}" method="POST" timeout="30"${recordingAttrs}>
    <Number>${xmlEscape(call.customer_phone)}</Number>
  </Dial>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml; charset=utf-8" }
  });
}

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
