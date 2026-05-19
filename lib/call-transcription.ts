type TranscriptionResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string; code: "missing_openai" | "missing_twilio" | "download_failed" | "transcription_failed" };

function basicAuth(username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString("base64");
}

export async function transcribeTwilioRecording(recordingUrl: string | null | undefined): Promise<TranscriptionResult> {
  if (!recordingUrl) {
    return { ok: false, code: "download_failed", error: "Nagranie rozmowy nie jest jeszcze gotowe." };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, code: "missing_openai", error: "Brakuje OPENAI_API_KEY do transkrypcji rozmów." };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return { ok: false, code: "missing_twilio", error: "Brakuje konfiguracji Twilio do pobrania nagrania." };
  }

  const audioResponse = await fetch(`${recordingUrl}.mp3`, {
    headers: { Authorization: `Basic ${basicAuth(accountSid, authToken)}` }
  });

  if (!audioResponse.ok) {
    return { ok: false, code: "download_failed", error: "Nie udało się pobrać nagrania rozmowy." };
  }

  const audioBlob = await audioResponse.blob();
  const form = new FormData();
  form.append("file", audioBlob, "recording.mp3");
  form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
  form.append("language", "pl");

  const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form
  });

  const transcriptionBody = await transcriptionResponse.json().catch(() => ({}));

  if (!transcriptionResponse.ok) {
    return {
      ok: false,
      code: "transcription_failed",
      error: transcriptionBody.error?.message || "Nie udało się zrobić transkrypcji rozmowy."
    };
  }

  return { ok: true, transcript: transcriptionBody.text || "" };
}

export function transcriptActivityDescription(transcript: string) {
  const trimmed = transcript.trim();
  if (!trimmed) return "Transkrypcja rozmowy jest pusta.";
  if (trimmed.length <= 3500) return trimmed;
  return `${trimmed.slice(0, 3500)}...`;
}
