import { NextResponse } from "next/server";
import { optionalString, requiredString, uuidString } from "@/lib/api-validation";
import {
  buildEmailSendDedupeKey,
  followUpEligibleAt,
  normalizeRecipientEmail,
  screenEmailRecipient
} from "@/lib/email-send-guard";
import { checkServerRateLimit, isRequestBodyError, rateLimitResponse, readJsonBody } from "@/lib/request-security";
import { appBaseUrl, canAccessLead, requireApiProfile } from "@/lib/server-auth";
import type { Lead } from "@/lib/types";

type SendOfferBody = {
  leadId?: string;
  recipientEmail?: string;
  subject?: string;
  note?: string | null;
  templateKey?: string | null;
};

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.OFFER_FROM_EMAIL);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendWithResend(input: { to: string; subject: string; html: string }) {
  if (!process.env.RESEND_API_KEY || !process.env.OFFER_FROM_EMAIL) return { ok: false, error: "Brak konfiguracji wysyłki." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.OFFER_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html
    })
  });

  const payload = await response.json().catch(() => ({}));
  return response.ok ? { ok: true, id: payload.id as string | undefined } : { ok: false, error: payload.message || "Provider nie przyjął e-maila." };
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if (auth.error) return auth.error;

    if (!checkServerRateLimit(`offer-email:${auth.profile.id}`, 12, 10 * 60 * 1000)) {
      return rateLimitResponse("Za dużo prób wysyłki ofert. Spróbuj ponownie za chwilę.");
    }

    const body = await readJsonBody<SendOfferBody>(request, 16 * 1024);
    const leadId = uuidString(body.leadId, "leadId");
    const recipient = requiredString(body.recipientEmail, "recipientEmail", 180);
    const subject = optionalString(body.subject, "subject", 180);
    const note = optionalString(body.note, "note", 2000);
    const templateKey = optionalString(body.templateKey, "templateKey", 80);

    for (const result of [leadId, recipient, subject, note, templateKey]) {
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { data: lead } = await auth.supabaseAdmin
      .from("leads")
      .select("id,full_name,phone,email,assigned_to,crm_environment,source")
      .eq("id", leadId.data!)
      .eq("crm_environment", auth.profile.crm_environment)
      .single<Pick<Lead, "id" | "full_name" | "phone" | "email" | "assigned_to" | "crm_environment" | "source">>();

    if (!lead || !canAccessLead(auth.profile, lead)) {
      return NextResponse.json({ error: "Brak dostępu do leada." }, { status: 403 });
    }

    const normalizedEmail = normalizeRecipientEmail(recipient.data!);
    const screening = screenEmailRecipient({
      recipientEmail: normalizedEmail,
      displayName: lead.full_name,
      sourceLabel: lead.source
    });

    if (!screening.allowed) {
      return NextResponse.json(
        { error: screening.reason === "invalid_email" ? "Niepoprawny adres e-mail." : "Adres wygląda na sektor zablokowany dla wysyłki masowej." },
        { status: 400 }
      );
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const baseUrl = appBaseUrl(request);
    const portalUrl = `${baseUrl}/oferty/${token}`;
    const pixelUrl = `${baseUrl}/api/offers/events?token=${token}&event=opened`;
    const finalSubject = subject.data || "Oferta Re-Energy System";
    const sentAt = new Date();
    const dedupeKey = buildEmailSendDedupeKey({
      recipientEmail: normalizedEmail,
      scope: "offer",
      crmEnvironment: auth.profile.crm_environment,
      leadId: lead.id,
      templateKey: templateKey.data || "energy-offer"
    });
    const providerReady = emailConfigured();

    const { data: delivery, error: deliveryError } = await auth.supabaseAdmin
      .from("offer_deliveries")
      .insert({
        dedupe_key: dedupeKey,
        lead_id: lead.id,
        owner_id: lead.assigned_to || auth.profile.id,
        sent_by: auth.profile.id,
        crm_environment: auth.profile.crm_environment,
        channel: "email",
        campaign_key: "meeting-offer",
        template_key: templateKey.data || "energy-offer",
        status: providerReady ? "queued" : "queued",
        recipient: normalizedEmail,
        recipient_email: normalizedEmail,
        normalized_recipient_email: normalizedEmail,
        subject: finalSubject,
        public_token: token,
        follow_up_eligible_at: followUpEligibleAt(sentAt).toISOString(),
        metadata: { note: note.data, portal_url: portalUrl }
      })
      .select("id,public_token")
      .single();

    if (deliveryError || !delivery) {
      if (deliveryError?.code === "23505" || /dedupe|duplicate|unique/i.test(deliveryError?.message || "")) {
        return NextResponse.json(
          { error: "Ta oferta była już wysłana do tego odbiorcy. Follow-up jest dostępny po tygodniu." },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: deliveryError?.message || "Nie udało się zapisać wysyłki oferty." }, { status: 400 });
    }

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#101722">
        <h1 style="font-size:22px;margin:0 0 12px">Oferta Re-Energy System</h1>
        <p>Dzień dobry, poniżej znajduje się bezpieczny link do oferty przygotowanej po spotkaniu.</p>
        ${note.data ? `<p>${escapeHtml(note.data)}</p>` : ""}
        <p><a href="${portalUrl}" style="display:inline-block;background:#101722;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Otwórz ofertę</a></p>
        <img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;opacity:0" />
      </div>
    `;

    let providerMessageId: string | null = null;
    let status = "queued";
    let failureReason: string | null = null;

    if (providerReady) {
      const sendResult = await sendWithResend({ to: normalizedEmail, subject: finalSubject, html });
      if (sendResult.ok) {
        providerMessageId = sendResult.id || null;
        status = "sent";
      } else {
        status = "failed";
        failureReason = sendResult.error;
      }
    }

    await auth.supabaseAdmin
      .from("offer_deliveries")
      .update({
        status,
        provider_message_id: providerMessageId,
        failure_reason: failureReason,
        sent_at: status === "sent" ? sentAt.toISOString() : null
      })
      .eq("id", delivery.id);

    await auth.supabaseAdmin.from("mail_events").insert({
      offer_delivery_id: delivery.id,
      crm_environment: auth.profile.crm_environment,
      provider: providerReady ? "resend" : "manual",
      message_id: providerMessageId,
      event_type: status === "sent" ? "sent" : status === "failed" ? "failed" : "queued",
      payload: { portal_url: portalUrl, failure_reason: failureReason }
    });

    if (status !== "failed") {
      await auth.supabaseAdmin
        .from("leads")
        .update({ status: "Oferta wysłana", email: normalizedEmail, email_key: `email:${normalizedEmail}` })
        .eq("id", lead.id)
        .eq("crm_environment", auth.profile.crm_environment);
    }

    return NextResponse.json({
      deliveryId: delivery.id,
      status,
      mode: providerReady ? "email" : "portal",
      portalUrl,
      error: failureReason
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd wysyłki oferty." },
      { status: 500 }
    );
  }
}
