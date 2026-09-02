"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, FileSignature, PhoneOff, RotateCcw, UserX } from "lucide-react";
import { Alert, ModalShell } from "@/components/ui";
import { allowedOutcomes, type LeadOutcome } from "@/lib/lead-outcomes";
import type { Lead } from "@/lib/types";

const actions: Record<LeadOutcome, { label: string; icon: typeof CalendarClock }> = {
  callback: { label: "Nowy call-back", icon: CalendarClock },
  meeting: { label: "Umów spotkanie", icon: CalendarPlus },
  no_answer: { label: "Nie odbiera", icon: PhoneOff },
  return: { label: "Zwróć lead", icon: RotateCcw },
  contract: { label: "Przejdź do umowy", icon: FileSignature },
  resignation: { label: "Rezygnacja", icon: UserX }
};

export function LeadQuickActionDialog({ lead, accessToken, onClose, onCompleted }: {
  lead: Lead | null;
  accessToken: string;
  onClose: () => void;
  onCompleted: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<LeadOutcome | null>(null);
  const [callbackAt, setCallbackAt] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOutcome(null);
    setCallbackAt("");
    setMeetingAt("");
    setAddress(lead?.meeting_address || lead?.address || "");
    setNote("");
    setError("");
  }, [lead?.id, lead?.meeting_address, lead?.address]);

  if (!lead) return null;
  const available = allowedOutcomes(lead.status, lead.meeting_at);

  async function submit() {
    if (!outcome || busy) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/leads/outcome", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ leadId: lead!.id, outcome, callbackAt, meetingAt, address, note })
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
      description="Wybierz wynik i uzupełnij wymagane informacje. Zapis trafi do historii leada."
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary min-h-11" onClick={onClose} disabled={busy}>Anuluj</button>
          <button type="button" className="btn-primary min-h-11" onClick={submit} disabled={!outcome || busy}>
            {busy ? "Zapisywanie…" : outcome === "contract" ? "Zapisz i otwórz umowę" : "Zapisz wynik"}
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2">
          {available.map((key) => {
            const Icon = actions[key].icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setOutcome(key); setError(""); }}
                className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${outcome === key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}
              >
                <Icon className="h-4 w-4 flex-none" aria-hidden="true" />
                {actions[key].label}
              </button>
            );
          })}
        </div>

        {outcome === "callback" ? <label><span className="label">Nowy termin call-backu</span><input className="field min-h-11" type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} required /></label> : null}
        {outcome === "meeting" ? <>
          <label><span className="label">Termin spotkania</span><input className="field min-h-11" type="datetime-local" value={meetingAt} onChange={(event) => setMeetingAt(event.target.value)} required /></label>
          <label><span className="label">Adres spotkania</span><input className="field min-h-11" value={address} onChange={(event) => setAddress(event.target.value)} required /></label>
        </> : null}
        {outcome === "return" || outcome === "resignation" || outcome === "contract" ? (
          <label>
            <span className="label">{outcome === "return" ? "Powód zwrotu / notatka" : outcome === "resignation" ? "Powód rezygnacji" : "Notatka po spotkaniu"}</span>
            <textarea className="field min-h-24 resize-y" value={note} onChange={(event) => setNote(event.target.value)} required />
          </label>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </ModalShell>
  );
}
