"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  ClipboardCheck,
  FileDigit,
  FileSignature,
  Hammer,
  Landmark,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Save,
  Truck,
  Warehouse
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useLanguage } from "@/components/language-provider";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, ModalShell, PageHeader, SectionHeader } from "@/components/ui";
import { demoContractData, demoCreditData } from "@/lib/demo-documents";
import {
  calculateFinanceSimulation,
  defaultDepartmentState,
  departmentStateStorageKeyFor,
  documentNumber,
  parseMoneyValue,
  readDepartmentState,
  saveDepartmentState,
  type DepartmentProcessState
} from "@/lib/department-state";
import {
  contractDataFromProcess,
  formatProcessDate,
  workflowCompletion,
  workflowSteps,
  type WorkflowKey
} from "@/lib/process-workspace";
import { isSystemAdminRole, ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useProcessWorkspace } from "@/lib/use-process-workspace";

type DepartmentKind = "finance" | "accounting" | "equipment" | "logistics" | "installation";

type DepartmentModal = {
  title: string;
  description: string;
  rows: Array<{ label: string; value: string }>;
} | null;

type DepartmentConfig = {
  titlePl: string;
  titleEn: string;
  descriptionPl: string;
  descriptionEn: string;
  eyebrowPl: string;
  eyebrowEn: string;
  tourId: string;
  allowedRoles: UserRole[];
};

const departmentConfigs: Record<DepartmentKind, DepartmentConfig> = {
  finance: {
    titlePl: "Finanse",
    titleEn: "Finance",
    descriptionPl: "Finansowanie klienta, decyzja bankowa i kwoty z aktualnej umowy.",
    descriptionEn: "Client financing, bank decision and contract amounts in one workspace.",
    eyebrowPl: "Dział finansowy",
    eyebrowEn: "Finance team",
    tourId: "tour-finance",
    allowedRoles: ["owner", "admin", "finance"]
  },
  accounting: {
    titlePl: "Księgowość",
    titleEn: "Accounting",
    descriptionPl: "Paczka księgowa, faktura, KSeF i aneks na danych zatwierdzonej umowy.",
    descriptionEn: "Accounting package, invoice, KSeF and annex data from the approved contract.",
    eyebrowPl: "Rozliczenia",
    eyebrowEn: "Settlements",
    tourId: "tour-accounting",
    allowedRoles: ["owner", "admin", "ksiegowosc"]
  },
  equipment: {
    titlePl: "Sprzęt i magazyn",
    titleEn: "Equipment and warehouse",
    descriptionPl: "Sprzęt z umowy, kompletacja, PZ i rezerwacja WZ do dnia montażu.",
    descriptionEn: "Contract equipment, picking, goods receipt and issue reservation.",
    eyebrowPl: "Magazyn",
    eyebrowEn: "Warehouse",
    tourId: "tour-equipment",
    allowedRoles: ["owner", "admin", "logistyk"]
  },
  logistics: {
    titlePl: "Logistyka",
    titleEn: "Logistics",
    descriptionPl: "Koordynacja terminu, dostawy, kompletacji i przekazania sprawy monterom.",
    descriptionEn: "Delivery, picking and handoff coordination for installation teams.",
    eyebrowPl: "Operacje",
    eyebrowEn: "Operations",
    tourId: "tour-logistics",
    allowedRoles: ["owner", "admin", "logistyk"]
  },
  installation: {
    titlePl: "Montaż",
    titleEn: "Installation",
    descriptionPl: "Adres, termin, specyfikacja i finalne potwierdzenie prac w terenie.",
    descriptionEn: "Address, date, specification and final field-work confirmation.",
    eyebrowPl: "Ekipa terenowa",
    eyebrowEn: "Field team",
    tourId: "tour-installation",
    allowedRoles: ["owner", "admin", "monter"]
  }
};

const workflowLabels = {
  pl: {
    sales: "Sprzedaż",
    manager: "Menadżer",
    accounting: "Księgowość",
    logistics: "Logistyka",
    installer: "Montaż"
  },
  en: {
    sales: "Sales",
    manager: "Manager",
    accounting: "Accounting",
    logistics: "Logistics",
    installer: "Installation"
  }
} satisfies Record<"pl" | "en", Record<WorkflowKey, string>>;

const creditLabels = {
  pl: {
    bank: "Bank",
    loanAmount: "Kwota kredytu",
    ownPayment: "Wpłata własna",
    installment: "Rata",
    period: "Okres",
    decision: "Decyzja",
    scoring: "Scoring"
  },
  en: {
    bank: "Bank",
    loanAmount: "Loan amount",
    ownPayment: "Own payment",
    installment: "Installment",
    period: "Term",
    decision: "Decision",
    scoring: "Scoring"
  }
} satisfies Record<"pl" | "en", Record<keyof typeof demoCreditData, string>>;

const creditValues = {
  pl: demoCreditData,
  en: {
    bank: "Green Energy Bank",
    loanAmount: demoCreditData.loanAmount,
    ownPayment: demoCreditData.ownPayment,
    installment: demoCreditData.installment,
    period: "120 months",
    decision: "Preliminary approval",
    scoring: "Very good"
  }
} satisfies Record<"pl" | "en", Record<keyof typeof demoCreditData, string>>;

function statusLabel(status: "pending" | "active" | "done", language: "pl" | "en") {
  if (status === "done") return language === "en" ? "Done" : "Wykonane";
  if (status === "active") return language === "en" ? "Now" : "Teraz";
  return language === "en" ? "Waiting" : "Czeka";
}

function statusClass(status: "pending" | "active" | "done") {
  if (status === "done") return "border-leaf/25 bg-leaf/10 text-leaf";
  if (status === "active") return "border-sky/25 bg-sky/10 text-sky";
  return "border-line bg-white text-muted";
}

function localizedWarehouseNote(value: string, language: "pl" | "en") {
  if (language === "pl") return value;
  if (value === demoContractData.warehouseNote) return "Tile-roof mounting structure, black panel frames.";
  return value;
}

function formatMoneyNumber(value: number, language: "pl" | "en") {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

function nowIso() {
  return new Date().toISOString();
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

export function DepartmentWorkspacePage({ kind }: { kind: DepartmentKind }) {
  const config = departmentConfigs[kind];
  const { language } = useLanguage();
  const { loading, profile } = useAuth(config.allowedRoles);
  const workspace = useProcessWorkspace(profile);
  const contract = useMemo(() => contractDataFromProcess(workspace.selectedProcess), [workspace.selectedProcess]);
  const [departmentState, setDepartmentState] = useState<DepartmentProcessState>(() =>
    defaultDepartmentState(contract)
  );
  const [modal, setModal] = useState<DepartmentModal>(null);

  useEffect(() => {
    if (!profile) return;
    const key = departmentStateStorageKeyFor(profile, workspace.selectedProcess.id);
    setDepartmentState(readDepartmentState(key, contract));
  }, [contract, profile, workspace.selectedProcess.id]);

  function updateDepartmentState(updater: (current: DepartmentProcessState) => DepartmentProcessState) {
    if (!profile) return;
    setDepartmentState((current) => {
      const next = updater(current);
      saveDepartmentState(departmentStateStorageKeyFor(profile, workspace.selectedProcess.id), next);
      return next;
    });
  }

  function updateFinance(values: Partial<DepartmentProcessState["finance"]>) {
    updateDepartmentState((current) => {
      const finance = { ...current.finance, ...values, updatedAt: nowIso() };
      const simulation = calculateFinanceSimulation(
        finance.amount,
        finance.ownPayment,
        finance.subsidy,
        finance.months,
        finance.annualRate
      );
      return {
        ...current,
        finance: {
          ...finance,
          monthlyInstallment: simulation.monthlyInstallment,
          totalCost: simulation.totalCost
        }
      };
    });
  }

  function useContractAmount() {
    updateFinance({
      amount: parseMoneyValue(contract.grossPrice),
      ownPayment: 0,
      subsidy: 0
    });
  }

  function openAccountingDocument(type: "package" | "invoice" | "ksef" | "annex") {
    const timestamp = nowIso();
    const titles = {
      package: language === "en" ? "Accounting package ready" : "Paczka księgowa gotowa",
      invoice: language === "en" ? "Invoice preview ready" : "Podgląd faktury gotowy",
      ksef: language === "en" ? "KSeF payload ready" : "Payload KSeF gotowy",
      annex: language === "en" ? "Annex generated" : "Aneks wygenerowany"
    };

    updateDepartmentState((current) => ({
      ...current,
      accounting: {
        ...current.accounting,
        packagePreparedAt: type === "package" ? timestamp : current.accounting.packagePreparedAt,
        invoicePreviewAt: type === "invoice" ? timestamp : current.accounting.invoicePreviewAt,
        ksefPayloadAt: type === "ksef" ? timestamp : current.accounting.ksefPayloadAt,
        annexGeneratedAt: type === "annex" ? timestamp : current.accounting.annexGeneratedAt
      }
    }));

    setModal({
      title: titles[type],
      description:
        language === "en"
          ? "This is a safe CRM preview. Production submission or download is not triggered here."
          : "To bezpieczny podgląd CRM. Produkcyjna wysyłka ani pobranie nie uruchamiają się w tym miejscu.",
      rows: [
        { label: language === "en" ? "Client" : "Klient", value: contract.clientName },
        { label: language === "en" ? "Contract" : "Umowa", value: contract.contractNumber },
        { label: language === "en" ? "Gross amount" : "Kwota brutto", value: contract.grossPrice },
        { label: language === "en" ? "Generated at" : "Wygenerowano", value: formatProcessDate(timestamp, language === "en" ? "en-US" : "pl-PL") }
      ]
    });
  }

  function generateWarehouseDocument(type: "pz" | "wz" | "finalWz") {
    const timestamp = nowIso();
    updateDepartmentState((current) => ({
      ...current,
      warehouse: {
        ...current.warehouse,
        pzNumber:
          type === "pz" ? documentNumber("PZ", contract.contractNumber || workspace.selectedProcess.id) : current.warehouse.pzNumber,
        pzGeneratedAt: type === "pz" ? timestamp : current.warehouse.pzGeneratedAt,
        wzNumber:
          type === "wz" ? documentNumber("WZ-REZ", contract.contractNumber || workspace.selectedProcess.id) : current.warehouse.wzNumber,
        wzReservedAt: type === "wz" ? timestamp : current.warehouse.wzReservedAt,
        finalWzNumber:
          type === "finalWz" ? documentNumber("WZ", contract.contractNumber || workspace.selectedProcess.id) : current.warehouse.finalWzNumber,
        finalWzGeneratedAt: type === "finalWz" ? timestamp : current.warehouse.finalWzGeneratedAt
      }
    }));
  }

  function updateLogistics(values: Partial<DepartmentProcessState["logistics"]>) {
    updateDepartmentState((current) => ({
      ...current,
      logistics: { ...current.logistics, ...values, updatedAt: nowIso() }
    }));
  }

  function updateInstallation(values: Partial<DepartmentProcessState["installation"]>) {
    updateDepartmentState((current) => ({
      ...current,
      installation: { ...current.installation, ...values, updatedAt: nowIso() }
    }));
  }

  if (loading || !profile) return <LoadingScreen />;

  const completion = workflowCompletion(workspace.selectedWorkflow);
  const title = language === "en" ? config.titleEn : config.titlePl;
  const description = language === "en" ? config.descriptionEn : config.descriptionPl;
  const eyebrow = language === "en" ? config.eyebrowEn : config.eyebrowPl;
  const locale = language === "en" ? "en-US" : "pl-PL";
  const roleLabel = language === "en" ? profile.role : ROLE_LABELS[profile.role];
  const currentCreditValues = creditValues[language];

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5" data-tour-id={config.tourId}>
        <PageHeader
          title={title}
          description={description}
          actions={
            <button type="button" onClick={workspace.reload} className="btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {language === "en" ? "Refresh" : "Odśwież"}
            </button>
          }
        />

        <section className="app-card">
          <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-sky/15 bg-sky/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky">
                <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {eyebrow}
              </div>
              <h2 className="text-xl font-black text-ink">{workspace.selectedProcess.fullName}</h2>
              <p className="mt-1 text-sm text-muted">
                {language === "en" ? "Contract" : "Umowa"}: {workspace.selectedProcess.contractNumber || "-"} ·{" "}
                {language === "en" ? "Owner" : "Opiekun"}: {workspace.selectedProcess.ownerName || "-"}
              </p>
            </div>
            <div className="grid gap-3 rounded-lg border border-line bg-[#f8fafc] p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{language === "en" ? "Logged role" : "Zalogowana rola"}</span>
                <span className="font-bold text-ink">{roleLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{language === "en" ? "Process progress" : "Postęp procesu"}</span>
                <span className="font-black text-ink">{completion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e8edf4]">
                <div className="h-full rounded-full bg-sky transition-all" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>

          {workspace.error ? (
            <Alert tone="warning" className="mt-4">
              {language === "en"
                ? "Could not load production processes. Demo data is shown when available."
                : "Nie udało się pobrać procesów produkcyjnych. Pokazuję dane demo, jeśli są dostępne."}
            </Alert>
          ) : null}

          {workspace.processClients.length > 1 ? (
            <label className="mt-4 block max-w-md">
              <span className="label">{language === "en" ? "Client in process" : "Klient w procesie"}</span>
              <select
                className="field"
                value={workspace.selectedProcess.id}
                onChange={(event) => workspace.selectProcess(event.target.value)}
              >
                {workspace.processClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.fullName} · {client.contractNumber || "-"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>

        {!workspace.hasProcessClients && !workspace.loading ? (
          <EmptyState
            title={language === "en" ? "No clients in process" : "Brak klientów w procesie"}
            description={
              language === "en"
                ? "This workspace will fill once a contracted client appears in the current CRM environment."
                : "Ten widok uzupełni się, gdy w bieżącym środowisku CRM pojawi się klient z umową."
            }
          />
        ) : null}

        {kind === "finance" ? (
          <section className="grid gap-3 xl:grid-cols-[1fr_1fr]" data-tour-id="tour-finance-calculator">
            <section className="app-card">
              <SectionHeader
                icon={Banknote}
                title={language === "en" ? "Credit calculator" : "Kalkulator finansowania"}
                description={language === "en" ? "The amount starts from the contract and can be adjusted by finance." : "Kwota startuje z umowy, a dział finansowy może przeliczyć ratę."}
                actions={
                  <button type="button" onClick={useContractAmount} className="btn-secondary">
                    {language === "en" ? "Use contract amount" : "Użyj kwoty z umowy"}
                  </button>
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Preview label={language === "en" ? "Client" : "Klient"} value={contract.clientName} />
                <NumberInput
                  label={language === "en" ? "Financed amount" : "Kwota finansowania"}
                  value={departmentState.finance.amount}
                  min={0}
                  onChange={(value) => updateFinance({ amount: value })}
                />
                <NumberInput
                  label={language === "en" ? "Own payment" : "Wpłata własna"}
                  value={departmentState.finance.ownPayment}
                  min={0}
                  onChange={(value) => updateFinance({ ownPayment: value })}
                />
                <NumberInput
                  label={language === "en" ? "Subsidy" : "Dotacja"}
                  value={departmentState.finance.subsidy}
                  min={0}
                  onChange={(value) => updateFinance({ subsidy: value })}
                />
                <NumberInput
                  label={language === "en" ? "Months" : "Liczba miesięcy"}
                  value={departmentState.finance.months}
                  min={1}
                  onChange={(value) => updateFinance({ months: value })}
                />
                <NumberInput
                  label={language === "en" ? "Annual interest %" : "Oprocentowanie roczne %"}
                  value={departmentState.finance.annualRate}
                  min={0}
                  step="0.1"
                  onChange={(value) => updateFinance({ annualRate: value })}
                />
                <Preview
                  label={language === "en" ? "Monthly installment" : "Rata miesięczna"}
                  value={formatMoneyNumber(departmentState.finance.monthlyInstallment, language)}
                />
                <Preview
                  label={language === "en" ? "Total repayment" : "Suma spłaty"}
                  value={formatMoneyNumber(departmentState.finance.totalCost, language)}
                />
                <Preview label={language === "en" ? "Decision" : "Decyzja"} value={currentCreditValues.decision} />
              </div>
            </section>
            <section className="app-card">
              <SectionHeader icon={Landmark} title={language === "en" ? "Bank data" : "Dane bankowe"} />
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(currentCreditValues).map(([key, value]) => (
                  <Preview key={key} label={creditLabels[language][key as keyof typeof demoCreditData]} value={value} />
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {kind === "accounting" ? (
          <section className="grid gap-3 xl:grid-cols-[1fr_1fr]" data-tour-id="tour-accounting-actions">
            <section className="app-card">
              <SectionHeader
                icon={ReceiptText}
                title={language === "en" ? "Accounting package" : "Paczka księgowa"}
                description={language === "en" ? "Prepared from the same contract data used by operations." : "Przygotowana z tych samych danych umowy, na których pracuje realizacja."}
                actions={
                  <button type="button" onClick={() => openAccountingDocument("package")} className="btn-primary">
                    {language === "en" ? "Prepare package" : "Przygotuj paczkę"}
                  </button>
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Preview label={language === "en" ? "Buyer" : "Nabywca"} value={contract.clientName} />
                <Preview label={language === "en" ? "Net amount" : "Cena netto"} value={contract.netPrice} />
                <Preview label={language === "en" ? "Gross amount" : "Cena brutto"} value={contract.grossPrice} />
                <Preview label={language === "en" ? "Contract" : "Umowa"} value={contract.contractNumber} />
              </div>
            </section>
            <section className="app-card">
              <SectionHeader icon={FileDigit} title={language === "en" ? "KSeF and annex" : "KSeF i aneks"} />
              <div className="grid gap-3">
                <ActionLine
                  label={language === "en" ? "Invoice" : "Faktura"}
                  value={
                    departmentState.accounting.invoicePreviewAt
                      ? language === "en"
                        ? "Preview ready"
                        : "Podgląd gotowy"
                      : language === "en"
                        ? "Waiting"
                        : "Czeka"
                  }
                  actionLabel={language === "en" ? "Show preview" : "Pokaż podgląd"}
                  onAction={() => openAccountingDocument("invoice")}
                />
                <ActionLine
                  label="KSeF"
                  value={
                    departmentState.accounting.ksefPayloadAt
                      ? language === "en"
                        ? "Payload ready"
                        : "Payload gotowy"
                      : language === "en"
                        ? "Not sent in demo"
                        : "Bez wysyłki w demo"
                  }
                  actionLabel={language === "en" ? "Prepare payload" : "Przygotuj payload"}
                  onAction={() => openAccountingDocument("ksef")}
                />
                <ActionLine
                  label={language === "en" ? "Annex" : "Aneks"}
                  value={
                    departmentState.accounting.annexGeneratedAt
                      ? language === "en"
                        ? "Generated"
                        : "Wygenerowany"
                      : language === "en"
                        ? "From current contract values"
                        : "Z aktualnych wartości umowy"
                  }
                  actionLabel={language === "en" ? "Generate" : "Generuj"}
                  onAction={() => openAccountingDocument("annex")}
                />
              </div>
            </section>
          </section>
        ) : null}

        {kind === "equipment" ? (
          <section className="grid gap-3 xl:grid-cols-[1fr_1fr]" data-tour-id="tour-equipment-documents">
            <section className="app-card">
              <SectionHeader icon={Warehouse} title={language === "en" ? "Equipment from contract" : "Sprzęt z umowy"} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Preview label={language === "en" ? "Panels" : "Panele"} value={`${contract.panelsCount || "-"} ${language === "en" ? "pcs" : "szt."}`} />
                <Preview label={language === "en" ? "Power" : "Moc"} value={`${contract.installationPowerKw || "-"} kW`} />
                <Preview label={language === "en" ? "Inverter" : "Falownik"} value={contract.inverterModel} />
                <Preview
                  label={language === "en" ? "Warehouse note" : "Uwagi magazynowe"}
                  value={localizedWarehouseNote(contract.warehouseNote, language)}
                />
              </div>
            </section>
            <section className="app-card">
              <SectionHeader icon={PackageCheck} title={language === "en" ? "PZ / WZ" : "PZ / WZ"} />
              <div className="grid gap-3">
                <ActionLine
                  label="PZ"
                  value={departmentState.warehouse.pzNumber || (language === "en" ? "Ready to generate" : "Gotowe do wygenerowania")}
                  actionLabel={language === "en" ? "Generate PZ" : "Generuj PZ"}
                  onAction={() => generateWarehouseDocument("pz")}
                />
                <ActionLine
                  label="WZ"
                  value={departmentState.warehouse.wzNumber || (language === "en" ? "Reservation not created" : "Rezerwacja nieutworzona")}
                  actionLabel={language === "en" ? "Reserve WZ" : "Rezerwuj WZ"}
                  onAction={() => generateWarehouseDocument("wz")}
                />
                <ActionLine
                  label={language === "en" ? "Final WZ" : "WZ finalne"}
                  value={departmentState.warehouse.finalWzNumber || contract.montageDate || "-"}
                  actionLabel={language === "en" ? "Close WZ" : "Zamknij WZ"}
                  onAction={() => generateWarehouseDocument("finalWz")}
                />
              </div>
            </section>
          </section>
        ) : null}

        {kind === "logistics" ? (
          <section className="app-card" data-tour-id="tour-logistics-plan">
            <SectionHeader
              icon={Truck}
              title={language === "en" ? "Logistics timeline" : "Ścieżka logistyczna"}
              description={language === "en" ? "Plan delivery, handoff and crew readiness from one process record." : "Zaplanuj dostawę, przekazanie sprawy i gotowość ekipy z jednego rekordu procesu."}
            />
            <div className="grid gap-3 md:grid-cols-4">
              <StepCard title={language === "en" ? "Accounting approval" : "Akceptacja księgowości"} value={statusLabel(workspace.selectedWorkflow.accounting, language)} />
              <StepCard title={language === "en" ? "Equipment reserved" : "Sprzęt zarezerwowany"} value={statusLabel(workspace.selectedWorkflow.logistics, language)} />
              <StepCard title={language === "en" ? "Installation date" : "Termin montażu"} value={contract.montageDate || "-"} />
              <StepCard title={language === "en" ? "Address" : "Adres"} value={`${contract.address}, ${contract.postalCode} ${contract.city}`} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label>
                <span className="label">{language === "en" ? "Delivery date" : "Data dostawy"}</span>
                <input
                  className="field"
                  type="date"
                  value={departmentState.logistics.deliveryDate || todayValue()}
                  onChange={(event) => updateLogistics({ deliveryDate: event.target.value })}
                />
              </label>
              <label>
                <span className="label">{language === "en" ? "Crew" : "Ekipa"}</span>
                <select
                  className="field"
                  value={departmentState.logistics.crew}
                  onChange={(event) => updateLogistics({ crew: event.target.value })}
                >
                  <option>Ekipa A</option>
                  <option>Ekipa B</option>
                  <option>Ekipa C</option>
                </select>
              </label>
              <label>
                <span className="label">{language === "en" ? "Status" : "Status"}</span>
                <select
                  className="field"
                  value={departmentState.logistics.status}
                  onChange={(event) => updateLogistics({ status: event.target.value as DepartmentProcessState["logistics"]["status"] })}
                >
                  <option value="draft">{language === "en" ? "Draft" : "Roboczy"}</option>
                  <option value="scheduled">{language === "en" ? "Scheduled" : "Zaplanowane"}</option>
                  <option value="ready">{language === "en" ? "Ready" : "Gotowe"}</option>
                </select>
              </label>
              <label>
                <span className="label">{language === "en" ? "Notes" : "Uwagi"}</span>
                <input
                  className="field"
                  value={departmentState.logistics.notes}
                  onChange={(event) => updateLogistics({ notes: event.target.value })}
                  placeholder={language === "en" ? "Gate, access, crew note" : "Brama, dojazd, uwaga dla ekipy"}
                />
              </label>
            </div>
          </section>
        ) : null}

        {kind === "installation" ? (
          <section className="grid gap-3 xl:grid-cols-[1fr_0.9fr]" data-tour-id="tour-installation-closeout">
            <section className="app-card">
              <SectionHeader icon={Hammer} title={language === "en" ? "Installation card" : "Karta montażu"} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Preview label={language === "en" ? "Client" : "Klient"} value={contract.clientName} />
                <Preview label={language === "en" ? "Phone" : "Telefon"} value={contract.phone} />
                <Preview label={language === "en" ? "Date" : "Termin"} value={contract.montageDate} />
                <Preview label={language === "en" ? "Address" : "Adres"} value={`${contract.address}, ${contract.postalCode} ${contract.city}`} />
              </div>
            </section>
            <section className="app-card">
              <SectionHeader icon={BadgeCheck} title={language === "en" ? "Field checklist" : "Lista terenowa"} />
              <div className="grid gap-3">
                <label>
                  <span className="label">{language === "en" ? "Confirmed installation date" : "Potwierdzona data montażu"}</span>
                  <input
                    className="field"
                    type="date"
                    value={departmentState.installation.installationDate || todayValue()}
                    onChange={(event) => updateInstallation({ installationDate: event.target.value })}
                  />
                </label>
                <StatusLine
                  label={language === "en" ? "Specification" : "Specyfikacja"}
                  value={`${contract.panelsCount} ${language === "en" ? "panels" : "paneli"} · ${contract.installationPowerKw} kW`}
                />
                <StatusLine
                  label={language === "en" ? "Warehouse note" : "Uwagi magazynu"}
                  value={localizedWarehouseNote(contract.warehouseNote, language)}
                />
                <ChecklistToggle
                  label={language === "en" ? "Photos attached" : "Zdjęcia dołączone"}
                  checked={departmentState.installation.roofPhotos}
                  onChange={(checked) => updateInstallation({ roofPhotos: checked })}
                />
                <ChecklistToggle
                  label={language === "en" ? "Inverter configured" : "Falownik skonfigurowany"}
                  checked={departmentState.installation.inverterConfigured}
                  onChange={(checked) => updateInstallation({ inverterConfigured: checked })}
                />
                <ChecklistToggle
                  label={language === "en" ? "Client signed handoff" : "Klient podpisał odbiór"}
                  checked={departmentState.installation.clientSigned}
                  onChange={(checked) => updateInstallation({ clientSigned: checked })}
                />
                <button
                  type="button"
                  onClick={() => updateInstallation({ finalDocumentsReady: true })}
                  className="btn-primary"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {departmentState.installation.finalDocumentsReady
                    ? language === "en"
                      ? "Final documents ready"
                      : "Dokumenty końcowe gotowe"
                    : language === "en"
                      ? "Prepare final documents"
                      : "Przygotuj dokumenty końcowe"}
                </button>
              </div>
            </section>
          </section>
        ) : null}

        <section className="app-card">
          <SectionHeader icon={FileSignature} title={language === "en" ? "Process status" : "Status procesu"} />
          <div className="grid gap-3 md:grid-cols-5">
            {workflowSteps.map((step) => (
              <button
                key={step.key}
                type="button"
                onClick={() => workspace.moveWorkflow(step.key)}
                disabled={!isSystemAdminRole(profile.role) && profile.role !== step.ownerRole}
                className={`rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${statusClass(workspace.selectedWorkflow[step.key])}`}
              >
                <div className="text-sm font-black">{workflowLabels[language][step.key]}</div>
                <div className="mt-1 text-xs font-bold">{statusLabel(workspace.selectedWorkflow[step.key], language)}</div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-muted">
            {language === "en" ? "Last update" : "Ostatnia aktualizacja"}:{" "}
            {formatProcessDate(workspace.selectedProcess.updatedAt, locale)}
          </p>
        </section>

        <ModalShell
          open={Boolean(modal)}
          title={modal?.title || ""}
          description={modal?.description}
          onClose={() => setModal(null)}
          footer={
            <div className="flex justify-end">
              <button type="button" onClick={() => setModal(null)} className="btn-primary">
                {language === "en" ? "Close" : "Zamknij"}
              </button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {modal?.rows.map((row) => (
              <Preview key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
            ))}
          </div>
        </ModalShell>
      </div>
    </AppShell>
  );
}

function Preview({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-line bg-[#f9fbfd] p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value || "-"}</div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  step = "1"
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: string;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="field"
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ActionLine({
  label,
  value,
  actionLabel,
  onAction
}: {
  label: string;
  value: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-line bg-[#f9fbfd] p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="font-bold text-ink">{label}</div>
        <div className="mt-1 break-words font-semibold text-muted">{value || "-"}</div>
      </div>
      <button type="button" onClick={onAction} className="btn-secondary">
        {actionLabel}
      </button>
    </div>
  );
}

function ChecklistToggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-[#f9fbfd] px-3 py-2 text-sm font-bold text-ink">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-line bg-[#f9fbfd] p-3 text-sm">
      <span className="font-bold text-ink">{label}</span>
      <span className="text-right font-semibold text-muted">{value}</span>
    </div>
  );
}

function StepCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-[#f9fbfd] p-4">
      <CalendarDays className="mb-3 h-5 w-5 text-sky" aria-hidden="true" />
      <div className="text-sm font-black text-ink">{title}</div>
      <div className="mt-2 text-sm font-semibold text-muted">{value}</div>
    </div>
  );
}
