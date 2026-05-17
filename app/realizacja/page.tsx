"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileDigit,
  FileSignature,
  FolderKanban,
  Hammer,
  PackageCheck,
  ReceiptText,
  Send,
  Sparkles,
  Truck,
  Upload,
  X,
  UsersRound
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import {
  annexChangeOptions,
  contractFieldLabels,
  creditFieldLabels,
  demoContractData,
  demoCreditData,
  ksefDisclaimer,
  type DemoCustomerRecord
} from "@/lib/demo-documents";
import { canUseOperations, ROLE_LABELS } from "@/lib/roles";
import { downloadAnnexPdf, downloadInvoicePdf, type AnnexValues } from "@/lib/pdf-documents";
import type { UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type WorkflowStatus = "pending" | "active" | "done";
type KsefAction = "prepare_accounting_package" | "send_ksef_invoice";
type KsefModal = {
  mode: "demo" | "live" | "error";
  sent: boolean;
  title: string;
  message: string;
  status?: number;
  payload: unknown;
  response?: string;
};

const initialWorkflow = {
  sales: "done" as WorkflowStatus,
  manager: "active" as WorkflowStatus,
  accounting: "pending" as WorkflowStatus,
  logistics: "pending" as WorkflowStatus,
  installer: "pending" as WorkflowStatus
};

const workflowSteps = [
  { key: "sales", label: "Handlowiec", ownerRole: "handlowiec", icon: FileSignature },
  { key: "manager", label: "Menadżer", ownerRole: "menadzer", icon: UsersRound },
  { key: "accounting", label: "Księgowość", ownerRole: "ksiegowosc", icon: Calculator },
  { key: "logistics", label: "Logistyka", ownerRole: "logistyk", icon: Truck },
  { key: "installer", label: "Monter", ownerRole: "monter", icon: Hammer }
] as const;

const contractFields: Array<keyof DemoCustomerRecord> = [
  "contractNumber",
  "contractDate",
  "sellerName",
  "companyName",
  "companyNip",
  "clientName",
  "phone",
  "email",
  "address",
  "postalCode",
  "city",
  "pesel",
  "identityDocument",
  "installationPowerKw",
  "panelsCount",
  "inverterModel",
  "netPrice",
  "grossPrice",
  "financing",
  "creditInstallment",
  "montageDate",
  "warehouseNote"
];

const emptyContractData: DemoCustomerRecord = {
  contractNumber: "",
  contractDate: "",
  sellerName: "",
  companyName: "",
  companyNip: "",
  clientName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  postalCode: "",
  pesel: "",
  identityDocument: "",
  installationPowerKw: "",
  panelsCount: "",
  inverterModel: "",
  netPrice: "",
  grossPrice: "",
  financing: "",
  creditInstallment: "",
  montageDate: "",
  warehouseNote: ""
};

type WorkflowKey = (typeof workflowSteps)[number]["key"];

function statusClasses(status: WorkflowStatus) {
  if (status === "done") return "border-leaf/25 bg-leaf/10 text-leaf";
  if (status === "active") return "border-sky/25 bg-sky/10 text-sky";
  return "border-line bg-white text-muted";
}

function statusLabel(status: WorkflowStatus) {
  if (status === "done") return "Wykonane";
  if (status === "active") return "Do akcji";
  return "Czeka";
}

function canControlStep(role: UserRole, ownerRole: UserRole) {
  return role === "owner" || role === "admin" || role === ownerRole;
}

function canUseAccountingTools(role: UserRole) {
  return role === "owner" || role === "admin" || role === "ksiegowosc";
}

function annexValuesFromContract(record: DemoCustomerRecord): AnnexValues {
  return {
    panelsCount: record.panelsCount,
    installationPowerKw: record.installationPowerKw,
    grossPrice: record.grossPrice,
    financing: record.financing
  };
}

function isContractReady(record: DemoCustomerRecord) {
  return Boolean(record.contractNumber && record.clientName && record.address && record.grossPrice);
}

function ContractPreview({ record, title }: { record: DemoCustomerRecord; title: string }) {
  return (
    <div className="rounded-2xl border border-line bg-[#eef3f8] p-4">
      <div className="mx-auto aspect-[1/1.414] max-h-[720px] w-full max-w-[510px] overflow-hidden rounded-lg border border-line bg-white p-6 shadow-sm">
        <div className="border-b border-line pb-4">
          <div className="h-1.5 w-20 rounded-full bg-solar" />
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-black text-ink">B-CRM</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
            </div>
            <div className="text-right text-xs text-muted">
              <div>{record.contractNumber || "Numer umowy"}</div>
              <div>{record.contractDate || "Data umowy"}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Klient</div>
            <div className="mt-1 text-lg font-black text-ink">{record.clientName || "Imię i nazwisko klienta"}</div>
            <div className="text-muted">
              {record.address || "Adres inwestycji"}, {record.postalCode || "00-000"} {record.city || "Miasto"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PreviewField label="Moc" value={record.installationPowerKw ? `${record.installationPowerKw} kW` : "-"} />
            <PreviewField label="Panele" value={record.panelsCount || "-"} />
            <PreviewField label="Cena brutto" value={record.grossPrice || "-"} />
            <PreviewField label="Finansowanie" value={record.financing || "-"} />
          </div>

          <div className="rounded-lg border border-line bg-[#f9fbfd] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Falownik</div>
            <div className="mt-1 font-bold text-ink">{record.inverterModel || "-"}</div>
          </div>

          <div className="rounded-lg border border-line bg-[#f9fbfd] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Uwagi realizacyjne</div>
            <div className="mt-1 text-muted">{record.warehouseNote || "-"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-[#f9fbfd] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-bold text-ink">{value}</div>
    </div>
  );
}

export default function RealizacjaPage() {
  const { loading, profile, session } = useAuth([
    "owner",
    "admin",
    "menadzer",
    "handlowiec",
    "ksiegowosc",
    "logistyk",
    "monter"
  ]);
  const [contractData, setContractData] = useState<DemoCustomerRecord>(emptyContractData);
  const [previewRecord, setPreviewRecord] = useState<DemoCustomerRecord | null>(null);
  const [previewTitle, setPreviewTitle] = useState("Podgląd umowy");
  const [contractFileName, setContractFileName] = useState("");
  const [creditLoaded, setCreditLoaded] = useState(false);
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [ksefReady, setKsefReady] = useState(false);
  const [invoiceReady, setInvoiceReady] = useState(false);
  const [annexMode, setAnnexMode] = useState<"manual" | "automatic">("automatic");
  const [selectedChanges, setSelectedChanges] = useState<string[]>([
    "Zmiana liczby paneli",
    "Zmiana finansowania"
  ]);
  const [annexValues, setAnnexValues] = useState<AnnexValues>(annexValuesFromContract(demoContractData));
  const [documentBusy, setDocumentBusy] = useState<"annex" | "invoice" | null>(null);
  const [integrationBusy, setIntegrationBusy] = useState<KsefAction | null>(null);
  const [integrationModal, setIntegrationModal] = useState<KsefModal | null>(null);
  const [documentMessage, setDocumentMessage] = useState("");
  const contractInputRef = useRef<HTMLInputElement | null>(null);

  const currentRoleLabel = profile ? ROLE_LABELS[profile.role] : "";
  const accountingToolsAllowed = profile ? canUseAccountingTools(profile.role) : false;
  const contractReady = isContractReady(contractData);

  const completion = useMemo(() => {
    const values = Object.values(workflow);
    return Math.round((values.filter((value) => value === "done").length / values.length) * 100);
  }, [workflow]);

  if (loading || !profile) return <LoadingScreen />;
  if (!canUseOperations(profile.role)) return <LoadingScreen />;

  function updateContractField(key: keyof DemoCustomerRecord, value: string) {
    const next = { ...contractData, [key]: value };
    setContractData(next);

    if (key === "panelsCount" || key === "installationPowerKw" || key === "grossPrice" || key === "financing") {
      setAnnexValues(annexValuesFromContract(next));
    }
  }

  function showDemoContract() {
    setPreviewRecord(demoContractData);
    setPreviewTitle("Umowa demo");
    setDocumentMessage("");
  }

  function fillDemoContract() {
    setContractData(demoContractData);
    setAnnexValues(annexValuesFromContract(demoContractData));
    setPreviewRecord(demoContractData);
    setPreviewTitle("Umowa demo");
    setDocumentMessage("Wprowadzono dane demo do formularza.");
  }

  function showCurrentContractPreview() {
    setPreviewRecord(contractData);
    setPreviewTitle("Podgląd z danych formularza");
  }

  function addContractFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setContractFileName(file.name);
    setDocumentMessage(`Dodano umowę: ${file.name}. Plik jest gotowy do powiązania z rekordem klienta.`);
    event.target.value = "";
  }

  function toggleChange(option: string) {
    setSelectedChanges((current) =>
      current.includes(option) ? current.filter((value) => value !== option) : [...current, option]
    );
  }

  function moveWorkflow(step: WorkflowKey) {
    setWorkflow((current) => {
      const next = { ...current };
      next[step] = next[step] === "done" ? "active" : "done";
      return next;
    });
  }

  async function generateAnnex() {
    if (!accountingToolsAllowed || documentBusy) return;
    const sourceData = contractReady ? contractData : demoContractData;
    setDocumentBusy("annex");
    setDocumentMessage("");

    try {
      await downloadAnnexPdf(sourceData, annexValues, selectedChanges, annexMode);
      setDocumentMessage("Aneks PDF został wygenerowany.");
    } catch (error) {
      setDocumentMessage(error instanceof Error ? error.message : "Nie udało się wygenerować aneksu PDF.");
    } finally {
      setDocumentBusy(null);
    }
  }

  async function generateInvoice() {
    if (!accountingToolsAllowed || documentBusy) return;
    setDocumentBusy("invoice");
    setDocumentMessage("");

    try {
      await downloadInvoicePdf(contractReady ? contractData : demoContractData);
      setDocumentMessage("Faktura PDF została wygenerowana.");
    } catch (error) {
      setDocumentMessage(error instanceof Error ? error.message : "Nie udało się wygenerować faktury PDF.");
    } finally {
      setDocumentBusy(null);
    }
  }

  async function runKsefAction(action: KsefAction) {
    if (!accountingToolsAllowed || integrationBusy || !session) return;

    setIntegrationBusy(action);
    setDocumentMessage("");

    try {
      const response = await fetch("/api/integrations/ksef", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action,
          contract: contractReady ? contractData : demoContractData
        })
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || body.message || "Nie udało się obsłużyć integracji KSeF.");
      }

      if (action === "prepare_accounting_package") setInvoiceReady(true);
      if (action === "send_ksef_invoice") setKsefReady(true);
      setIntegrationModal(body as KsefModal);
    } catch (error) {
      setIntegrationModal({
        mode: "error",
        sent: false,
        title: "Integracja KSeF",
        message: error instanceof Error ? error.message : "Nieznany błąd integracji.",
        payload: null
      });
    } finally {
      setIntegrationBusy(null);
    }
  }

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <section className="rounded-lg border border-line bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-sky/15 bg-sky/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Realizacja po umowie
              </div>
              <h1 className="section-title">Panel realizacji</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted">
                Operacyjny widok dla działów odpowiedzialnych za umowę, rozliczenie, kompletację i montaż.
                Dane można wprowadzić ręcznie, dodać plik umowy i zaprezentować na bezpiecznym zestawie demo.
              </p>
            </div>
            <div className="grid gap-2 rounded-lg border border-line bg-[#f8fafc] px-4 py-3 text-sm sm:min-w-[260px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Zalogowana rola</span>
                <span className="font-bold text-ink">{currentRoleLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Postęp realizacji</span>
                <span className="font-bold text-ink">{completion}%</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky/10 text-sky">
                <FolderKanban className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Dane umowy</h2>
                <p className="mt-1 text-sm text-muted">
                  Wprowadź dane produkcyjne albo użyj danych demo do prezentacji.
                </p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={showDemoContract} className="btn-secondary">
                <Eye className="h-4 w-4" aria-hidden="true" />
                Pokaż umowę demo
              </button>
              <button type="button" onClick={fillDemoContract} className="btn-secondary">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Wprowadź dane demo
              </button>
              <button
                type="button"
                onClick={showCurrentContractPreview}
                disabled={!contractReady}
                className="btn-secondary"
              >
                <FileSignature className="h-4 w-4" aria-hidden="true" />
                Podgląd z formularza
              </button>
              <input
                ref={contractInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={addContractFile}
              />
              <button
                type="button"
                onClick={() => contractInputRef.current?.click()}
                className="btn-primary"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Dodaj umowę PDF
              </button>
            </div>

            {contractFileName ? (
              <div className="mb-4 rounded-md border border-sky/20 bg-sky/10 p-3 text-sm font-semibold text-sky">
                Dodana umowa: {contractFileName}
              </div>
            ) : null}

            {documentMessage ? (
              <div className="mb-4 rounded-md border border-leaf/20 bg-leaf/10 p-3 text-sm font-semibold text-leaf">
                {documentMessage}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {contractFields.map((field) => (
                <label key={field}>
                  <span className="label">{contractFieldLabels[field]}</span>
                  <input
                    className="field"
                    value={contractData[field]}
                    onChange={(event) => updateContractField(field, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Workflow działów</h2>
                <p className="mt-1 text-sm text-muted">Kontrola etapów od sprzedaży do montażu.</p>
              </div>
            </div>

            <div className="grid gap-3">
              {workflowSteps.map((item) => {
                const Icon = item.icon;
                const workflowKey = item.key;
                const canControl = canControlStep(profile.role, item.ownerRole);
                const status = workflow[workflowKey];

                return (
                  <div
                    key={item.key}
                    className={`grid gap-3 rounded-lg border px-4 py-3 transition sm:grid-cols-[1fr_auto] sm:items-center ${statusClasses(
                      status
                    )}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/70">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{item.label}</span>
                        <span className="block text-xs">
                          {statusLabel(status)} · {ROLE_LABELS[item.ownerRole]}
                        </span>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => moveWorkflow(workflowKey)}
                      disabled={!canControl}
                      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition ${
                        canControl
                          ? "bg-white text-ink shadow-sm hover:border hover:border-ink"
                          : "cursor-not-allowed border border-line bg-white/40 text-muted opacity-70"
                      }`}
                    >
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {status === "done" ? "Cofnij" : "Oznacz"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-solar/15 text-[#aa6f00]">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Paczka księgowa</h2>
                <p className="mt-1 text-sm text-muted">
                  Dane rozliczeniowe przygotowane na podstawie aktualnej umowy.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-[#fbfcfe] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewField label="Nabywca" value={contractData.clientName || demoContractData.clientName} />
                <PreviewField label="Kwota brutto" value={contractData.grossPrice || demoContractData.grossPrice} />
                <PreviewField label="Cena netto" value={contractData.netPrice || demoContractData.netPrice} />
                <PreviewField label="Numer umowy" value={contractData.contractNumber || demoContractData.contractNumber} />
              </div>

              <button
                type="button"
                onClick={() => runKsefAction("prepare_accounting_package")}
                disabled={!accountingToolsAllowed}
                className="btn-primary mt-4"
              >
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
                {integrationBusy === "prepare_accounting_package"
                  ? "Przygotowanie"
                  : invoiceReady
                    ? "Paczka gotowa"
                    : accountingToolsAllowed
                      ? "Przygotuj paczkę księgową"
                      : "Tylko księgowość"}
              </button>
              {accountingToolsAllowed ? (
                <button
                  type="button"
                  onClick={generateInvoice}
                  disabled={Boolean(documentBusy)}
                  className="btn-secondary mt-3"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {documentBusy === "invoice" ? "Generowanie" : "Pobierz fakturę PDF"}
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky/10 text-sky">
                <FileDigit className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">KSeF</h2>
                <p className="mt-1 text-sm text-muted">Przygotowanie danych do wysyłki faktury ustrukturyzowanej.</p>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-[#f9fbfd] p-4 text-sm text-muted">
              {ksefDisclaimer}
            </div>

            <button
              type="button"
              onClick={() => runKsefAction("send_ksef_invoice")}
              disabled={!accountingToolsAllowed}
              className="btn-secondary mt-4"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {integrationBusy === "send_ksef_invoice"
                ? "Łączenie"
                : ksefReady
                  ? "KSeF sprawdzony"
                  : accountingToolsAllowed
                    ? "Wyślij do KSeF"
                    : "Tylko księgowość"}
            </button>
          </section>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <FileSignature className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Generator aneksu</h2>
                <p className="mt-1 text-sm text-muted">
                  Aneks generuje się jako PDF z danych aktualnej umowy i wskazanych zmian.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={generateAnnex}
              disabled={!accountingToolsAllowed || Boolean(documentBusy)}
              className="btn-primary"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {documentBusy === "annex" ? "Generowanie" : "Pobierz aneks PDF"}
            </button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAnnexMode("automatic")}
                  disabled={!accountingToolsAllowed}
                  className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                    annexMode === "automatic" ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"
                  }`}
                >
                  Tryb automatyczny
                </button>
                <button
                  type="button"
                  onClick={() => setAnnexMode("manual")}
                  disabled={!accountingToolsAllowed}
                  className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                    annexMode === "manual" ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"
                  }`}
                >
                  Tryb ręczny
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                {annexChangeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleChange(option)}
                    disabled={!accountingToolsAllowed}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${
                      selectedChanges.includes(option)
                        ? "border-leaf/30 bg-leaf/10 text-leaf"
                        : "border-line bg-white text-ink"
                    }`}
                  >
                    {option}
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="label">Liczba paneli</span>
                  <input
                    className="field"
                    value={annexValues.panelsCount}
                    disabled={!accountingToolsAllowed}
                    onChange={(event) =>
                      setAnnexValues((current) => ({ ...current, panelsCount: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span className="label">Moc instalacji</span>
                  <input
                    className="field"
                    value={annexValues.installationPowerKw}
                    disabled={!accountingToolsAllowed}
                    onChange={(event) =>
                      setAnnexValues((current) => ({
                        ...current,
                        installationPowerKw: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  <span className="label">Cena brutto</span>
                  <input
                    className="field"
                    value={annexValues.grossPrice}
                    disabled={!accountingToolsAllowed}
                    onChange={(event) =>
                      setAnnexValues((current) => ({ ...current, grossPrice: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span className="label">Finansowanie</span>
                  <input
                    className="field"
                    value={annexValues.financing}
                    disabled={!accountingToolsAllowed}
                    onChange={(event) =>
                      setAnnexValues((current) => ({ ...current, financing: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="mt-4 rounded-lg border border-line bg-[#f9fbfd] p-4 text-sm text-muted">
                <div className="font-semibold text-ink">
                  Tryb: {annexMode === "automatic" ? "automatyczny" : "ręczny"}
                </div>
                <div className="mt-2">Zmiany: {selectedChanges.join(", ") || "brak wybranych zmian"}</div>
                <div className="mt-2">
                  Nowa konfiguracja: {annexValues.panelsCount || "-"} paneli, {annexValues.installationPowerKw || "-"} kW,
                  {` `}{annexValues.grossPrice || "-"}, {annexValues.financing || "-"}.
                </div>
              </div>
            </div>
          </div>
        </section>

        {creditLoaded ? (
          <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-ink">Dane finansowania</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(demoCreditData).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-line bg-[#f9fbfd] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {creditFieldLabels[key as keyof typeof demoCreditData]}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
              <UsersRound className="h-4 w-4 text-sky" aria-hidden="true" />
              Menadżer
            </div>
            <p className="text-sm text-muted">Akceptuje kompletność danych i przekazuje sprawę do realizacji.</p>
          </div>
          <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
              <PackageCheck className="h-4 w-4 text-solar" aria-hidden="true" />
              Logistyka
            </div>
            <p className="text-sm text-muted">Widzi moc, liczbę paneli, sprzęt, uwagi magazynowe i termin montażu.</p>
          </div>
          <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
              <Hammer className="h-4 w-4 text-leaf" aria-hidden="true" />
              Monter
            </div>
            <p className="text-sm text-muted">Pracuje na gotowym rekordzie z adresem, terminem i specyfikacją instalacji.</p>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="button" onClick={() => setCreditLoaded((value) => !value)} className="btn-secondary">
            <FileDigit className="h-4 w-4" aria-hidden="true" />
            {creditLoaded ? "Ukryj finansowanie demo" : "Pokaż finansowanie demo"}
          </button>
        </div>

        {previewRecord ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f1724]/70 px-4 py-6">
            <section className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-soft">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-ink">{previewTitle}</h2>
                  <p className="text-sm text-muted">
                    Podgląd otwiera się w osobnym oknie, bez automatycznego pobierania danych klienta.
                  </p>
                </div>
                <button type="button" onClick={() => setPreviewRecord(null)} className="btn-secondary w-fit">
                  <X className="h-4 w-4" aria-hidden="true" />
                  Zamknij
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
                <ContractPreview record={previewRecord} title={previewTitle} />
                <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                  <h3 className="mb-4 text-base font-bold text-ink">Dane w podglądzie</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {contractFields.map((field) => (
                      <div key={field} className="rounded-lg border border-line bg-[#f9fbfd] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {contractFieldLabels[field]}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-ink">{previewRecord[field] || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {integrationModal ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f1724]/70 px-4 py-6">
            <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-line bg-white p-5 shadow-soft">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-ink">{integrationModal.title}</h2>
                  <p className="mt-1 text-sm text-muted">{integrationModal.message}</p>
                </div>
                <button type="button" onClick={() => setIntegrationModal(null)} className="btn-secondary w-fit">
                  <X className="h-4 w-4" aria-hidden="true" />
                  Zamknij
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <PreviewField label="Tryb" value={integrationModal.mode === "live" ? "Produkcja" : integrationModal.mode === "demo" ? "Demo" : "Błąd"} />
                <PreviewField label="Wysłano" value={integrationModal.sent ? "Tak" : "Nie"} />
                <PreviewField label="Status" value={integrationModal.status ? String(integrationModal.status) : "-"} />
              </div>
              <div className="mt-4 rounded-lg border border-line bg-[#f9fbfd] p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">Payload repozytorium</div>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink">
                  {JSON.stringify(integrationModal.payload, null, 2)}
                </pre>
              </div>
              {integrationModal.response ? (
                <div className="mt-4 rounded-lg border border-line bg-[#f9fbfd] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Odpowiedź API</div>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink">
                    {integrationModal.response}
                  </pre>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
