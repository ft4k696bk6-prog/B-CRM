"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, FileSignature, UserX } from "lucide-react";
import { Alert, ModalShell } from "@/components/ui";
import type { Lead } from "@/lib/types";
import type { LeadOutcome } from "@/lib/lead-outcomes";

const actionMeta: Record<Extract<LeadOutcome, "callback" | "meeting" | "contract" | "resignation">, { title: string; description: string; icon: typeof CalendarClock }> = {
  callback: {
    title: "Ustaw call-back",
    description: "Wybierz termin i wracaj od razu do kolejnego leada.",
    icon: CalendarClock
  },
  meeting: {
    title: "Umów spotkanie",
    description: "Termin i adres. Po zapisie wracasz do listy.",
    icon: CalendarPlus
  },
  contract: {
    title: "Przejdź do umowy",
    description: "Dodaj krótką notatkę po spotkaniu i otwórz formularz umowy.",
    icon: FileSignature
  },
  resignation: {
    title: "Rezygnacja",
    description: "Powód jest obowiązkowy i trafia do historii leada.",
    icon: UserX
  }
};

export function LeadFastActionDialog({
  lead,
  outcome,
  accessToken,
  onClose,
  onCompleted
}: {
  lead: Lead | null;
  outcome: Extract<LeadOutcome, "callback" | "meeting" | "contract" | "resignation"> | null;
  accessToken: string;
  onClose: () => void;
  onCompleted?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [callbackAt, setCallbackAt] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCallbackAt("");
    setMeetingAt("");
    setAddress(lead?.meeting_address || lead?.address || "");
    setNote("");
    setError("");
  }, [lead?.id, lead?.meeting_address, lead?.address, outcome]);

  if (!lead || !outcome) return null;
  const meta = actionMeta[outcome];
  const Icon = meta.icon;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");

    const response = await fetch("/api/leads/outcome", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        leadId: lead!.id,
        outcome,
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

    window.dispatchEvent(new Event("leads:changed"));
    await onCompleted?.();
    onClose();
    if (result.redirect) router.push(result.redirect);
  }

  return (
    <ModalShell
      open
      onClose={() => !busy && onClose()}
      title={`${meta.title} · ${lead.full_name}`}
      description={meta.description}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary min-h-11" onClick={onClose} disabled={busy}>Anuluj</button>
          <button type="button" className={outcome === "resignation" ? "btn-danger min-h-11" : "btn-primary min-h-11"} onClick={submit} disabled={busy}>
            {busy ? "Zapisywanie…" : outcome === "contract" ? "Zapisz i otwórz umowę" : "Zapisz"}
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-[#f8fafc] p-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white text-ink shadow-sm">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-black text-ink">{lead.full_name}</div>
            <div className="truncate text-xs font-semibold text-muted">{lead.phone}</div>
          </div>
        </div>

        {outcome === "callback" ? (
          <label>
            <span className="label">Termin call-backu</span>
            <input autoFocus className="field min-h-12" type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} required />
          </label>
        ) : null}

        {outcome === "meeting" ? (
          <>
            <label>
              <span className="label">Termin spotkania</span>
              <input autoFocus className="field min-h-12" type="datetime-local" value={meetingAt} onChange={(event) => setMeetingAt(event.target.value)} required />
            </label>
            <label>
              <span className="label">Adres spotkania</span>
              <input className="field min-h-12" value={address} onChange={(event) => setAddress(event.target.value)} required />
            </label>
          </>
        ) : null}

        {outcome === "resignation" || outcome === "contract" ? (
          <label>
            <span className="label">{outcome === "resignation" ? "Powód rezygnacji" : "Notatka po spotkaniu"}</span>
            <textarea
              autoFocus
              className="field min-h-28 resize-y"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={outcome === "resignation" ? "Np. nie jest zainteresowany / wybrał inną firmę…" : "Krótka informacja potrzebna do umowy…"}
              required
            />
          </label>
        ) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </ModalShell>
  );
}
