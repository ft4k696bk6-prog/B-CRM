"use client";

import { useState } from "react";
import { Archive, CalendarDays, PackageCheck, RotateCcw } from "lucide-react";
import { Alert, ModalShell } from "@/components/ui";
import type { ContractRecord } from "@/lib/contracts";
import { isArchived, type ArchiveReason, type WorkflowField } from "@/lib/contract-workflow";
import { formatDateTime, toDatetimeLocalValue } from "@/lib/date";

export function WorkflowCheckbox({ contract, field, label, busy, onChange }: {
  contract: ContractRecord; field: WorkflowField; label: string; busy: boolean;
  onChange: (contract: ContractRecord, field: WorkflowField, value: boolean) => void;
}) {
  return <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg hover:bg-sky/10">
    <input type="checkbox" className="h-5 w-5 cursor-pointer accent-sky"
      aria-label={`${label}: ${contract.customer_name}`}
      title={field === "verified" ? "Kontakt działu weryfikacji zakończony zgodą klienta na realizację" : field === "settled" ? "Klient zapłacił całą kwotę" : label}
      checked={contract.workflow?.[field] === true}
      disabled={busy || isArchived(contract) || contract.submission_status !== "submitted" || !contract.workflow}
      onChange={(event) => onChange(contract, field, event.target.checked)} />
  </label>;
}

export function ContractPublicProgress({ contract }: { contract: ContractRecord }) {
  return <div className="flex flex-wrap gap-2 text-xs font-semibold">
    {contract.equipment_ordered ? <span className="inline-flex items-center gap-1 rounded-md bg-leaf/10 px-2 py-1 text-leaf"><PackageCheck className="h-3.5 w-3.5" />Sprzęt zamówiony</span> : null}
    {contract.installation_scheduled && contract.installation_at ? <span className="inline-flex items-center gap-1 rounded-md bg-sky/10 px-2 py-1 text-sky"><CalendarDays className="h-3.5 w-3.5" />Montaż: {formatDateTime(contract.installation_at)}</span> : null}
    {!contract.equipment_ordered && !contract.installation_scheduled ? <span className="text-muted">Oczekuje na realizację</span> : null}
  </div>;
}

export function ContractArchiveButton({ contract, busy, onArchive, onRestore }: {
  contract: ContractRecord; busy: boolean;
  onArchive: (contract: ContractRecord) => void; onRestore: (contract: ContractRecord) => void;
}) {
  return isArchived(contract)
    ? <button type="button" className="btn-secondary whitespace-nowrap text-xs" disabled={busy} onClick={() => onRestore(contract)}><RotateCcw className="h-4 w-4" />Przywróć</button>
    : <button type="button" className="btn-secondary whitespace-nowrap text-xs" disabled={busy || !contract.workflow} onClick={() => onArchive(contract)}><Archive className="h-4 w-4" />Archiwizuj</button>;
}

export function useContractWorkflowActions({ accessToken, onUpdated, onStale }: {
  accessToken: string; onUpdated: (contract: ContractRecord) => void; onStale: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState<ContractRecord | null>(null);
  const [date, setDate] = useState("");
  const [archive, setArchive] = useState<ContractRecord | null>(null);
  const [reason, setReason] = useState<ArchiveReason | "">("");

  async function mutate(contract: ContractRecord, command: Record<string, unknown>) {
    if (busy || !accessToken || !contract.workflow) return false;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: contract.id, expected_version: contract.workflow.version, ...command }),
      });
      const body = await response.json();
      if (!response.ok || !body.contract) {
        if (response.status === 409) { onStale(); setSchedule(null); setArchive(null); }
        throw new Error(body.error || "Nie udało się zapisać zmiany.");
      }
      onUpdated(body.contract);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Nie udało się zapisać zmiany. Spróbuj ponownie.");
      return false;
    } finally { setBusy(false); }
  }

  function openSchedule(contract: ContractRecord) {
    setError(""); setDate(toDatetimeLocalValue(contract.installation_at)); setSchedule(contract);
  }

  function setField(contract: ContractRecord, field: WorkflowField, value: boolean) {
    if (field === "installation_scheduled" && value) return openSchedule(contract);
    void mutate(contract, { action: "workflow", field, value });
  }

  const dialogs = <>
    <ModalShell open={Boolean(schedule)} title="Umów montaż" description={schedule?.customer_name} size="sm" onClose={() => !busy && setSchedule(null)}>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (!schedule || !date || Number.isNaN(Date.parse(date))) return;
        if (await mutate(schedule, { action: "workflow", field: "installation_scheduled", value: true, installation_at: new Date(date).toISOString() })) setSchedule(null);
      }} className="grid gap-4">
        <label><span className="label">Termin montażu</span><input autoFocus required className="field" type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <button className="btn-primary" disabled={busy || !date}>{busy ? "Zapisywanie…" : "Zapisz termin montażu"}</button>
      </form>
    </ModalShell>
    <ModalShell open={Boolean(archive)} title="Przenieś umowę do archiwum" description={archive?.customer_name} size="sm" onClose={() => !busy && setArchive(null)}>
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        if (archive && reason && await mutate(archive, { action: "archive", reason })) setArchive(null);
      }}>
        <label className="flex min-h-12 items-start gap-3 rounded-lg border border-line p-3">
          <input className="mt-1 h-4 w-4 accent-sky" type="radio" name="archiveReason" value="settled" checked={reason === "settled"} disabled={!archive?.workflow?.settled} onChange={() => setReason("settled")} />
          <span><b>Rozliczona</b><span className="block text-xs text-muted">{archive?.workflow?.settled ? "Klient zapłacił całość." : "Najpierw zaznacz „Rozliczona” przy umowie."}</span></span>
        </label>
        <label className="flex min-h-12 items-center gap-3 rounded-lg border border-line p-3">
          <input className="h-4 w-4 accent-sky" type="radio" name="archiveReason" value="resigned" checked={reason === "resigned"} onChange={() => setReason("resigned")} /><b>Rezygnacja</b>
        </label>
        <p className="text-xs text-muted">Umowę możesz później przywrócić. Zaznaczenia i termin montażu zostaną zachowane.</p>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <button className="btn-primary" disabled={busy || !reason}>{busy ? "Przenoszenie…" : "Przenieś do archiwum"}</button>
      </form>
    </ModalShell>
  </>;

  return {
    busy, error, dialogs, setField, openSchedule,
    openArchive(contract: ContractRecord) { setError(""); setReason(contract.workflow?.settled ? "settled" : ""); setArchive(contract); },
    restore(contract: ContractRecord) { void mutate(contract, { action: "restore" }); },
  };
}
