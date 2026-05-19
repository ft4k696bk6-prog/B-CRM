import { NextResponse } from "next/server";
import { transcriptActivityDescription, transcribeTwilioRecording } from "@/lib/call-transcription";
import { getServiceClient } from "@/lib/server-auth";

function mapTwilioStatus(status: string | null) {
  switch (status) {
    case "ringing":
    case "initiated":
      return "ringing_user";
    case "in-progress":
    case "answered":
      return "in_progress";
    case "completed":
      return "completed";
    case "busy":
      return "busy";
    case "no-answer":
      return "no_answer";
    case "canceled":
      return "canceled";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const event = url.searchParams.get("event") || "call";

    if (!token) {
      return NextResponse.json({ error: "Brak tokenu webhooka." }, { status: 400 });
    }

    const form = await request.formData();
    const get = (key: string) => {
      const value = form.get(key);
      return typeof value === "string" ? value : null;
    };

    const supabaseAdmin = getServiceClient();
    const { data: call } = await supabaseAdmin
      .from("lead_calls")
      .select("id,lead_id,user_id,metadata")
      .eq("webhook_token", token)
      .single();

    if (!call) {
      return NextResponse.json({ error: "Nie znaleziono rozmowy." }, { status: 404 });
    }

    if (event === "recording") {
      const recordingStatus = get("RecordingStatus");
      const recordingUrl = get("RecordingUrl");
      const metadata = {
        ...(call.metadata || {}),
        recording_status: recordingStatus,
        recording_channels: get("RecordingChannels")
      };

      await supabaseAdmin
        .from("lead_calls")
        .update({
          twilio_recording_sid: get("RecordingSid"),
          recording_url: recordingUrl,
          recording_duration_seconds: Number(get("RecordingDuration")) || null,
          metadata
        })
        .eq("id", call.id);

      if (recordingStatus === "completed" && recordingUrl) {
        const transcription = await transcribeTwilioRecording(recordingUrl);

        if (transcription.ok) {
          await supabaseAdmin
            .from("lead_calls")
            .update({
              transcript: transcription.transcript,
              metadata: {
                ...metadata,
                transcription_status: "completed",
                transcription_completed_at: new Date().toISOString()
              }
            })
            .eq("id", call.id);

          await supabaseAdmin.from("lead_activities").insert({
            lead_id: call.lead_id,
            user_id: call.user_id,
            activity_type: "call_transcript",
            title: "Transkrypcja rozmowy",
            description: transcriptActivityDescription(transcription.transcript),
            metadata: { call_id: call.id }
          });
        } else {
          await supabaseAdmin
            .from("lead_calls")
            .update({
              metadata: {
                ...metadata,
                transcription_status:
                  transcription.code === "missing_openai" ? "waiting_for_openai_key" : "failed",
                transcription_error: transcription.error
              }
            })
            .eq("id", call.id);
        }
      }

      return NextResponse.json({ ok: true });
    }

    const dialStatus = get("DialCallStatus");
    const callStatus = get("CallStatus");
    const nextStatus = mapTwilioStatus(dialStatus || callStatus);
    const duration = Number(get("DialCallDuration") || get("CallDuration")) || null;

    await supabaseAdmin
      .from("lead_calls")
      .update({
        status: nextStatus || undefined,
        twilio_child_call_sid: get("DialCallSid"),
        duration_seconds: duration,
        metadata: {
          ...(call.metadata || {}),
          last_webhook_event: event,
          call_status: callStatus,
          dial_status: dialStatus
        }
      })
      .eq("id", call.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}
