"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BrainCircuit, CheckCircle2, Loader2, PhoneCall, Radio, Save, Wand2 } from "lucide-react";
import { Alert, EmptyState, ModalShell, SectionHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/date";
import { formatPhoneReadable } from "@/lib/phone";
import type { Lead, LeadCall, Profile } from "@/lib/types";

type LeadCallPanelProps = {
  lead: Lead;
  profile: Profile;
  token: string;
  canManageCalls: boolean;
  onBusinessPhoneSaved?: (phone: string) => void;
};

const statusLabels: Record<LeadCall["status"], string> = {
  queued: "W kolejce",
  ringing_user: "Dzwoni do użytkownika",
  connecting_customer: "Łączy z klientem",
  in_progress: "W trakcie",
  completed: "Zakończona",
  failed: "Błąd",
  busy: "Zajęte",
  no_answer: "Brak odpowiedzi",
  canceled: "Anulowana",
  demo_completed: "Zapis rozmowy"
};

function durationLabel(seconds: number | null) {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function LeadCallPanel({
  lead,
  profile,
  token,
  canManageCalls,
  onBusinessPhoneSaved
}: LeadCallPanelProps) {
  const [calls, setCalls] = useState<LeadCall[]>([]);
  const [open, setOpen] = useState(false);
  const [callerPhone, setCallerPhone] = useState(profile.business_phone || "");
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [saveCallerPhone, setSaveCallerPhone] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Record<string, { transcript: string; summary: string; nextStep: string }>>({});

  const latestCall = calls[0];
  const hasBusinessPhone = Boolean(profile.business_phone || callerPhone.trim());

  const latestCopy = useMemo(() => {
    if (!latestCall) return "CRM najpierw zadzwoni do Ciebie, a potem połączy rozmowę z klientem.";
    return `${statusLabels[latestCall.status]} · ${durationLabel(latestCall.duration_seconds)}`;
  }, [latestCall]);

  useEffect(() => {
    setCallerPhone(profile.business_phone || "");
  }, [profile.business_phone]);

  const loadCalls = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/calls?lead_id=${lead.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Nie udało się pobrać rozmów.");
      setCalls(body);
      setEditing(
        Object.fromEntries(
          (body as LeadCall[]).map((call) => [
            call.id,
            {
              transcript: call.transcript || "",
              summary: call.ai_summary || "",
              nextStep: call.ai_next_step || ""
            }
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się pobrać rozmów.");
    }
  }, [lead.id, token]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  async function startCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/calls/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          leadId: lead.id,
          callerPhone,
          recordingConsent,
          saveCallerPhone
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Nie udało się uruchomić połączenia.");

      setNotice("Połączenie uruchomione. Najpierw zadzwoni telefon użytkownika.");
      setOpen(false);
      if (saveCallerPhone && callerPhone.trim()) onBusinessPhoneSaved?.(callerPhone.trim());
      await loadCalls();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się uruchomić połączenia.");
    } finally {
      setBusy(false);
    }
  }

  async function transcribe(callId: string) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/calls/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ callId, action: "transcribe" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Nie udało się przygotować transkrypcji.");
      setNotice("Transkrypcja jest gotowa. Możesz ją sprawdzić i zapisać w aktywnościach.");
      await loadCalls();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się przygotować transkrypcji.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(callId: string) {
    const draft = editing[callId];
    if (!draft?.summary.trim()) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/calls/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          callId,
          action: "save_note",
          transcript: draft.transcript,
          summary: draft.summary,
          nextStep: draft.nextStep
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Nie udało się zapisać notatki.");
      setNotice("Rozmowa została zapisana w aktywnościach leada.");
      await loadCalls();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać notatki.");
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(callId: string, field: "transcript" | "summary" | "nextStep", value: string) {
    setEditing((current) => ({
      ...current,
      [callId]: {
        transcript: current[callId]?.transcript || "",
        summary: current[callId]?.summary || "",
        nextStep: current[callId]?.nextStep || "",
        [field]: value
      }
    }));
  }

  return (
    <section className="app-card">
      <SectionHeader
        icon={PhoneCall}
        title="Rozmowy i AI"
        description={latestCopy}
        tone="sky"
        actions={
          <button type="button" onClick={() => setOpen(true)} disabled={!canManageCalls} className="btn-primary">
            <PhoneCall className="h-4 w-4" aria-hidden="true" />
            Zadzwoń
          </button>
        }
      />

      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
      {notice ? <Alert tone="success" className="mb-4">{notice}</Alert> : null}

      {!canManageCalls ? (
        <Alert tone="info">Ta rola ma dostęp tylko do podglądu rozmów.</Alert>
      ) : null}

      {!hasBusinessPhone ? (
        <Alert tone="warning" className="mb-4">
          Uzupełnij swój numer służbowy. CRM zadzwoni najpierw do Ciebie, a dopiero potem połączy klienta.
        </Alert>
      ) : null}

      {calls.length === 0 ? (
        <EmptyState
          title="Brak rozmów"
          description="Po pierwszym połączeniu pojawią się tutaj status, czas rozmowy i notatka AI."
        />
      ) : (
        <div className="grid gap-3">
          {calls.map((call) => {
            const draft = editing[call.id] || {
              transcript: call.transcript || "",
              summary: call.ai_summary || "",
              nextStep: call.ai_next_step || ""
            };

            return (
              <article key={call.id} className="rounded-lg border border-line bg-[#f9fbfd] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-sky/20 bg-sky/10 px-2 py-1 text-xs font-black text-sky">
                        {statusLabels[call.status]}
                      </span>
                      {call.recording_consent ? (
                        <span className="rounded-md border border-leaf/20 bg-leaf/10 px-2 py-1 text-xs font-black text-leaf">
                          Nagrywanie
                        </span>
                      ) : null}
                      {call.note_saved_at ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-xs font-black text-muted">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          W aktywnościach
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-1 text-sm text-muted">
                      <div>Użytkownik: {formatPhoneReadable(call.user_phone)}</div>
                      <div>Klient: {formatPhoneReadable(call.customer_phone)}</div>
                      <div>Czas: {durationLabel(call.duration_seconds)} · {formatDateTime(call.created_at)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => transcribe(call.id)} disabled={busy} className="btn-secondary">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
                      Transkrybuj
                    </button>
                    <button
                      type="button"
                      onClick={() => saveNote(call.id)}
                      disabled={busy || (!draft.summary.trim() && !draft.transcript.trim()) || Boolean(call.note_saved_at)}
                      className="btn-primary"
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Zapisz
                    </button>
                  </div>
                </div>

                {(call.transcript || call.ai_summary || call.ai_next_step) ? (
                  <div className="mt-4 grid gap-3">
                    <label>
                      <span className="label">Podsumowanie AI opcjonalnie</span>
                      <textarea
                        className="field min-h-24"
                        value={draft.summary}
                        onChange={(event) => updateDraft(call.id, "summary", event.target.value)}
                        disabled={Boolean(call.note_saved_at)}
                      />
                    </label>
                    <label>
                      <span className="label">Następny krok</span>
                      <input
                        className="field"
                        value={draft.nextStep}
                        onChange={(event) => updateDraft(call.id, "nextStep", event.target.value)}
                        disabled={Boolean(call.note_saved_at)}
                      />
                    </label>
                    <details className="rounded-md border border-line bg-white p-3">
                      <summary className="cursor-pointer text-sm font-black text-ink">Transkrypcja</summary>
                      <textarea
                        className="field mt-3 min-h-36"
                        value={draft.transcript}
                        onChange={(event) => updateDraft(call.id, "transcript", event.target.value)}
                        disabled={Boolean(call.note_saved_at)}
                      />
                    </details>
                  </div>
                ) : (
                  <p className="mt-4 rounded-md border border-line bg-white p-3 text-sm font-semibold text-muted">
                    Po zakończeniu rozmowy CRM zapisze nagranie. Jeśli transkrypcja nie pojawi się automatycznie, użyj przycisku Transkrybuj.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <ModalShell
        open={open}
        title="Połączenie przez CRM"
        description="CRM zadzwoni najpierw na numer użytkownika, a po odebraniu połączy klienta."
        onClose={() => (busy ? undefined : setOpen(false))}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-secondary">
              Anuluj
            </button>
            <button type="submit" form="lead-call-start-form" disabled={busy || !canManageCalls} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Radio className="h-4 w-4" aria-hidden="true" />}
              Uruchom połączenie
            </button>
          </div>
        }
      >
        <form id="lead-call-start-form" onSubmit={startCall} className="grid gap-4">
          <Alert tone="info" title="Jak to działa">
            Najpierw odbierasz telefon firmowy, potem CRM łączy klienta. Jeśli nagrywanie jest włączone, po rozmowie CRM zapisze nagranie i transkrypcję.
          </Alert>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Twój numer służbowy</span>
              <input
                className="field"
                value={callerPhone}
                onChange={(event) => setCallerPhone(event.target.value)}
                placeholder="+48 600 000 000"
              />
            </label>
            <label>
              <span className="label">Numer klienta</span>
              <input className="field" value={formatPhoneReadable(lead.phone)} readOnly />
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-line bg-[#f9fbfd] p-3 text-sm font-semibold text-ink">
            <input
              className="mt-1"
              type="checkbox"
              checked={saveCallerPhone}
              onChange={(event) => setSaveCallerPhone(event.target.checked)}
            />
            Zapisz ten numer jako mój numer służbowy.
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-line bg-[#f9fbfd] p-3 text-sm font-semibold text-ink">
            <input
              className="mt-1"
              type="checkbox"
              checked={recordingConsent}
              onChange={(event) => setRecordingConsent(event.target.checked)}
            />
            Klient został poinformowany o nagrywaniu i wyraził zgodę.
          </label>

          <div className="rounded-lg border border-line bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-black text-ink">
              <BrainCircuit className="h-4 w-4 text-sky" aria-hidden="true" />
              AI po rozmowie
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">
              Po zakończeniu rozmowy CRM zapisze nagranie i spróbuje automatycznie zrobić transkrypcję. Podsumowanie AI jest opcjonalne i można je podpiąć później.
            </p>
          </div>
        </form>
      </ModalShell>
    </section>
  );
}
