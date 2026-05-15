"use client";

import { FormEvent, useState } from "react";
import { Loader2, Save } from "lucide-react";

type DailyReportFormProps = {
  userId: string;
  reportDate: string;
  token: string;
  onSaved?: () => void;
};

export function DailyReportForm({
  userId,
  reportDate,
  token,
  onSaved
}: DailyReportFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [totalLeadsWorked, setTotalLeadsWorked] = useState("0");
  const [callsMade, setCallsMade] = useState("0");
  const [meetingsScheduled, setMeetingsScheduled] = useState("0");
  const [contractsSigned, setContractsSigned] = useState("0");
  const [resignationsRecorded, setResignationsRecorded] = useState("0");
  const [summary, setSummary] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/leads/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          report_date: reportDate,
          total_leads_worked: parseInt(totalLeadsWorked, 10) || 0,
          total_activities:
            parseInt(callsMade, 10) +
            parseInt(meetingsScheduled, 10) +
            parseInt(contractsSigned, 10) +
            parseInt(resignationsRecorded, 10),
          calls_made: parseInt(callsMade, 10) || 0,
          meetings_scheduled: parseInt(meetingsScheduled, 10) || 0,
          contracts_signed: parseInt(contractsSigned, 10) || 0,
          resignations_recorded: parseInt(resignationsRecorded, 10) || 0,
          summary: summary || null
        })
      });

      if (!response.ok) {
        throw new Error("Nie udało się zapisać raportu");
      }

      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-line bg-surface p-5 shadow-sm space-y-4">
      {error && (
        <div className="rounded-lg bg-danger/10 p-3 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <label>
          <span className="text-xs font-medium text-muted block mb-1">
            Leady pracowane
          </span>
          <input
            type="number"
            min="0"
            value={totalLeadsWorked}
            onChange={(e) => setTotalLeadsWorked(e.target.value)}
            className="w-full px-3 py-2 rounded border border-line text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium text-muted block mb-1">
            Rozmowy
          </span>
          <input
            type="number"
            min="0"
            value={callsMade}
            onChange={(e) => setCallsMade(e.target.value)}
            className="w-full px-3 py-2 rounded border border-line text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium text-muted block mb-1">
            Spotkania
          </span>
          <input
            type="number"
            min="0"
            value={meetingsScheduled}
            onChange={(e) => setMeetingsScheduled(e.target.value)}
            className="w-full px-3 py-2 rounded border border-line text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium text-muted block mb-1">
            Umowy
          </span>
          <input
            type="number"
            min="0"
            value={contractsSigned}
            onChange={(e) => setContractsSigned(e.target.value)}
            className="w-full px-3 py-2 rounded border border-line text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium text-muted block mb-1">
            Rezygnacje
          </span>
          <input
            type="number"
            min="0"
            value={resignationsRecorded}
            onChange={(e) => setResignationsRecorded(e.target.value)}
            className="w-full px-3 py-2 rounded border border-line text-sm"
          />
        </label>
      </div>

      <label>
        <span className="text-xs font-medium text-muted block mb-1">
          Notatki
        </span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="w-full px-3 py-2 rounded border border-line text-sm min-h-20"
          placeholder="Opcjonalne - dodaj notatki do raportu dnia"
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 rounded bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky/90 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Zapisz raport
      </button>
    </form>
  );
}
