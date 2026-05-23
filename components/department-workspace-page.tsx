"use client";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Banknote, CalendarDays, ClipboardCheck, FileDigit, FileSignature, Hammer, Landmark, PackageCheck, ReceiptText, RefreshCw, Save, Truck, Warehouse } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, ModalShell, PageHeader, SectionHeader } from "@/components/ui";
import { referenceCreditData } from "@/lib/contract-documents";
import { calculateFinanceSimulation, defaultDepartmentState, departmentStateStorageKeyFor, documentNumber, parseMoneyValue, readDepartmentState, saveDepartmentState, type DepartmentProcessState } from "@/lib/department-state";
import { contractDataFromProcess, formatProcessDate, workflowCompletion, workflowSteps, type WorkflowKey } from "@/lib/process-workspace";
import { isSystemAdminRole, ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useProcessWorkspace } from "@/lib/use-process-workspace";
type DepartmentKind = "finance" | "accounting" | "equipment" | "logistics" | "installation";
type DepartmentModal = {
    title: string;
    description: string;
    rows: Array<{
        label: string;
        value: string;
    }>;
} | null;
type DepartmentConfig = {
    titlePl: string;
    descriptionPl: string;
    eyebrowPl: string;
    tourId: string;
    allowedRoles: UserRole[];
};
const departmentConfigs: Record<DepartmentKind, DepartmentConfig> = {
    finance: {
        titlePl: "Finanse",
        descriptionPl: "Finansowanie klienta, decyzja bankowa i kwoty z aktualnej umowy.",
        eyebrowPl: "Dział finansowy",
        tourId: "tour-finance",
        allowedRoles: ["owner", "admin", "finance"]
    },
    accounting: {
        titlePl: "Księgowość",
        descriptionPl: "Paczka księgowa, faktura, KSeF i aneks na danych zatwierdzonej umowy.",
        eyebrowPl: "Rozliczenia",
        tourId: "tour-accounting",
        allowedRoles: ["owner", "admin", "ksiegowosc"]
    },
    equipment: {
        titlePl: "Sprzęt i magazyn",
        descriptionPl: "Sprzęt z umowy, kompletacja, PZ i rezerwacja WZ do dnia montażu.",
        eyebrowPl: "Magazyn",
        tourId: "tour-equipment",
        allowedRoles: ["owner", "admin", "logistyk"]
    },
    logistics: {
        titlePl: "Logistyka",
        descriptionPl: "Koordynacja terminu, dostawy, kompletacji i przekazania sprawy monterom.",
        eyebrowPl: "Operacje",
        tourId: "tour-logistics",
        allowedRoles: ["owner", "admin", "logistyk"]
    },
    installation: {
        titlePl: "Montaż",
        descriptionPl: "Adres, termin, specyfikacja i finalne potwierdzenie prac w terenie.",
        eyebrowPl: "Ekipa terenowa",
        tourId: "tour-installation",
        allowedRoles: ["owner", "admin", "monter"]
    }
};
const workflowLabels = {
    sales: "Sprzedaż",
    manager: "Kierownik",
    accounting: "Księgowość",
    logistics: "Logistyka",
    installer: "Montaż"
} satisfies Record<WorkflowKey, string>;
const creditLabels = {
    bank: "Bank",
    loanAmount: "Kwota kredytu",
    ownPayment: "Wpłata własna",
    installment: "Rata",
    period: "Okres",
    decision: "Decyzja",
    scoring: "Scoring"
} satisfies Record<keyof typeof referenceCreditData, string>;
const creditValues = referenceCreditData;
function statusLabel(status: "pending" | "active" | "done") {
    if (status === "done")
        return "Wykonane";
    if (status === "active")
        return "Teraz";
    return "Czeka";
}
function statusClass(status: "pending" | "active" | "done") {
    if (status === "done")
        return "border-leaf/25 bg-leaf/10 text-leaf";
    if (status === "active")
        return "border-sky/25 bg-sky/10 text-sky";
    return "border-line bg-white text-muted";
}
function localizedWarehouseNote(value: string) {
    return value;
}
function formatMoneyNumber(value: number) {
    return new Intl.NumberFormat("pl-PL", {
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
export function DepartmentWorkspacePage({ kind }: {
    kind: DepartmentKind;
}) {
    const config = departmentConfigs[kind];
    const { loading, profile } = useAuth(config.allowedRoles);
    const workspace = useProcessWorkspace(profile);
    const contract = useMemo(() => contractDataFromProcess(workspace.selectedProcess), [workspace.selectedProcess]);
    const [departmentState, setDepartmentState] = useState<DepartmentProcessState>(() => defaultDepartmentState(contract));
    const [modal, setModal] = useState<DepartmentModal>(null);
    useEffect(() => {
        if (!profile)
            return;
        const key = departmentStateStorageKeyFor(profile, workspace.selectedProcess.id);
        setDepartmentState(readDepartmentState(key, contract));
    }, [contract, profile, workspace.selectedProcess.id]);
    function updateDepartmentState(updater: (current: DepartmentProcessState) => DepartmentProcessState) {
        if (!profile)
            return;
        setDepartmentState((current) => {
            const next = updater(current);
            saveDepartmentState(departmentStateStorageKeyFor(profile, workspace.selectedProcess.id), next);
            return next;
        });
    }
    function updateFinance(values: Partial<DepartmentProcessState["finance"]>) {
        updateDepartmentState((current) => {
            const finance = { ...current.finance, ...values, updatedAt: nowIso() };
            const simulation = calculateFinanceSimulation(finance.amount, finance.ownPayment, finance.subsidy, finance.months, finance.annualRate);
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
            package: "Paczka księgowa gotowa",
            invoice: "Podgląd faktury gotowy",
            ksef: "Payload KSeF gotowy",
            annex: "Aneks wygenerowany"
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
            description: "To bezpieczny podgląd CRM. Produkcyjna wysyłka ani pobranie nie uruchamiają się w tym miejscu.",
            rows: [
                { label: "Klient", value: contract.clientName },
                { label: "Umowa", value: contract.contractNumber },
                { label: "Kwota brutto", value: contract.grossPrice },
                { label: "Wygenerowano", value: formatProcessDate(timestamp, "pl-PL") }
            ]
        });
    }
    function generateWarehouseDocument(type: "pz" | "wz" | "finalWz") {
        const timestamp = nowIso();
        updateDepartmentState((current) => ({
            ...current,
            warehouse: {
                ...current.warehouse,
                pzNumber: type === "pz" ? documentNumber("PZ", contract.contractNumber || workspace.selectedProcess.id) : current.warehouse.pzNumber,
                pzGeneratedAt: type === "pz" ? timestamp : current.warehouse.pzGeneratedAt,
                wzNumber: type === "wz" ? documentNumber("WZ-REZ", contract.contractNumber || workspace.selectedProcess.id) : current.warehouse.wzNumber,
                wzReservedAt: type === "wz" ? timestamp : current.warehouse.wzReservedAt,
                finalWzNumber: type === "finalWz" ? documentNumber("WZ", contract.contractNumber || workspace.selectedProcess.id) : current.warehouse.finalWzNumber,
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
    if (loading || !profile)
        return <LoadingScreen />;
    const completion = workflowCompletion(workspace.selectedWorkflow);
    const title = config.titlePl;
    const description = config.descriptionPl;
    const eyebrow = config.eyebrowPl;
    const locale = "pl-PL";
    const roleLabel = ROLE_LABELS[profile.role];
    const currentCreditValues = creditValues;
    return (<AppShell profile={profile}>
      <div className="grid gap-5" data-tour-id={config.tourId}>
        <PageHeader title={title} description={description} actions={<button type="button" onClick={workspace.reload} className="btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true"/>
              {"Odśwież"}
            </button>}/>

        <section className="app-card">
          <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-sky/15 bg-sky/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky">
                <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true"/>
                {eyebrow}
              </div>
              <h2 className="text-xl font-black text-ink">{workspace.selectedProcess.fullName}</h2>
              <p className="mt-1 text-sm text-muted">
                {"Umowa"}: {workspace.selectedProcess.contractNumber || "-"} ·{" "}
                {"Opiekun"}: {workspace.selectedProcess.ownerName || "-"}
              </p>
            </div>
            <div className="grid gap-3 rounded-lg border border-line bg-[#f8fafc] p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{"Zalogowana rola"}</span>
                <span className="font-bold text-ink">{roleLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{"Postęp procesu"}</span>
                <span className="font-black text-ink">{completion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e8edf4]">
                <div className="h-full rounded-full bg-sky transition-all" style={{ width: `${completion}%` }}/>
              </div>
            </div>
          </div>

          {workspace.error ? (<Alert tone="warning" className="mt-4">
              {"Nie udało się pobrać procesów produkcyjnych. Sprawdź połączenie z bazą i konfigurację procesu."}
            </Alert>) : null}

          {workspace.processClients.length > 1 ? (<label className="mt-4 block max-w-md">
              <span className="label">{"Klient w procesie"}</span>
              <select className="field" value={workspace.selectedProcess.id} onChange={(event) => workspace.selectProcess(event.target.value)}>
                {workspace.processClients.map((client) => (<option key={client.id} value={client.id}>
                    {client.fullName} · {client.contractNumber || "-"}
                  </option>))}
              </select>
            </label>) : null}
        </section>

        {!workspace.hasProcessClients && !workspace.loading ? (<EmptyState title={"Brak klientów w procesie"} description={"Ten widok uzupełni się, gdy w bieżącym środowisku CRM pojawi się klient z umową."}/>) : null}

        {kind === "finance" ? (<section className="grid gap-3 xl:grid-cols-[1fr_1fr]" data-tour-id="tour-finance-calculator">
            <section className="app-card">
              <SectionHeader icon={Banknote} title={"Kalkulator finansowania"} description={"Kwota startuje z umowy, a dział finansowy może przeliczyć ratę."} actions={<button type="button" onClick={useContractAmount} className="btn-secondary">
                    {"Użyj kwoty z umowy"}
                  </button>}/>
              <div className="grid gap-3 sm:grid-cols-2">
                <Preview label={"Klient"} value={contract.clientName}/>
                <NumberInput label={"Kwota finansowania"} value={departmentState.finance.amount} min={0} onChange={(value) => updateFinance({ amount: value })}/>
                <NumberInput label={"Wpłata własna"} value={departmentState.finance.ownPayment} min={0} onChange={(value) => updateFinance({ ownPayment: value })}/>
                <NumberInput label={"Dotacja"} value={departmentState.finance.subsidy} min={0} onChange={(value) => updateFinance({ subsidy: value })}/>
                <NumberInput label={"Liczba miesięcy"} value={departmentState.finance.months} min={1} onChange={(value) => updateFinance({ months: value })}/>
                <NumberInput label={"Oprocentowanie roczne %"} value={departmentState.finance.annualRate} min={0} step="0.1" onChange={(value) => updateFinance({ annualRate: value })}/>
                <Preview label={"Rata miesięczna"} value={formatMoneyNumber(departmentState.finance.monthlyInstallment)}/>
                <Preview label={"Suma spłaty"} value={formatMoneyNumber(departmentState.finance.totalCost)}/>
                <Preview label={"Decyzja"} value={currentCreditValues.decision}/>
              </div>
            </section>
            <section className="app-card">
              <SectionHeader icon={Landmark} title={"Dane bankowe"}/>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(currentCreditValues).map(([key, value]) => (<Preview key={key} label={creditLabels[key as keyof typeof referenceCreditData]} value={value}/>))}
              </div>
            </section>
          </section>) : null}

        {kind === "accounting" ? (<section className="grid gap-3 xl:grid-cols-[1fr_1fr]" data-tour-id="tour-accounting-actions">
            <section className="app-card">
              <SectionHeader icon={ReceiptText} title={"Paczka księgowa"} description={"Przygotowana z tych samych danych umowy, na których pracuje realizacja."} actions={<button type="button" onClick={() => openAccountingDocument("package")} className="btn-primary">
                    {"Przygotuj paczkę"}
                  </button>}/>
              <div className="grid gap-3 sm:grid-cols-2">
                <Preview label={"Nabywca"} value={contract.clientName}/>
                <Preview label={"Cena netto"} value={contract.netPrice}/>
                <Preview label={"Cena brutto"} value={contract.grossPrice}/>
                <Preview label={"Umowa"} value={contract.contractNumber}/>
              </div>
            </section>
            <section className="app-card">
              <SectionHeader icon={FileDigit} title={"KSeF i aneks"}/>
              <div className="grid gap-3">
                <ActionLine label={"Faktura"} value={departmentState.accounting.invoicePreviewAt
                ?
                    "Podgląd gotowy"
                :
                    "Czeka"} actionLabel={"Pokaż podgląd"} onAction={() => openAccountingDocument("invoice")}/>
                <ActionLine label="KSeF" value={departmentState.accounting.ksefPayloadAt
                ?
                    "Payload gotowy"
                :
                    "Czeka na konfigurację produkcyjną"} actionLabel={"Przygotuj payload"} onAction={() => openAccountingDocument("ksef")}/>
                <ActionLine label={"Aneks"} value={departmentState.accounting.annexGeneratedAt
                ?
                    "Wygenerowany"
                :
                    "Z aktualnych wartości umowy"} actionLabel={"Generuj"} onAction={() => openAccountingDocument("annex")}/>
              </div>
            </section>
          </section>) : null}

        {kind === "equipment" ? (<section className="grid gap-3 xl:grid-cols-[1fr_1fr]" data-tour-id="tour-equipment-documents">
            <section className="app-card">
              <SectionHeader icon={Warehouse} title={"Sprzęt z umowy"}/>
              <div className="grid gap-3 sm:grid-cols-2">
                <Preview label={"Panele"} value={`${contract.panelsCount || "-"} ${"szt."}`}/>
                <Preview label={"Moc"} value={`${contract.installationPowerKw || "-"} kW`}/>
                <Preview label={"Falownik"} value={contract.inverterModel}/>
                <Preview label={"Uwagi magazynowe"} value={localizedWarehouseNote(contract.warehouseNote)}/>
              </div>
            </section>
            <section className="app-card">
              <SectionHeader icon={PackageCheck} title={"PZ / WZ"}/>
              <div className="grid gap-3">
                <ActionLine label="PZ" value={departmentState.warehouse.pzNumber || ("Gotowe do wygenerowania")} actionLabel={"Generuj PZ"} onAction={() => generateWarehouseDocument("pz")}/>
                <ActionLine label="WZ" value={departmentState.warehouse.wzNumber || ("Rezerwacja nieutworzona")} actionLabel={"Rezerwuj WZ"} onAction={() => generateWarehouseDocument("wz")}/>
                <ActionLine label={"WZ finalne"} value={departmentState.warehouse.finalWzNumber || contract.montageDate || "-"} actionLabel={"Zamknij WZ"} onAction={() => generateWarehouseDocument("finalWz")}/>
              </div>
            </section>
          </section>) : null}

        {kind === "logistics" ? (<section className="app-card" data-tour-id="tour-logistics-plan">
            <SectionHeader icon={Truck} title={"Ścieżka logistyczna"} description={"Zaplanuj dostawę, przekazanie sprawy i gotowość ekipy z jednego rekordu procesu."}/>
            <div className="grid gap-3 md:grid-cols-4">
              <StepCard title={"Akceptacja księgowości"} value={statusLabel(workspace.selectedWorkflow.accounting)}/>
              <StepCard title={"Sprzęt zarezerwowany"} value={statusLabel(workspace.selectedWorkflow.logistics)}/>
              <StepCard title={"Termin montażu"} value={contract.montageDate || "-"}/>
              <StepCard title={"Adres"} value={`${contract.address}, ${contract.postalCode} ${contract.city}`}/>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label>
                <span className="label">{"Data dostawy"}</span>
                <input className="field" type="date" value={departmentState.logistics.deliveryDate || todayValue()} onChange={(event) => updateLogistics({ deliveryDate: event.target.value })}/>
              </label>
              <label>
                <span className="label">{"Ekipa"}</span>
                <select className="field" value={departmentState.logistics.crew} onChange={(event) => updateLogistics({ crew: event.target.value })}>
                  <option>Ekipa A</option>
                  <option>Ekipa B</option>
                  <option>Ekipa C</option>
                </select>
              </label>
              <label>
                <span className="label">{"Status"}</span>
                <select className="field" value={departmentState.logistics.status} onChange={(event) => updateLogistics({ status: event.target.value as DepartmentProcessState["logistics"]["status"] })}>
                  <option value="draft">{"Roboczy"}</option>
                  <option value="scheduled">{"Zaplanowane"}</option>
                  <option value="ready">{"Gotowe"}</option>
                </select>
              </label>
              <label>
                <span className="label">{"Uwagi"}</span>
                <input className="field" value={departmentState.logistics.notes} onChange={(event) => updateLogistics({ notes: event.target.value })} placeholder={"Brama, dojazd, uwaga dla ekipy"}/>
              </label>
            </div>
          </section>) : null}

        {kind === "installation" ? (<section className="grid gap-3 xl:grid-cols-[1fr_0.9fr]" data-tour-id="tour-installation-closeout">
            <section className="app-card">
              <SectionHeader icon={Hammer} title={"Karta montażu"}/>
              <div className="grid gap-3 sm:grid-cols-2">
                <Preview label={"Klient"} value={contract.clientName}/>
                <Preview label={"Telefon"} value={contract.phone}/>
                <Preview label={"Termin"} value={contract.montageDate}/>
                <Preview label={"Adres"} value={`${contract.address}, ${contract.postalCode} ${contract.city}`}/>
              </div>
            </section>
            <section className="app-card">
              <SectionHeader icon={BadgeCheck} title={"Lista terenowa"}/>
              <div className="grid gap-3">
                <label>
                  <span className="label">{"Potwierdzona data montażu"}</span>
                  <input className="field" type="date" value={departmentState.installation.installationDate || todayValue()} onChange={(event) => updateInstallation({ installationDate: event.target.value })}/>
                </label>
                <StatusLine label={"Specyfikacja"} value={`${contract.panelsCount} ${"paneli"} · ${contract.installationPowerKw} kW`}/>
                <StatusLine label={"Uwagi magazynu"} value={localizedWarehouseNote(contract.warehouseNote)}/>
                <ChecklistToggle label={"Zdjęcia dołączone"} checked={departmentState.installation.roofPhotos} onChange={(checked) => updateInstallation({ roofPhotos: checked })}/>
                <ChecklistToggle label={"Falownik skonfigurowany"} checked={departmentState.installation.inverterConfigured} onChange={(checked) => updateInstallation({ inverterConfigured: checked })}/>
                <ChecklistToggle label={"Klient podpisał odbiór"} checked={departmentState.installation.clientSigned} onChange={(checked) => updateInstallation({ clientSigned: checked })}/>
                <button type="button" onClick={() => updateInstallation({ finalDocumentsReady: true })} className="btn-primary">
                  <Save className="h-4 w-4" aria-hidden="true"/>
                  {departmentState.installation.finalDocumentsReady
                ?
                    "Dokumenty końcowe gotowe"
                :
                    "Przygotuj dokumenty końcowe"}
                </button>
              </div>
            </section>
          </section>) : null}

        <section className="app-card">
          <SectionHeader icon={FileSignature} title={"Status procesu"}/>
          <div className="grid gap-3 md:grid-cols-5">
            {workflowSteps.map((step) => (<button key={step.key} type="button" onClick={() => workspace.moveWorkflow(step.key)} disabled={!isSystemAdminRole(profile.role) && profile.role !== step.ownerRole} className={`rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${statusClass(workspace.selectedWorkflow[step.key])}`}>
                <div className="text-sm font-black">{workflowLabels[step.key]}</div>
                <div className="mt-1 text-xs font-bold">{statusLabel(workspace.selectedWorkflow[step.key])}</div>
              </button>))}
          </div>
          <p className="mt-3 text-xs font-semibold text-muted">
            {"Ostatnia aktualizacja"}:{" "}
            {formatProcessDate(workspace.selectedProcess.updatedAt, locale)}
          </p>
        </section>

        <ModalShell open={Boolean(modal)} title={modal?.title || ""} description={modal?.description} onClose={() => setModal(null)} footer={<div className="flex justify-end">
              <button type="button" onClick={() => setModal(null)} className="btn-primary">
                {"Zamknij"}
              </button>
            </div>}>
          <div className="grid gap-3 sm:grid-cols-2">
            {modal?.rows.map((row) => (<Preview key={`${row.label}-${row.value}`} label={row.label} value={row.value}/>))}
          </div>
        </ModalShell>
      </div>
    </AppShell>);
}
function Preview({ label, value }: {
    label: string;
    value: string | null;
}) {
    return (<div className="rounded-lg border border-line bg-[#f9fbfd] p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value || "-"}</div>
    </div>);
}
function NumberInput({ label, value, onChange, min, step = "1" }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    step?: string;
}) {
    return (<label>
      <span className="label">{label}</span>
      <input className="field" type="number" min={min} step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))}/>
    </label>);
}
function ActionLine({ label, value, actionLabel, onAction }: {
    label: string;
    value: string;
    actionLabel: string;
    onAction: () => void;
}) {
    return (<div className="grid gap-3 rounded-lg border border-line bg-[#f9fbfd] p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="font-bold text-ink">{label}</div>
        <div className="mt-1 break-words font-semibold text-muted">{value || "-"}</div>
      </div>
      <button type="button" onClick={onAction} className="btn-secondary">
        {actionLabel}
      </button>
    </div>);
}
function ChecklistToggle({ label, checked, onChange }: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (<label className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-[#f9fbfd] px-3 py-2 text-sm font-bold text-ink">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/>
      {label}
    </label>);
}
function StatusLine({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="flex items-start justify-between gap-3 rounded-lg border border-line bg-[#f9fbfd] p-3 text-sm">
      <span className="font-bold text-ink">{label}</span>
      <span className="text-right font-semibold text-muted">{value}</span>
    </div>);
}
function StepCard({ title, value }: {
    title: string;
    value: string;
}) {
    return (<div className="rounded-lg border border-line bg-[#f9fbfd] p-4">
      <CalendarDays className="mb-3 h-5 w-5 text-sky" aria-hidden="true"/>
      <div className="text-sm font-black text-ink">{title}</div>
      <div className="mt-2 text-sm font-semibold text-muted">{value}</div>
    </div>);
}
