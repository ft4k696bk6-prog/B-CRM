"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, FileSignature, PhoneOff, RotateCcw, UserX } from "lucide-react";
import { Alert, ModalShell } from "@/components/ui";
import { allowedOutcomes, type LeadOutcome } from "@/lib/lead-outcomes";
import type { Lead } from "@/lib/types";

const actions: Record<LeadOutcome, { label: string; icon: typeof CalendarClock }> = {
  callback: { label: "Call back", icon: CalendarClock },
  meeting: { label: "Spotkanie", icon: CalendarPlus },
  no_answer: { label: "Nie odbiera", icon: PhoneOff },
  return: { label: "Zwróć lead", icon: RotateCcw },
  contract: { label: "Przejdź do umowy", icon: FileSignature },
  resignation: { label: "Rezygnacja", icon: UserX }
};

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function callbackPreset(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return localDateTimeValue(date);
}

export function LeadQuickActionDialog({
  lead,
  accessToken,
  initialOutcome = null,
  onClose,
  onCompleted
}: {
  lead: Lead | null;
  accessToken: string;
  initialOutcome?: LeadOutcome | null;
  onClose: () => void;
  onCompleted: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<LeadOutcome | null>(initialOutcome);
  const [callbackAt, setCallbackAt] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOutcome(initialOutcome);
    setCallbackAt(initialOutcome === "callback" ? callbackPreset(1) : "");
    setMeetingAt("");
    setAddress(lead?.meeting_address || lead?.address || "");
    setNote("");
    setError("");
  }, [lead?.id, lead?.meeting_address, lead?.address, initialOutcome]);

  if (!lead) return null;
  const available = allowedOutcomes(lead.status, lead.meeting_at);
  const selectedOutcome = outcome && available.includes(outcome) ? outcome : null;

  async function submit() {
    if (!selectedOutcome || busy) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/leads/outcome", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        leadId: lead!.id,
        outcome: selectedOutcome,
        callbackAt,
        meetingAt,
        address,
        note
      })
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string; redirect?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error || "Nie udało się zapisać wyniku.");
      return;
    }
    await onCompleted();
    onClose();
    if (result.redirect) router.push(result.redirect);
  }

  return (
    <ModalShell
      open
      onClose={() => !busy && onClose()}
      title={`Wynik kontaktu · ${lead.full_name}`}
      description="Zapisz wynik bez otwierania pełnej karty klienta."
      size="sm"
      footer={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" className="btn-secondary min-h-11" onClick={onClose} disabled={busy}>Anuluj</button>
          <button type="button" className="btn-primary min-h-11" onClick={submit} disabled={!selectedOutcome || busy}>
            {busy ? "Zapisywanie…" : selectedOutcome === "contract" ? "Zapisz i otwórz umowę" : "Zapisz"}
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        {!initialOutcome ? (
          <div className="grid grid-cols-2 gap-2">
            {available.map((key) => {
              const Icon = actions[key].icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setOutcome(key); setError(""); }}
                  className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-bold transition active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${selectedOutcome === key ? "border-ink bg-ink text-white shadow-sm" : "border-line bg-white text-ink hover:border-ink"}`}
                >
                  <Icon className="h-4 w-4 flex-none" aria-hidden="true" />
                  {actions[key].label}
                </button>
              );
            })}
          </div>
        ) : null}

        {selectedOutcome === "callback" ? (
          <div className="grid gap-3">
            <label>
              <span className="label">Termin call-backu</span>
              <input className="field min-h-11" type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} required />
            </label>
            <div>
              <span className="label">Szybko ustaw</span>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" className="btn-secondary min-h-10 px-2 text-xs" onClick={() => setCallbackAt(callbackPreset(1))}>Jutro</button>
                <button type="button" className="btn-secondary min-h-10 px-2 text-xs" onClick={() => setCallbackAt(callbackPreset(3))}>+3 dni</button>
                <button type="button" className="btn-secondary min-h-10 px-2 text-xs" onClick={() => setCallbackAt(callbackPreset(7))}>+7 dni</button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedOutcome === "meeting" ? (
          <>
            <label><span className="label">Termin spotkania</span><input className="field min-h-11" type="datetime-local" value={meetingAt} onChange={(event) => setMeetingAt(event.target.value)} required /></label>
            <label><span className="label">Adres spotkania</span><input className="field min-h-11" value={address} onChange={(event) => setAddress(event.target.value)} required /></label>
          </>
        ) : null}

        {selectedOutcome && selectedOutcome !== "no_answer" ? (
          <label>
            <span className="label">
              {selectedOutcome === "return"
                ? "Powód zwrotu / komentarz"
                : selectedOutcome === "resignation"
                  ? "Powód rezygnacji"
                  : selectedOutcome === "contract"
                    ? "Notatka po spotkaniu"
                    : "Komentarz (opcjonalnie)"}
            </span>
            <textarea
              className="field min-h-24 resize-y"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={selectedOutcome === "callback" ? "Np. klient czeka na wypłatę i prosi o telefon za tydzień" : undefined}
              required={["return", "resignation", "contract"].includes(selectedOutcome)}
            />
          </label>
        ) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </ModalShell>
  );
}
