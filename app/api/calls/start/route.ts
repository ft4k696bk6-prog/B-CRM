import { NextResponse } from "next/server";
import { optionalString, uuidString } from "@/lib/api-validation";
import { normalizePhoneForDial } from "@/lib/phone";
import { appBaseUrl, canAccessLead, requireApiProfile } from "@/lib/server-auth";
import type { Lead } from "@/lib/types";

type StartCallBody = {
  leadId?: string;
  callerPhone?: string;
  recordingConsent?: boolean;
  saveCallerPhone?: boolean;
};

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_CALLER_ID
  );
}

function basicAuth(username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString("base64");
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if (auth.error) return auth.error;

    const body = (await request.json()) as StartCallBody;
    const leadId = uuidString(body.leadId, "leadId");
    const callerPhoneInput = optionalString(body.callerPhone, "callerPhone", 40);

    for (const result of [leadId, callerPhoneInput]) {
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { data: lead } = await auth.supabaseAdmin
      .from("leads")
      .select("id,full_name,phone,assigned_to,crm_environment")
      .eq("id", leadId.data!)
      .eq("crm_environment", auth.profile.crm_environment)
      .single<Pick<Lead, "id" | "full_name" | "phone" | "assigned_to" | "crm_environment">>();

    if (!lead || !canAccessLead(auth.profile, lead)) {
      return NextResponse.json({ error: "Brak dostępu do leada." }, { status: 403 });
    }

    const callerPhone = normalizePhoneForDial(callerPhoneInput.data || auth.profile.business_phone);
    const customerPhone = normalizePhoneForDial(lead.phone);

    if (!callerPhone) {
      return NextResponse.json(
        { error: "Uzupełnij numer służbowy użytkownika w formacie +48 600 000 000." },
        { status: 400 }
      );
    }

    if (!customerPhone) {
      return NextResponse.json({ error: "Numer klienta nie nadaje się do połączenia." }, { status: 400 });
    }

    if (body.saveCallerPhone) {
      await auth.supabaseAdmin
        .from("profiles")
        .update({ business_phone: callerPhone })
        .eq("id", auth.profile.id)
        .eq("crm_environment", auth.profile.crm_environment);
    }

    const webhookToken = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const { data: call, error: callError } = await auth.supabaseAdmin
      .from("lead_calls")
      .insert({
        lead_id: lead.id,
        user_id: auth.profile.id,
        crm_environment: auth.profile.crm_environment,
        user_phone: callerPhone,
        customer_phone: customerPhone,
        status: "queued",
        recording_consent: Boolean(body.recordingConsent),
        webhook_token: webhookToken,
        duration_seconds: null,
        transcript: null,
        ai_summary: null,
        ai_next_step: null,
        metadata: { mode: "twilio", started_at: timestamp }
      })
      .select("*, user_profile:user_id(id,email,full_name,role)")
      .single();

    if (callError || !call) {
      if (callError?.message?.includes("lead_calls")) {
        return NextResponse.json(
          { error: "Brakuje tabeli lead_calls. Uruchom migrację supabase/10_click_to_call_ai.sql w Supabase." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: callError?.message || "Nie udało się zapisać rozmowy." }, { status: 400 });
    }

    if (!twilioConfigured()) {
      await auth.supabaseAdmin.from("lead_calls").update({ status: "failed" }).eq("id", call.id);
      return NextResponse.json(
        { error: "Brakuje konfiguracji Twilio. Uzupełnij TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN i TWILIO_CALLER_ID." },
        { status: 503 }
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const callerId = process.env.TWILIO_CALLER_ID!;
    const baseUrl = appBaseUrl(request);
    const twimlUrl = `${baseUrl}/api/calls/twiml?token=${encodeURIComponent(webhookToken)}`;
    const statusUrl = `${baseUrl}/api/calls/status?token=${encodeURIComponent(webhookToken)}`;

    const params = new URLSearchParams({
      To: callerPhone,
      From: callerId,
      Url: twimlUrl,
      Method: "POST",
      StatusCallback: statusUrl,
      StatusCallbackMethod: "POST"
    });
    ["initiated", "ringing", "answered", "completed"].forEach((eventName) => {
      params.append("StatusCallbackEvent", eventName);
    });

    const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth(accountSid, authToken)}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });

    const twilioBody = await twilioResponse.json().catch(() => ({}));

    if (!twilioResponse.ok) {
      await auth.supabaseAdmin
        .from("lead_calls")
        .update({ status: "failed", metadata: { mode: "twilio", twilio_error: twilioBody } })
        .eq("id", call.id);

      return NextResponse.json(
        { error: twilioBody.message || "Twilio nie uruchomiło połączenia." },
        { status: 400 }
      );
    }

    const { data: updatedCall } = await auth.supabaseAdmin
      .from("lead_calls")
      .update({
        status: "ringing_user",
        twilio_parent_call_sid: twilioBody.sid,
        metadata: { mode: "twilio", started_at: timestamp, twilio_status: twilioBody.status }
      })
      .eq("id", call.id)
      .select("*, user_profile:user_id(id,email,full_name,role)")
      .single();

    await auth.supabaseAdmin.from("lead_activities").insert({
      lead_id: lead.id,
      user_id: auth.profile.id,
      activity_type: "call_logged",
      title: "Połączenie uruchomione z CRM",
      description: "CRM zadzwonił do użytkownika i przygotował mostek do klienta.",
      metadata: { call_id: call.id, twilio_parent_call_sid: twilioBody.sid }
    });

    return NextResponse.json({ call: updatedCall || call, mode: "twilio" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
