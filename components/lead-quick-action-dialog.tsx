"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, CalendarX, CheckCircle2, FileSignature, PhoneOff, RotateCcw, UserX } from "lucide-react";
import { Alert, ModalShell } from "@/components/ui";
import { allowedOutcomes, isAfterMeeting, type LeadOutcome } from "@/lib/lead-outcomes";
import type { Lead } from "@/lib/types";

const actions: Record<LeadOutcome, { label: string; icon: typeof CalendarClock }> = {
  callback: { label: "Call back", icon: CalendarClock },
  meeting: { label: "Spotkanie", icon: CalendarPlus },
  no_answer: { label: "Nie odbiera", icon: PhoneOff },
  return: { label: "Zwrot", icon: RotateCcw },
  contract: { label: "Umowa", icon: FileSignature },
  resignation: { label: "Rezygnacja", icon: UserX },
  meeting_no_show: { label: "Nie odbyło się", icon: CalendarX }
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
  const [meetingOccurred, setMeetingOccurred] = useState<boolean | null>(null);
  const [callbackAt, setCallbackAt] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const afterMeeting = lead ? isAfterMeeting(lead.status, lead.meeting_at) : false;
    setOutcome(initialOutcome);
    setMeetingOccurred(afterMeeting && initialOutcome ? true : null);
    setCallbackAt(initialOutcome === "callback" ? callbackPreset(1) : "");
    setMeetingAt("");
    setAddress(lead?.meeting_address || lead?.address || "");
    setNote("");
    setError("");
  }, [lead?.id, lead?.status, lead?.meeting_at, lead?.meeting_address, lead?.address, initialOutcome]);

  if (!lead) return null;
  const afterMeeting = isAfterMeeting(lead.status, lead.meeting_at);
  const available = allowedOutcomes(lead.status, lead.meeting_at);
  const visibleOutcomes = afterMeeting
    ? available.filter((key) => key !== "meeting_no_show")
    : available;
  const selectedOutcome = outcome && available.includes(outcome) ? outcome : null;
  const waitingForAttendance = afterMeeting && meetingOccurred === null && !initialOutcome;

  function chooseAttendance(occurred: boolean) {
    setMeetingOccurred(occurred);
    setError("");
    if (!occurred) {
      setOutcome("meeting_no_show");
      setNote("");
    } else if (outcome === "meeting_no_show") {
      setOutcome(null);
    }
  }

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
        callbackAt: callbackAt ? new Date(callbackAt).toISOString() : "",
        meetingAt: meetingAt ? new Date(meetingAt).toISOString() : "",
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
      title={afterMeeting ? `Rozlicz spotkanie · ${lead.full_name}` : `Wynik kontaktu · ${lead.full_name}`}
      description={afterMeeting ? "Najpierw potwierdź, czy spotkanie się odbyło, a potem wybierz dalszy krok." : "Zapisz wynik bez otwierania pełnej karty klienta."}
      size="sm"
      footer={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" className="btn-secondary min-h-11" onClick={onClose} disabled={busy}>Anuluj</button>
          {!waitingForAttendance ? (
            <button type="button" className="btn-primary min-h-11" onClick={submit} disabled={!selectedOutcome || busy}>
              {busy ? "Zapisywanie…" : selectedOutcome === "contract" ? "Zapisz i otwórz umowę" : "Zapisz"}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-4">
        {waitingForAttendance ? (
          <div className="grid gap-3">
            <div className="rounded-xl border border-line bg-[#f8fafc] p-3 text-sm font-semibold text-ink">
              Czy spotkanie faktycznie się odbyło?
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink hover:border-ink"
                onClick={() => chooseAttendance(true)}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Tak, odbyło się
              </button>
              <button
                type="button"
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink hover:border-ink"
                onClick={() => chooseAttendance(false)}
              >
                <CalendarX className="h-4 w-4" aria-hidden="true" />
                Nie odbyło się
              </button>
            </div>
          </div>
        ) : null}

        {afterMeeting && meetingOccurred === false ? (
          <Alert tone="warn">
            Lead zostanie ustawiony jako <strong>Nowy</strong>, ale pozostanie u Ciebie do końca dnia. Możesz od razu ponownie zadzwonić, ustawić call back, nowe spotkanie albo zwrócić go ręcznie. Jeśli nic nie zrobisz, nocny reset odbierze go o 22:00 (jeśli masz włączone automatyczne zabieranie).
          </Alert>
        ) : null}

        {(!afterMeeting || meetingOccurred === true || initialOutcome) && !initialOutcome ? (
          <div className="grid grid-cols-2 gap-2">
            {visibleOutcomes.map((key) => {
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

        {selectedOutcome && selectedOutcome !== "no_answer" && selectedOutcome !== "meeting_no_show" ? (
          <label>
            <span className="label">
              {afterMeeting
                ? "Notatka po spotkaniu"
                : selectedOutcome === "return"
                  ? "Powód zwrotu / komentarz"
                  : selectedOutcome === "resignation"
                    ? "Powód rezygnacji"
                    : "Komentarz (opcjonalnie)"}
            </span>
            <textarea
              className="field min-h-24 resize-y"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={selectedOutcome === "callback" ? "Np. klient czeka na wypłatę i prosi o telefon za tydzień" : undefined}
              required={afterMeeting || ["return", "resignation"].includes(selectedOutcome)}
            />
          </label>
        ) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </ModalShell>
  );
}
