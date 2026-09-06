"use client";

import { useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  FileSignature,
  MessageSquareText,
  Phone,
  PhoneOff,
  UserX
} from "lucide-react";
import { allowedOutcomes, type LeadOutcome } from "@/lib/lead-outcomes";
import { normalizePhoneForDial } from "@/lib/phone";
import type { Lead } from "@/lib/types";

type Variant = "card" | "compact";

export function LeadFastActions({
  lead,
  accessToken,
  variant = "card",
  onPreset,
  onComments,
  onChanged
}: {
  lead: Lead;
  accessToken: string;
  variant?: Variant;
  onPreset: (lead: Lead, outcome: LeadOutcome) => void;
  onComments: (lead: Lead) => void;
  onChanged?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const outcomes = allowedOutcomes(lead.status, lead.meeting_at);
  const dial = normalizePhoneForDial(lead.phone);
  const compact = variant === "compact";
  const base = compact
    ? "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold shadow-sm transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black shadow-sm transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50";

  async function noAnswer() {
    if (busy) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/leads/outcome", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ leadId: lead.id, outcome: "no_answer" })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || "Nie udało się zapisać statusu.");
    else {
      window.dispatchEvent(new Event("leads:changed"));
      await onChanged?.();
    }
    setBusy(false);
  }

  const buttons = (
    <>
      {dial ? (
        <a href={`tel:${dial}`} className={`${base} border-ink/15 bg-ink text-white hover:bg-[#222b3d]`}>
          <Phone className="h-4 w-4 flex-none" aria-hidden="true" />
          Zadzwoń
        </a>
      ) : null}

      {outcomes.includes("no_answer") ? (
        <button type="button" onClick={noAnswer} disabled={busy} className={`${base} border-warn/20 bg-warn/10 text-warn hover:border-warn/40`}>
          <PhoneOff className="h-4 w-4 flex-none" aria-hidden="true" />
          {busy ? "Zapisuję…" : "Nie odbiera"}
        </button>
      ) : null}

      {outcomes.includes("callback") ? (
        <button type="button" onClick={() => onPreset(lead, "callback")} className={`${base} border-sky/20 bg-sky/10 text-sky hover:border-sky/40`}>
          <CalendarClock className="h-4 w-4 flex-none" aria-hidden="true" />
          Call back
        </button>
      ) : null}

      {outcomes.includes("meeting") ? (
        <button type="button" onClick={() => onPreset(lead, "meeting")} className={`${base} border-leaf/20 bg-leaf/10 text-leaf hover:border-leaf/40`}>
          <CalendarPlus className="h-4 w-4 flex-none" aria-hidden="true" />
          Spotkanie
        </button>
      ) : null}

      {outcomes.includes("contract") ? (
        <button type="button" onClick={() => onPreset(lead, "contract")} className={`${base} border-ink/15 bg-ink/5 text-ink hover:border-ink/40`}>
          <FileSignature className="h-4 w-4 flex-none" aria-hidden="true" />
          Umowa
        </button>
      ) : null}

      <button type="button" onClick={() => onComments(lead)} className={`${base} border-line bg-white text-ink hover:border-sky/40 hover:bg-sky/5`}>
        <MessageSquareText className="h-4 w-4 flex-none" aria-hidden="true" />
        Komentarze
      </button>

      {outcomes.includes("resignation") ? (
        <button type="button" onClick={() => onPreset(lead, "resignation")} className={`${base} border-danger/20 bg-danger/5 text-danger hover:border-danger/40 hover:bg-danger/10`}>
          <UserX className="h-4 w-4 flex-none" aria-hidden="true" />
          Rezygnacja
        </button>
      ) : null}
    </>
  );

  return (
    <div className="min-w-0">
      {error ? <div className="mb-2 rounded-lg border border-danger/20 bg-danger/5 px-2.5 py-2 text-xs font-bold text-danger">{error}</div> : null}
      <div className={compact ? "flex min-w-0 flex-wrap gap-1.5" : "grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3"}>
        {buttons}
      </div>
    </div>
  );
}
