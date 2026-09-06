"use client";

import { FormEvent, useRef, useState } from "react";
import { ExternalLink, MessageSquareText, Mic, MicOff, Send } from "lucide-react";
import { LeadFastActions } from "@/components/lead-fast-actions";
import type { LeadOutcome } from "@/lib/lead-outcomes";
import type { Lead } from "@/lib/types";

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

export function LeadInlineActions({
  lead,
  accessToken,
  onPreset,
  onComments,
  onChanged,
  onOpenDetails
}: {
  lead: Lead;
  accessToken: string;
  onPreset: (lead: Lead, outcome: LeadOutcome) => void;
  onComments: (lead: Lead) => void;
  onChanged?: () => void | Promise<void>;
  onOpenDetails: (lead: Lead) => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [dictationHint, setDictationHint] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    const description = note.trim();
    if (!description || saving) return;
    setSaving(true);
    setError("");
    const response = await fetch("/api/leads/activities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        lead_id: lead.id,
        activity_type: "comment",
        title: "Komentarz",
        description
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "Nie udało się zapisać notatki.");
      setSaving(false);
      return;
    }
    setNote("");
    setDictationHint("");
    window.dispatchEvent(new Event("leads:changed"));
    await onChanged?.();
    setSaving(false);
  }

  function startDictation() {
    setError("");
    setDictationHint("");

    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      textareaRef.current?.focus();
      setDictationHint("Ta przeglądarka nie udostępnia dyktowania z poziomu strony. Pole notatki jest aktywne — użyj mikrofonu na klawiaturze telefonu.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "pl-PL";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript || "";
      }
      if (transcript.trim()) setNote(transcript.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      setDictationHint("Nie udało się uruchomić rozpoznawania mowy. Możesz użyć mikrofonu na klawiaturze telefonu.");
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      textareaRef.current?.focus();
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <div className="grid min-w-0 gap-3 rounded-xl bg-[#f8fafc] p-3">
      <LeadFastActions
        lead={lead}
        accessToken={accessToken}
        onPreset={onPreset}
        onComments={onComments}
        onChanged={onChanged}
      />

      <form onSubmit={saveNote} className="rounded-xl border border-line bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-black text-ink">
            <MessageSquareText className="h-4 w-4 text-sky" aria-hidden="true" />
            Szybka notatka
          </div>
          <button
            type="button"
            onClick={startDictation}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition active:scale-[.96] ${listening ? "border-danger/30 bg-danger/10 text-danger" : "border-line bg-white text-ink hover:border-sky/40"}`}
            aria-label={listening ? "Zatrzymaj dyktowanie" : "Dyktuj notatkę"}
            title={listening ? "Zatrzymaj dyktowanie" : "Dyktuj notatkę"}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="field min-h-24 resize-y"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Napisz albo podyktuj krótką notatkę po rozmowie…"
          maxLength={4000}
        />
        {dictationHint ? <p className="mt-2 text-xs font-semibold leading-5 text-muted">{dictationHint}</p> : null}
        {error ? <p className="mt-2 text-xs font-bold text-danger">{error}</p> : null}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="submit" className="btn-primary min-h-11" disabled={!note.trim() || saving}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {saving ? "Zapisuję…" : "Zapisz notatkę"}
          </button>
          <button type="button" className="btn-secondary min-h-11" onClick={() => onOpenDetails(lead)}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Karta leada
          </button>
        </div>
      </form>
    </div>
  );
}
