"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  FileSignature,
  FileText,
  Hammer,
  Loader2,
  ReceiptText,
  Save,
  Send,
  Truck
} from "lucide-react";
import { jsPDF } from "jspdf";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { StatTile } from "@/components/stat-tile";
import {
  buildAnnexText,
  buildInvoiceDraft,
  DEMO_DOCUMENTS,
  formatMoney,
  type DemoDocumentType,
  type ExtractedDocumentData
} from "@/lib/demo-documents";
import { ROLE_LABELS } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { Lead } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type OperationState = {
  documentAccepted: boolean;
  managerApproved: boolean;
  accountingAccepted: boolean;
  invoiceIssued: boolean;
  ksefPrepared: boolean;
  logisticsOrdered: boolean;
  installationDate: string;
  installerAccepted: boolean;
  completed: boolean;
};

type OperationLead = Pick<
  Lead,
  "id" | "full_name" | "phone" | "address" | "postal_code" | "contract_number" | "updated_at"
> & {
  assigned_profile?: Lead["assigned_profile"];
};

type AnnexInputState = {
  panelCount: number;
  installationPowerKw: number;
  grossPrice: number;
  financing: string;
};

const STORAGE_KEY = "bcrm-realizacja";

const defaultState: OperationState = {
  documentAccepted: false,
  managerApproved: false,
  accountingAccepted: false,
  invoiceIssued: false,
  ksefPrepared: false,
  logisticsOrdered: false,
  installationDate: "",
  installerAccepted: false,
  completed: false
};

const demoLead: OperationLead = {
  id: "demo-realizacja",
  full_name: "Jan Nowak",
  phone: "501 202 303",
  address: "ul. Słoneczna 14, 20-001 Lublin",
  postal_code: "20-001",
  contract_number: "B/2026/041",
  updated_at: new Date().toISOString(),
  assigned_profile: {
    id: "demo-handlowiec",
    email: "demo-handlowiec@example.com",
    full_name: "Demo Handlowiec",
    role: "handlowiec"
  }
};

function readStoredStates() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, OperationState>;
  } catch {
    return {};
  }
}

function stageLabel(state: OperationState) {
  if (state.completed) return "Zamknięte";
  if (state.installerAccepted) return "Po montażu";
  if (state.logisticsOrdered) return "Montaż";
  if (state.invoiceIssued) return "Logistyka";
  if (state.managerApproved) return "Księgowość";
  if (state.documentAccepted) return "Akceptacja";
  return "Dokumenty";
}

function mergeState(state?: Partial<OperationState>): OperationState {
  return { ...defaultState, ...state };
}

export default function OperationsPage() {
  const { loading, profile } = useAuth(["admin", "menadzer", "handlowiec", "ksiegowosc", "logistyk", "monter"]);
  const [leads, setLeads] = useState<OperationLead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState(demoLead.id);
  const [states, setStates] = useState<Record<string, OperationState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [processingDoc, setProcessingDoc] = useState<DemoDocumentType | null>(null);
  const [fileImportMessage, setFileImportMessage] = useState<string>("");
  const [fileImportError, setFileImportError] = useState<string>("");
  const [fileProcessing, setFileProcessing] = useState(false);
  const [documentData, setDocumentData] = useState<ExtractedDocumentData>(DEMO_DOCUMENTS.contract);
  const [manualAnnex, setManualAnnex] = useState("");
  const [annexInput, setAnnexInput] = useState<AnnexInputState>({
    panelCount: DEMO_DOCUMENTS.contract.panelCount,
    installationPowerKw: DEMO_DOCUMENTS.contract.installationPowerKw,
    grossPrice: DEMO_DOCUMENTS.contract.grossPrice,
    financing: DEMO_DOCUMENTS.contract.financing
  });

  async function loadContractLeads() {
    setBusy(true);
    setError("");

    const { data, error: leadsError } = await supabase
      .from("leads")
      .select("id,full_name,phone,address,postal_code,contract_number,updated_at,assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role)")
      .eq("status", "Umowa")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (leadsError) {
      setError(leadsError.message);
      setLeads([demoLead]);
    } else {
      const contractLeads = ((data || []) as unknown as OperationLead[]).map((lead) => ({
        ...lead,
        assigned_profile: Array.isArray(lead.assigned_profile)
          ? lead.assigned_profile[0] || null
          : lead.assigned_profile || null
      }));
      const nextLeads = contractLeads.length > 0 ? contractLeads : [demoLead];
      setLeads(nextLeads);
      setSelectedLeadId((current) => (nextLeads.some((lead) => lead.id === current) ? current : nextLeads[0].id));
    }

    setBusy(false);
  }

  useEffect(() => {
    setStates(readStoredStates());
    loadContractLeads();
  }, []);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || leads[0] || demoLead;
  const selectedState = mergeState(states[selectedLead.id]);
  const canEditAnnex = profile?.role !== "monter";

  const invoice = useMemo(
    () =>
      buildInvoiceDraft({
        buyerName: documentData.clientName || selectedLead.full_name,
        buyerAddress: documentData.address || selectedLead.address || "",
        contractNumber: selectedLead.contract_number || documentData.contractNumber,
        grossPrice: documentData.grossPrice
      }),
    [documentData, selectedLead]
  );

  const annexText = useMemo(
    () =>
      buildAnnexText({
        clientName: documentData.clientName || selectedLead.full_name,
        contractNumber: selectedLead.contract_number || documentData.contractNumber,
        panelCount: annexInput.panelCount,
        installationPowerKw: annexInput.installationPowerKw,
        grossPrice: annexInput.grossPrice,
        financing: annexInput.financing,
        manualText: manualAnnex
      }),
    [annexInput, documentData, manualAnnex, selectedLead]
  );

  const stats = useMemo(() => {
    const operationStates = leads.map((lead) => mergeState(states[lead.id]));
    return {
      contracts: leads.length,
      manager: operationStates.filter((state) => state.documentAccepted && !state.managerApproved).length,
      accounting: operationStates.filter((state) => state.documentAccepted && state.managerApproved && !state.logisticsOrdered).length,
      logistics: operationStates.filter((state) => state.managerApproved && !state.logisticsOrdered).length,
      installation: operationStates.filter((state) => state.logisticsOrdered && !state.completed).length
    };
  }, [leads, states]);

  function saveState(nextState: OperationState) {
    const nextStates = { ...states, [selectedLead.id]: nextState };
    setStates(nextStates);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStates));
  }

  function patchSelectedState(patch: Partial<OperationState>) {
    saveState({ ...selectedState, ...patch });
  }

  function loadDemoDocument(type: DemoDocumentType) {
    setProcessingDoc(type);
    setFileImportMessage("Wczytuję dokument demo i analizuję dane...");
    setFileImportError("");
    window.setTimeout(() => {
      const nextData = DEMO_DOCUMENTS[type];
      setDocumentData(nextData);
      setAnnexInput({
        panelCount: nextData.panelCount,
        installationPowerKw: nextData.installationPowerKw,
        grossPrice: nextData.grossPrice,
        financing: nextData.financing
      });
      setFileImportMessage(`Wczytano plik demo: ${nextData.sourceName}. System automatycznie rozpoznał dane klienta.`);
      setProcessingDoc(null);
    }, 650);
  }

  type BooleanOperationStateKey = Exclude<keyof OperationState, "installationDate">;

  function updateStage(key: BooleanOperationStateKey, value: boolean) {
    const next = { ...selectedState };

    if (key === "documentAccepted" && !value) {
      next.managerApproved = false;
      next.accountingAccepted = false;
      next.invoiceIssued = false;
      next.ksefPrepared = false;
      next.logisticsOrdered = false;
      next.installerAccepted = false;
      next.completed = false;
    }

    if (key === "managerApproved" && !value) {
      next.accountingAccepted = false;
      next.invoiceIssued = false;
      next.ksefPrepared = false;
      next.logisticsOrdered = false;
      next.installerAccepted = false;
      next.completed = false;
    }

    if (key === "logisticsOrdered" && !value) {
      next.invoiceIssued = false;
      next.ksefPrepared = false;
      next.installerAccepted = false;
      next.completed = false;
    }

    if (key === "installerAccepted" && !value) {
      next.completed = false;
    }

    if (key === "invoiceIssued" && !value) {
      next.ksefPrepared = false;
    }

    next[key] = value;
    if (key === "completed" && value) {
      next.installerAccepted = true;
    }

    saveState(next);
  }

  function downloadAnnexPdf() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = 40;

    doc.setFontSize(14);
    doc.text(`ANEKS do umowy ${selectedLead.contract_number || documentData.contractNumber}`, margin, y);
    y += 28;
    doc.setFontSize(11);

    const lines = annexText.split("\n");
    lines.forEach((line) => {
      const split = doc.splitTextToSize(line, pageWidth - margin * 2);
      doc.text(split, margin, y);
      y += split.length * 14;
      if (y > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        y = 40;
      }
    });

    doc.save(`aneks-${selectedLead.contract_number || documentData.contractNumber}.pdf`);
  }

  async function handleAgreementFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setFileImportError("Wybierz plik PDF.");
      return;
    }

    setFileProcessing(true);
    setFileImportError("");
    setFileImportMessage(`Rozpoczynam analizę pliku: ${file.name}`);

    window.setTimeout(() => {
      const nextData = DEMO_DOCUMENTS.contract;
      setDocumentData(nextData);
      setAnnexInput({
        panelCount: nextData.panelCount,
        installationPowerKw: nextData.installationPowerKw,
        grossPrice: nextData.grossPrice,
        financing: nextData.financing
      });
      setFileImportMessage(`Analiza zakończona. Wyodrębniono dane z umowy: ${nextData.sourceName}.`);
      setFileProcessing(false);
      setTimeout(() => setFileImportMessage(""), 8000);
    }, 1200);
  }

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="section-title">Realizacja</h1>
            <p className="mt-1 text-sm text-muted">
              Umowa po sprzedaży: akceptacja, faktura, logistyka i montaż.
            </p>
          </div>
          <div className="rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-muted">
            Rola: {ROLE_LABELS[profile.role]}
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Umowy" value={stats.contracts} icon={FileSignature} tone="leaf" />
          <StatTile label="Akceptacje" value={stats.manager} icon={ClipboardCheck} tone="sky" />
          <StatTile label="Księgowość" value={stats.accounting} icon={ReceiptText} tone="warn" />
          <StatTile label="Logistyka" value={stats.logistics} icon={Truck} tone="sky" />
          <StatTile label="Montaż" value={stats.installation} icon={Hammer} tone="leaf" />
        </section>

        {error ? (
          <div className="rounded-md border border-warn/20 bg-warn/10 p-3 text-sm font-semibold text-warn">
            Widok działa na danych demo, bo baza zwróciła: {error}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-ink">Kolejka umów</h2>
              {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" /> : null}
            </div>
            <div className="grid gap-2">
              {leads.map((lead) => {
                const state = mergeState(states[lead.id]);
                const active = selectedLead.id === lead.id;

                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`rounded-md border p-3 text-left transition ${
                      active ? "border-ink bg-ink text-white" : "border-line bg-panel text-ink hover:border-ink"
                    }`}
                  >
                    <span className="block text-sm font-black">{lead.full_name}</span>
                    <span className={`mt-1 block text-xs font-semibold ${active ? "text-white/80" : "text-muted"}`}>
                      {lead.contract_number || "bez numeru"} · {stageLabel(state)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-ink">{selectedLead.full_name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {selectedLead.phone} · {selectedLead.address || "brak adresu"} · {selectedLead.contract_number || "bez numeru"}
                </p>
              </div>
              {selectedLead.id !== demoLead.id ? (
                <Link href={`/leads/${selectedLead.id}`} className="btn-secondary">
                  Karta leada
                </Link>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-5">
              <StepTile active={selectedState.documentAccepted} label="Dokumenty" icon={FileSearch} />
              <StepTile active={selectedState.managerApproved} label="Menadżer" icon={BadgeCheck} />
              <StepTile active={selectedState.logisticsOrdered} label="Logistyka" icon={Truck} />
              <StepTile active={selectedState.completed} label="Montaż" icon={Hammer} />
              <StepTile active={selectedState.accountingAccepted} label="Księgowość" icon={ReceiptText} />
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <ActionButton
                label="Zatwierdź dane z dokumentów"
                done={selectedState.documentAccepted}
                onClick={() => updateStage("documentAccepted", !selectedState.documentAccepted)}
              />
              <ActionButton
                label="Akceptacja menadżera"
                done={selectedState.managerApproved}
                onClick={() => updateStage("managerApproved", !selectedState.managerApproved)}
              />
              <ActionButton
                label="Księgowość widzi klienta"
                done={selectedState.accountingAccepted}
                onClick={() => updateStage("accountingAccepted", !selectedState.accountingAccepted)}
              />
              <ActionButton
                label="Zamów komplet logistyczny"
                done={selectedState.logisticsOrdered}
                onClick={() => updateStage("logisticsOrdered", !selectedState.logisticsOrdered)}
              />
              <ActionButton
                label="Potwierdź montaż"
                done={selectedState.installationDate !== "" && selectedState.installerAccepted}
                onClick={() => updateStage("installerAccepted", !selectedState.installerAccepted)}
              />
              <ActionButton
                label="Wystaw fakturę"
                done={selectedState.invoiceIssued}
                onClick={() => updateStage("invoiceIssued", !selectedState.invoiceIssued)}
              />
              <ActionButton
                label="Przygotuj paczkę KSeF"
                done={selectedState.ksefPrepared}
                onClick={() => updateStage("ksefPrepared", !selectedState.ksefPrepared)}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <label>
                <span className="label">Termin montażu</span>
                <input
                  className="field"
                  type="datetime-local"
                  value={selectedState.installationDate}
                  onChange={(event) => patchSelectedState({ installationDate: event.target.value })}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => patchSelectedState({ installerAccepted: true })}
                  className="btn-secondary w-full"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Potwierdź
                </button>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => patchSelectedState({ installerAccepted: true, completed: true })}
                  className="btn-primary w-full"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg border border-line bg-panel p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky/10 text-sky">
                <FileSearch className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Demo: odczyt dokumentów</h2>
                <p className="mt-1 text-sm text-muted">Rekruter może przejść proces bez własnego pliku PDF.</p>
              </div>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-2 rounded-md border border-line bg-panel p-4">
                <span className="label">Dodaj plik umowy (PDF)</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleAgreementFileChange}
                  className="field"
                />
                <p className="text-sm text-muted">
                  W demo plik jest analizowany i od razu wyświetlamy realną umowę oraz odczytane dane.
                </p>
              </label>
              {fileImportMessage ? (
                <div className="rounded-md border border-sky/20 bg-sky/10 p-3 text-sm text-sky">
                  {fileImportMessage}
                </div>
              ) : null}
              {fileImportError ? (
                <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
                  {fileImportError}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => loadDemoDocument("contract")} className="btn-secondary">
                  {processingDoc === "contract" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Wczytaj umowę demo
                </button>
                <button type="button" onClick={() => loadDemoDocument("credit")} className="btn-secondary">
                  {processingDoc === "credit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                  Wczytaj wniosek kredytowy
                </button>
                <button
                  type="button"
                  onClick={() => patchSelectedState({ documentAccepted: true })}
                  className="btn-primary"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Zastosuj do realizacji
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DataField label="Źródło" value={documentData.sourceName} />
              <DataField label="Klient" value={documentData.clientName} />
              <DataField label="Telefon" value={documentData.phone} />
              <DataField label="PESEL" value={documentData.pesel} />
              <DataField label="Adres" value={documentData.address} />
              <DataField label="Nr umowy" value={documentData.contractNumber} />
              <DataField label="Moc" value={`${documentData.installationPowerKw.toFixed(2)} kWp`} />
              <DataField label="Panele" value={`${documentData.panelCount} x ${documentData.panelPowerWp} W`} />
              <DataField label="Cena brutto" value={formatMoney(documentData.grossPrice)} />
              <DataField label="Finansowanie" value={documentData.financing} />
            </div>

            <div className="mt-4 rounded-md border border-line bg-panel/80 p-3">
              <div className="text-sm font-black text-ink">Notatki automatyczne</div>
              <ul className="mt-2 grid gap-1 text-sm text-muted">
                {documentData.notes.map((note) => (
                  <li key={note}>- {note}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-bold text-ink">Faktura i KSeF</h2>
            </div>

            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
                <div>
                  <div className="text-xs font-bold uppercase text-muted">Faktura VAT</div>
                  <div className="text-lg font-black text-ink">{invoice.number}</div>
                </div>
                <div className="text-right text-xs text-muted">{invoice.issueDate}</div>
              </div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <DataField label="Sprzedawca" value={`${invoice.sellerName}, NIP ${invoice.sellerNip}`} />
                <DataField label="Nabywca" value={`${invoice.buyerName}, ${invoice.buyerAddress}`} />
              </div>
              <div className="mt-3 overflow-hidden rounded-md border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel/80 text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Pozycja</th>
                      <th className="px-3 py-2 text-right">Netto</th>
                      <th className="px-3 py-2 text-right">VAT</th>
                      <th className="px-3 py-2 text-right">Brutto</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 font-semibold">{invoice.itemName}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(invoice.net)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(invoice.vat)}</td>
                      <td className="px-3 py-2 text-right font-black">{formatMoney(invoice.gross)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-warn/20 bg-warn/10 p-3 text-sm text-[#8a5a00]">
              Wysyłka do KSeF jest tu makietą procesu. Rzeczywista integracja wymaga konfiguracji firmy,
              uprawnień, certyfikatów i potwierdzenia zgodności księgowo-prawnej.
            </div>

            <button
              type="button"
              onClick={() => patchSelectedState({ invoiceIssued: true, ksefPrepared: true })}
              className="btn-primary mt-3"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Przygotuj do KSeF
            </button>
          </div>
        </section>

        {canEditAnnex && (
          <section className="rounded-lg border border-line bg-panel p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-solar/20 text-[#8a5a00]">
                <FileSignature className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Generator aneksu</h2>
                <p className="mt-1 text-sm text-muted">Automatycznie z danych oferty albo ręcznie z własnym tekstem.</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <label>
                  <span className="label">Liczba paneli</span>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    value={annexInput.panelCount}
                    onChange={(event) => setAnnexInput((current) => ({ ...current, panelCount: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  <span className="label">Moc instalacji kWp</span>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    step={0.01}
                    value={annexInput.installationPowerKw}
                    onChange={(event) =>
                      setAnnexInput((current) => ({ ...current, installationPowerKw: Number(event.target.value) }))
                    }
                  />
                </label>
                <label>
                  <span className="label">Cena brutto</span>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    value={annexInput.grossPrice}
                    onChange={(event) => setAnnexInput((current) => ({ ...current, grossPrice: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  <span className="label">Finansowanie</span>
                  <select
                    className="field"
                    value={annexInput.financing}
                    onChange={(event) => setAnnexInput((current) => ({ ...current, financing: event.target.value }))}
                  >
                    <option>Kredyt</option>
                    <option>Gotówka</option>
                    <option>Kredyt z wkładem własnym</option>
                    <option>Częściowo kredyt, częściowo gotówka</option>
                  </select>
                </label>
                <label>
                  <span className="label">Tekst ręczny opcjonalnie</span>
                  <textarea
                    className="field min-h-28"
                    value={manualAnnex}
                    onChange={(event) => setManualAnnex(event.target.value)}
                    placeholder="Jeśli wpiszesz treść, zastąpi automatyczny aneks."
                  />
                </label>
              </div>

              <div className="rounded-lg border border-line bg-panel p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-black uppercase text-muted">Podgląd aneksu</div>
                  <button type="button" onClick={downloadAnnexPdf} className="btn-secondary no-print">
                    Pobierz PDF aneksu
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-ink">{annexText}</pre>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function StepTile({ active, label, icon: Icon }: { active: boolean; label: string; icon: typeof ClipboardCheck }) {
  return (
    <div className={`rounded-md border p-3 ${active ? "border-leaf/30 bg-leaf/10 text-leaf" : "border-line bg-panel/80 text-muted"}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <div className="mt-2 text-xs font-black uppercase">{label}</div>
    </div>
  );
}

function ActionButton({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${
        done ? "border-leaf/30 bg-leaf/10 text-leaf" : "border-line bg-panel text-ink hover:border-ink"
      }`}
    >
      <span className="text-sm font-bold">{label}</span>
      {done ? <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden="true" /> : <span className="text-xs font-semibold text-muted">Zrób</span>}
    </button>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel/80 p-3">
      <div className="label">{label}</div>
      <div className="text-sm font-semibold text-ink">{value || "—"}</div>
    </div>
  );
}
