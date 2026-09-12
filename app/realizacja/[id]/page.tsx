"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileSignature, MessageSquarePlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ContractAttachments } from "@/components/contract-attachments";
import { ContractArchiveButton, ContractPublicProgress, useContractWorkflowActions, WorkflowCheckbox } from "@/components/contract-workflow-controls";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, ModalShell, PageHeader, SectionHeader } from "@/components/ui";
import type { ContractRecord } from "@/lib/contracts";
import { canManageContractWorkflow, isArchived, needsScheduling, WORKFLOW_CHECKBOXES } from "@/lib/contract-workflow";
import { formatDate, formatDateTime } from "@/lib/date";
import { useAuth } from "@/lib/use-auth";

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const { loading, profile, session } = useAuth();
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [contractLoading, setContractLoading] = useState(true);
  const [error, setError] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setContractLoading(true); setError("");
    try {
      const response = await fetch(`/api/contracts?id=${id}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.contract) throw new Error(body.error || "Nie znaleziono umowy albo nie masz do niej dostępu.");
      setContract(body.contract);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Nie udało się pobrać umowy."); }
    finally { setContractLoading(false); }
  }, [session?.access_token, id]);
  useEffect(() => { void load(); }, [load]);
  const workflow = useContractWorkflowActions({ accessToken: session?.access_token || "", onUpdated: setContract, onStale: () => { void load(); } });

  async function saveNote() {
    if (!session || !privateNote.trim() || noteBusy) return;
    setNoteBusy(true); setError("");
    try {
      const response = await fetch("/api/contracts", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ id, management_note: privateNote }) });
      const body = await response.json();
      if (!response.ok || !body.contract) throw new Error(body.error || "Nie udało się zapisać notatki.");
      setContract(body.contract); setPrivateNote("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Nie udało się zapisać notatki."); }
    finally { setNoteBusy(false); }
  }

  if (loading || !profile || contractLoading) return <LoadingScreen />;
  if (!contract) return <AppShell profile={profile}><div className="grid gap-4"><Alert tone="danger">{error || "Nie znaleziono umowy."}</Alert><Link href="/realizacja/umowy" className="btn-secondary justify-self-start">Wróć do umów</Link></div></AppShell>;
  const admin = canManageContractWorkflow(profile.role);
  const canEdit = admin || profile.role === "menadzer" || (profile.role === "handlowiec" && contract.created_by === profile.id && contract.submission_status === "draft");
  const canManageAttachments = admin || (profile.role === "menadzer" && contract.submission_status === "submitted");
  const details = [
    ["Telefon", contract.phone || "—"], ["E-mail", contract.email || "—"], ["Podpisana", formatDate(contract.signed_at)],
    ["Handlowiec", contract.creator?.full_name || "Nieprzypisane"],
    ["Kwota brutto", Number(contract.gross_amount) > 0 ? `${Number(contract.gross_amount).toLocaleString("pl-PL")} zł` : "Brak kwoty"],
    ["Adres", [contract.street, contract.house_number, contract.postal_code, contract.city].filter(Boolean).join(" ") || "—"],
  ];
  const equipment = [
    ["Zestaw", String(contract.product_type) === "other" ? "—" : contract.product_type],
    ["Moc PV", contract.pv_power_kwp ? `${contract.pv_power_kwp} kWp` : "—"],
    ["Magazyn energii", contract.storage_capacity_kwh ? `${contract.storage_capacity_kwh} kWh` : "—"],
    ["Panele", contract.panels_count ? `${contract.panels_count} szt. × ${contract.panel_power_wp || "—"} Wp` : "—"],
    ["Falownik", contract.has_inverter ? `${contract.inverter_power_kw || "—"} kW` : "Bez falownika"],
    ["Miejsce montażu", contract.mounting_locations?.join(", ") || "—"],
    ["Optymalizatory", String(contract.optimizer_count || 0)], ["Back-up", contract.backup_power ? "Tak" : "Nie"],
    ["Ochrona przepięciowa", contract.surge_protection ? "Tak" : "Nie"], ["Uziemienie", contract.grounding ? "Tak" : "Nie"],
  ];

  return <AppShell profile={profile}><div className="grid gap-5">
    <Link href={isArchived(contract) ? "/realizacja/archiwum" : "/realizacja/umowy"} className="text-sm font-semibold text-sky">← Wróć do {isArchived(contract) ? "archiwum" : "umów"}</Link>
    <PageHeader title={contract.customer_name} description={contract.contract_number} actions={<>
      <ContractAttachments contract={contract} accessToken={session?.access_token || ""} mode="viewer" />
      {canManageAttachments ? <button className="btn-secondary" onClick={() => setAttachmentsOpen(true)}>Dodaj załączniki</button> : null}
      {canEdit ? <Link className="btn-primary" href={`/realizacja/nowa?contractId=${contract.id}`}>{contract.submission_status === "draft" ? "Uzupełnij wersję roboczą" : "Edytuj dane"}</Link> : null}
    </>} />
    {error || workflow.error ? <Alert tone="danger">{error || workflow.error}</Alert> : null}
    {isArchived(contract) ? <Alert tone={contract.archive_reason === "resigned" ? "warning" : "success"}>Archiwum · {contract.archive_reason === "resigned" ? "Rezygnacja" : "Rozliczona"}</Alert> : null}
    {admin && needsScheduling(contract) ? <Alert tone="warning">Dział weryfikacji potwierdził realizację. Umowa wymaga umówienia montażu.</Alert> : null}
    <section className="app-card"><SectionHeader icon={FileSignature} title="Realizacja" />
      {admin ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{WORKFLOW_CHECKBOXES.map(([field, label]) => <div className="flex items-center gap-2 rounded-lg border border-line p-2" key={field}><WorkflowCheckbox contract={contract} field={field} label={label} busy={workflow.busy} onChange={workflow.setField} /><span className="text-sm font-semibold">{label}</span></div>)}</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-sm">Termin montażu: <b>{contract.installation_scheduled ? formatDateTime(contract.installation_at) : "Nie umówiono"}</b>{contract.installation_scheduled && !isArchived(contract) ? <button className="ml-3 min-h-10 text-sky" disabled={workflow.busy} onClick={() => workflow.openSchedule(contract)}>Zmień termin</button> : null}</div><ContractArchiveButton contract={contract} busy={workflow.busy} onArchive={workflow.openArchive} onRestore={workflow.restore} /></div>
      </> : <ContractPublicProgress contract={contract} />}
    </section>
    <section className="app-card"><SectionHeader title="Dane umowy" /><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{details.map(([label, value]) => <div key={label}><dt className="label">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl></section>
    <section className="app-card"><SectionHeader title="Instalacja i sprzęt" /><dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{equipment.map(([label, value]) => <div key={label} className="rounded-lg border border-line p-3"><dt className="label">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>{contract.additional_notes ? <p className="mt-4 whitespace-pre-wrap text-sm">{contract.additional_notes}</p> : null}</section>
    {admin ? <section className="app-card"><SectionHeader icon={MessageSquarePlus} title="Notatki wewnętrzne" /><div className="grid gap-2">{(contract.management_notes || []).map((note) => <div key={note.id} className="rounded-lg border border-line p-3"><b>{note.author}</b><p className="whitespace-pre-wrap">{note.content}</p><small className="text-muted">{formatDateTime(note.created_at)}</small></div>)}</div><label className="mt-4 block"><span className="label">Nowa notatka</span><textarea className="field" value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} /></label><button className="btn-primary mt-3" disabled={noteBusy || !privateNote.trim()} onClick={() => void saveNote()}>{noteBusy ? "Zapisywanie…" : "Dodaj notatkę"}</button></section> : null}
    <ModalShell open={attachmentsOpen && canManageAttachments} title="Dodaj załączniki do umowy" description={contract.customer_name} size="xl" onClose={() => setAttachmentsOpen(false)}><ContractAttachments contract={contract} accessToken={session?.access_token || ""} mode="manage" onUploaded={(files) => setContract((current) => current ? { ...current, files: [...(current.files || []), ...files] } : current)} /></ModalShell>
    {workflow.dialogs}
  </div></AppShell>;
}
