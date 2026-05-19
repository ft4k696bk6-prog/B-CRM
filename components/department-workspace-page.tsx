"use client";

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
  Truck,
  Warehouse
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useLanguage } from "@/components/language-provider";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { demoContractData, demoCreditData } from "@/lib/demo-documents";
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

function moneyValue(value: string) {
  return value || "-";
}

function localizedInstallment(value: string, language: "pl" | "en") {
  if (language === "pl") return value;
  return value.replace("mies.", "mo.").replace("miesięcy", "months");
}

function localizedWarehouseNote(value: string, language: "pl" | "en") {
  if (language === "pl") return value;
  if (value === demoContractData.warehouseNote) return "Tile-roof mounting structure, black panel frames.";
  return value;
}

export function DepartmentWorkspacePage({ kind }: { kind: DepartmentKind }) {
  const config = departmentConfigs[kind];
  const { language } = useLanguage();
  const { loading, profile } = useAuth(config.allowedRoles);
  const workspace = useProcessWorkspace(profile);

  if (loading || !profile) return <LoadingScreen />;

  const contract = contractDataFromProcess(workspace.selectedProcess);
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
          <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
            <section className="app-card">
              <SectionHeader
                icon={Banknote}
                title={language === "en" ? "Financing decision" : "Decyzja finansowania"}
                description={language === "en" ? "Client and contract data stay attached to the credit case." : "Dane klienta i umowy zostają przy sprawie kredytowej."}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Preview label={language === "en" ? "Client" : "Klient"} value={contract.clientName} />
                <Preview label={language === "en" ? "Gross amount" : "Kwota brutto"} value={moneyValue(contract.grossPrice)} />
                <Preview
                  label={language === "en" ? "Installment" : "Rata"}
                  value={localizedInstallment(contract.creditInstallment || currentCreditValues.installment, language)}
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
          <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
            <section className="app-card">
              <SectionHeader
                icon={ReceiptText}
                title={language === "en" ? "Accounting package" : "Paczka księgowa"}
                description={language === "en" ? "Prepared from the same contract data used by operations." : "Przygotowana z tych samych danych umowy, na których pracuje realizacja."}
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
                <StatusLine label="KSeF" value={language === "en" ? "Demo payload ready" : "Payload demo gotowy"} />
                <StatusLine label={language === "en" ? "Annex" : "Aneks"} value={language === "en" ? "Generated from current contract values" : "Generowany z aktualnych wartości umowy"} />
                <StatusLine label={language === "en" ? "Invoice" : "Faktura"} value={language === "en" ? "Available to accounting and admins" : "Dostępna dla księgowości i adminów"} />
              </div>
            </section>
          </section>
        ) : null}

        {kind === "equipment" ? (
          <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
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
                <StatusLine label="PZ" value={language === "en" ? "Planned after accounting approval" : "Planowane po akceptacji księgowości"} />
                <StatusLine label="WZ" value={language === "en" ? "Reserved for installation date" : "Zarezerwowane do dnia montażu"} />
                <StatusLine label={language === "en" ? "Final WZ" : "WZ finalne"} value={contract.montageDate || "-"} />
              </div>
            </section>
          </section>
        ) : null}

        {kind === "logistics" ? (
          <section className="app-card">
            <SectionHeader icon={Truck} title={language === "en" ? "Logistics timeline" : "Ścieżka logistyczna"} />
            <div className="grid gap-3 md:grid-cols-4">
              <StepCard title={language === "en" ? "Accounting approval" : "Akceptacja księgowości"} value={statusLabel(workspace.selectedWorkflow.accounting, language)} />
              <StepCard title={language === "en" ? "Equipment reserved" : "Sprzęt zarezerwowany"} value={statusLabel(workspace.selectedWorkflow.logistics, language)} />
              <StepCard title={language === "en" ? "Installation date" : "Termin montażu"} value={contract.montageDate || "-"} />
              <StepCard title={language === "en" ? "Address" : "Adres"} value={`${contract.address}, ${contract.postalCode} ${contract.city}`} />
            </div>
          </section>
        ) : null}

        {kind === "installation" ? (
          <section className="grid gap-3 xl:grid-cols-[1fr_0.9fr]">
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
                <StatusLine
                  label={language === "en" ? "Specification" : "Specyfikacja"}
                  value={`${contract.panelsCount} ${language === "en" ? "panels" : "paneli"} · ${contract.installationPowerKw} kW`}
                />
                <StatusLine
                  label={language === "en" ? "Warehouse note" : "Uwagi magazynu"}
                  value={localizedWarehouseNote(contract.warehouseNote, language)}
                />
                <StatusLine label={language === "en" ? "Final documents" : "Dokumenty końcowe"} value={language === "en" ? "Final invoice and WZ after completion" : "Faktura końcowa i WZ po wykonaniu"} />
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
