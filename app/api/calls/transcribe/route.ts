import { NextResponse } from "next/server";
import { enumValue, optionalString, uuidString } from "@/lib/api-validation";
import { transcriptActivityDescription, transcribeTwilioRecording } from "@/lib/call-transcription";
import { canAccessLead, requireApiProfile } from "@/lib/server-auth";
import { isDemoScope } from "@/lib/scope";
import type { Lead } from "@/lib/types";

type TranscribeBody = {
  callId?: string;
  action?: "transcribe" | "save_note";
  transcript?: string;
  summary?: string;
  nextStep?: string;
};

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  const output = Array.isArray(record.output) ? record.output : [];
  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as Record<string, unknown>).content;
      return Array.isArray(content) ? content : [];
    })
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const text = (item as Record<string, unknown>).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function parseSummary(text: string) {
  try {
    const parsed = JSON.parse(text) as { summary?: string; next_step?: string };
    return {
      summary: parsed.summary || text,
      nextStep: parsed.next_step || "Ustal kolejny kontakt z klientem."
    };
  } catch {
    return {
      summary: text,
      nextStep: "Ustal kolejny kontakt z klientem."
    };
  }
}

function demoSummary() {
  return {
    transcript:
      "Klient potwierdził zainteresowanie ofertą. Pytał o płatność online, raty i termin montażu. Poprosił o link do oferty i kontakt następnego dnia.",
    summary:
      "Klient jest pozytywnie nastawiony do oferty. Najważniejsze tematy to rata, termin realizacji i możliwość akceptacji online.",
    nextStep: "Wysłać ofertę z QR/linkiem i ustawić call-back na jutro po 12:00."
  };
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if (auth.error) return auth.error;

    const body = (await request.json()) as TranscribeBody;
    const callId = uuidString(body.callId, "callId");
    const action = enumValue(body.action || "transcribe", "action", ["transcribe", "save_note"] as const);
    const transcriptInput = optionalString(body.transcript, "transcript", 24000);
    const summaryInput = optionalString(body.summary, "summary", 4000);
    const nextStepInput = optionalString(body.nextStep, "nextStep", 1000);

    for (const result of [callId, action, transcriptInput, summaryInput, nextStepInput]) {
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { data: call } = await auth.supabaseAdmin
      .from("lead_calls")
      .select("*")
      .eq("id", callId.data!)
      .eq("crm_environment", auth.profile.crm_environment)
      .single();

    if (!call) {
      return NextResponse.json({ error: "Nie znaleziono rozmowy." }, { status: 404 });
    }

    const { data: lead } = await auth.supabaseAdmin
      .from("leads")
      .select("id,full_name,assigned_to,crm_environment")
      .eq("id", call.lead_id)
      .eq("crm_environment", auth.profile.crm_environment)
      .single<Pick<Lead, "id" | "full_name" | "assigned_to" | "crm_environment">>();

    if (!lead || !canAccessLead(auth.profile, lead)) {
      return NextResponse.json({ error: "Brak dostępu do leada." }, { status: 403 });
    }

    if (action.data === "save_note") {
      const summary = summaryInput.data || call.ai_summary || "";
      const nextStep = nextStepInput.data || call.ai_next_step || "";
      const transcript = transcriptInput.data || call.transcript || "";

      if (!summary.trim() && !transcript.trim()) {
        return NextResponse.json({ error: "Brakuje transkrypcji lub notatki." }, { status: 400 });
      }

      const timestamp = new Date().toISOString();
      const { data: updatedCall, error: updateError } = await auth.supabaseAdmin
        .from("lead_calls")
        .update({
          transcript,
          ai_summary: summary,
          ai_next_step: nextStep,
          note_saved_at: timestamp
        })
        .eq("id", call.id)
        .select("*, user_profile:user_id(id,email,full_name,role)")
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      await auth.supabaseAdmin.from("lead_activities").insert({
        lead_id: lead.id,
        user_id: auth.profile.id,
        activity_type: summary ? "ai_call_summary" : "call_transcript",
        title: summary ? "Notatka AI po rozmowie" : "Transkrypcja rozmowy",
        description: summary
          ? `${summary}${nextStep ? `\n\nNastępny krok: ${nextStep}` : ""}`
          : transcriptActivityDescription(transcript),
        metadata: { call_id: call.id, transcript }
      });

      return NextResponse.json(updatedCall);
    }

    if (isDemoScope(auth.profile.crm_environment)) {
      const fallback = demoSummary();
      const { data: updatedCall, error } = await auth.supabaseAdmin
        .from("lead_calls")
        .update({
          transcript: call.transcript || fallback.transcript,
          ai_summary: call.ai_summary || fallback.summary,
          ai_next_step: call.ai_next_step || fallback.nextStep
        })
        .eq("id", call.id)
        .select("*, user_profile:user_id(id,email,full_name,role)")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json(updatedCall);
    }

    const transcription = await transcribeTwilioRecording(call.recording_url);

    if (!transcription.ok) {
      await auth.supabaseAdmin
        .from("lead_calls")
        .update({
          metadata: {
            ...(call.metadata || {}),
            transcription_status:
              transcription.code === "missing_openai" ? "waiting_for_openai_key" : "failed",
            transcription_error: transcription.error
          }
        })
        .eq("id", call.id);

      return NextResponse.json({ error: transcription.error }, { status: transcription.code === "missing_openai" ? 503 : 400 });
    }

    const transcript = transcription.transcript;
    const summaryResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4.1-mini",
        input:
          "Z rozmowy handlowej CRM przygotuj krótki JSON po polsku: " +
          "{\"summary\":\"2-3 zdania\",\"next_step\":\"konkretny kolejny krok\"}. " +
          `Klient: ${lead.full_name}. Transkrypcja: ${transcript}`
      })
    });

    const summaryBody = await summaryResponse.json().catch(() => ({}));
    const summary = summaryResponse.ok
      ? parseSummary(extractOutputText(summaryBody))
      : { summary: "Transkrypcja gotowa. Podsumowanie AI wymaga ponowienia.", nextStep: "Sprawdź rozmowę ręcznie." };

    const { data: updatedCall, error } = await auth.supabaseAdmin
      .from("lead_calls")
      .update({
        transcript,
        ai_summary: summary.summary,
        ai_next_step: summary.nextStep,
        metadata: {
          ...(call.metadata || {}),
          transcription_status: "completed",
          transcription_completed_at: new Date().toISOString()
        }
      })
      .eq("id", call.id)
      .select("*, user_profile:user_id(id,email,full_name,role)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json(updatedCall);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
