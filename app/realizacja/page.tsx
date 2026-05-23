"use client";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Calculator, ChevronDown, ClipboardCheck, Eye, FileSignature, FolderKanban, Hammer, Truck, Upload, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, ModalShell } from "@/components/ui";
import { contractFieldLabels, referenceContractData, ksefDisclaimer, type ContractCustomerRecord } from "@/lib/contract-documents";
import { canUseOperations, normalizeRole } from "@/lib/roles";
import { readSelectedProcessId, saveSelectedProcessId, selectedProcessStorageKeyFor } from "@/lib/process-workspace";
import { supabase } from "@/lib/supabase";
import type { Lead, Profile, UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
type WorkflowStatus = "pending" | "active" | "done";
const workflowSteps = [
    { key: "sales", ownerRole: "handlowiec", icon: FileSignature },
    { key: "manager", ownerRole: "kierownik", icon: UsersRound },
    { key: "accounting", ownerRole: "ksiegowosc", icon: Calculator },
    { key: "logistics", ownerRole: "logistyk", icon: Truck },
    { key: "installer", ownerRole: "monter", icon: Hammer }
] as const;
type WorkflowKey = (typeof workflowSteps)[number]["key"];
type WorkflowMap = Record<WorkflowKey, WorkflowStatus>;
type ProcessClient = {
    id: string;
    fullName: string;
    phone: string | null;
    status: string | null;
    contractNumber: string | null;
    source: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    ownerName: string | null;
    ownerRole: UserRole | null;
};
const workflowStorageKeyPrefix = "bcrm-process-workflows";
const initialWorkflow: WorkflowMap = {
    sales: "done",
    manager: "active",
    accounting: "pending",
    logistics: "pending",
    installer: "pending"
};
const contractFields: Array<keyof ContractCustomerRecord> = [
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
const emptyContractData: ContractCustomerRecord = {
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
const contractFieldLabelsByLanguage = {
    pl: contractFieldLabels
};
const realizationCopy = {
    pl: {
        previewTitle: "Podgląd umowy",
        contractPreviewTitle: "Podgląd umowy",
        formPreviewTitle: "Podgląd z danych formularza",
        formPreviewDescription: "Podgląd otwiera się w osobnym oknie, bez automatycznego pobierania danych klienta.",
        contractDataInserted: "Wprowadzono dane z rekordu klienta do formularza.",
        selectedClientInserted: "Wprowadzono dane wybranego klienta do formularza.",
        contractAddedPrefix: "Dodano umowę",
        contractAddedSuffix: "Plik jest gotowy do powiązania z rekordem klienta.",
        annexGenerated: "Aneks PDF został wygenerowany.",
        annexError: "Nie udało się wygenerować aneksu PDF.",
        invoiceGenerated: "Faktura PDF została wygenerowana.",
        invoiceError: "Nie udało się wygenerować faktury PDF.",
        ksefError: "Nie udało się obsłużyć integracji KSeF.",
        unknownKsefError: "Nieznany błąd integracji.",
        ksefPreparedPackageTitle: "KSeF: paczka księgowa gotowa",
        ksefPreparedSendTitle: "KSeF: wysyłka zatrzymana",
        ksefPreparedMessage: "Integracja KSeF nie ma jeszcze pełnej konfiguracji produkcyjnej, więc CRM pokazuje przygotowany payload bez wysyłki danych klienta.",
        headerEyebrow: "Realizacja po umowie",
        pageTitle: "Umowy i procesy",
        pageDescription: "Widok operacyjny pokazuje klientów po umowie, opiekuna sprawy, status procesu i procent realizacji dla każdego rekordu.",
        loggedRole: "Zalogowana rola",
        processProgress: "Postęp procesu",
        processListTitle: "Klienci w procesie",
        processListDescription: "Wybierz klienta, żeby uruchomić lub kontynuować jego proces realizacji.",
        processLoading: "Ładowanie procesów",
        processError: "Nie udało się pobrać procesów. Sprawdź połączenie i konfigurację bazy.",
        selectedProcessTitle: "Aktywny proces klienta",
        noContractNumber: "Brak numeru umowy",
        ownerLabel: "Dodał / opiekun",
        noOwner: "Nieprzypisany",
        statusLabel: "Status",
        phoneLabel: "Telefon",
        sourceLabel: "Źródło",
        updatedLabel: "Aktualizacja",
        contractLabel: "Umowa",
        currentStage: "Aktualny etap",
        openProcess: "Otwórz proces",
        useSelectedClient: "Wprowadź dane klienta",
        processStatus: {
            notStarted: "Nie rozpoczęto",
            inProgress: "W trakcie",
            completed: "Zakończony"
        },
        workflowTitle: "Proces klienta",
        workflowDescription: "Status zmienia się dla wybranego klienta i pokazuje realny procent ukończenia.",
        workflowStatus: {
            done: "Wykonane",
            active: "Do akcji",
            pending: "Czeka"
        },
        markDone: "Oznacz",
        reopenStep: "Cofnij",
        roles: {
            owner: "Właściciel",
            admin: "Admin",
            kierownik: "Kierownik",
            handlowiec: "Handlowiec",
            finance: "Finanse",
            viewer: "Podgląd",
            ksiegowosc: "Księgowość",
            logistyk: "Logistyka",
            monter: "Monter"
        },
        contractDataTitle: "Dane umowy",
        contractDataDescription: "Użyj danych klienta, uzupełnij brakujące pola albo przygotuj podgląd umowy.",
        showContractPreview: "Otwórz umowę",
        fillClientData: "Uzupełnij dane klienta",
        showFormPreview: "Podgląd z formularza",
        addContractPdf: "Dodaj umowę PDF",
        addedContract: "Dodana umowa",
        accountingPackageTitle: "Paczka księgowa",
        accountingPackageDescription: "Dane rozliczeniowe przygotowane na podstawie aktualnej umowy.",
        buyer: "Nabywca",
        grossAmount: "Kwota brutto",
        netAmount: "Cena netto",
        prepareAccounting: "Przygotuj paczkę księgową",
        preparing: "Przygotowanie",
        packageReady: "Paczka gotowa",
        accountingOnly: "Tylko księgowość",
        invoiceDownload: "Pobierz fakturę PDF",
        generating: "Generowanie",
        ksefTitle: "KSeF",
        ksefDescription: "Przygotowanie danych do wysyłki faktury ustrukturyzowanej.",
        ksefDisclaimer,
        connecting: "Łączenie",
        ksefChecked: "KSeF sprawdzony",
        sendKsef: "Wyślij do KSeF",
        annexTitle: "Generator aneksu",
        annexDescription: "Aneks generuje się jako PDF z danych aktualnej umowy i wskazanych zmian.",
        annexDownload: "Pobierz aneks PDF",
        automaticMode: "Tryb automatyczny",
        manualMode: "Tryb ręczny",
        panelsCount: "Liczba paneli",
        installationPower: "Moc instalacji",
        grossPrice: "Cena brutto",
        financing: "Finansowanie",
        mode: "Tryb",
        changes: "Zmiany",
        noSelectedChanges: "brak wybranych zmian",
        newConfiguration: "Nowa konfiguracja",
        panelsUnit: "paneli",
        financingData: "Dane finansowania",
        roleCards: {
            manager: "Akceptuje kompletność danych i przekazuje sprawę do realizacji.",
            logistics: "Widzi moc, liczbę paneli, sprzęt, uwagi magazynowe i termin montażu.",
            installer: "Pracuje na gotowym rekordzie z adresem, terminem i specyfikacją instalacji."
        },
        processGuide: {
            eyebrow: "Proces realizacji",
            title: "Proces: od umowy do montażu",
            description: "Krótka, bezpieczna ścieżka pokazuje, jak CRM prowadzi sprawę między sprzedażą, kierownikiem, finansami, księgowością, logistyką i montażem.",
            start: "Otwórz proces",
            next: "Dalej",
            finish: "Zakończ",
            step: "Krok",
            problem: "Problem",
            crmAction: "Co robi CRM",
            effect: "Efekt",
            autofill: "Autouzupełnianie danych z umowy",
            clickOutsideTitle: "Zamknąć ścieżkę procesu?",
            clickOutsideDescription: "Możesz wrócić do niego później. Dane pozostaną w bezpiecznym podglądzie.",
            keepGoing: "Kontynuuj",
            endNow: "Zakończ",
            logisticsPreview: "Podgląd logistyki",
            pz: "PZ planowane",
            wz: "WZ zarezerwowane",
            finalWz: "WZ finalne w dniu montażu",
            scrollReady: "Przesuń w dół, żeby przejść dalej. CRM sam ustawi ekran.",
            scrollWaiting: "CRM ustawia ten etap. Za moment gest w dół przeprowadzi dalej.",
            note: "Komentarz wdrożeniowy: przy podpisie elektronicznym krok zdjęć papierowej umowy można pominąć, ale polityka firmy może nadal wymagać zdjęć dachu lub licznika."
        },
        hideFinancing: "Ukryj finansowanie",
        showFinancing: "Pokaż finansowanie",
        previewData: "Dane w podglądzie",
        close: "Zamknij",
        repositoryPayload: "Payload repozytorium",
        apiResponse: "Odpowiedź API",
        integrationMode: "Tryb",
        production: "Produkcja",
        prepared: "Przygotowany",
        error: "Błąd",
        sent: "Wysłano",
        yes: "Tak",
        no: "Nie",
        blank: "-"
    },
} as const;
type RealizationCopy = typeof realizationCopy.pl;
function statusClasses(status: WorkflowStatus) {
    if (status === "done")
        return "border-leaf/25 bg-leaf/10 text-leaf";
    if (status === "active")
        return "border-sky/25 bg-sky/10 text-sky";
    return "border-line bg-white text-muted";
}
function workflowCompletion(workflow: WorkflowMap) {
    const values = Object.values(workflow);
    return Math.round((values.filter((value) => value === "done").length / values.length) * 100);
}
function processStatusLabel(workflow: WorkflowMap, copy: RealizationCopy) {
    const completion = workflowCompletion(workflow);
    if (completion === 100)
        return copy.processStatus.completed;
    if (completion === 0)
        return copy.processStatus.notStarted;
    return copy.processStatus.inProgress;
}
function currentWorkflowStage(workflow: WorkflowMap, copy: RealizationCopy) {
    const activeStep = workflowSteps.find((step) => workflow[step.key] === "active");
    const pendingStep = workflowSteps.find((step) => workflow[step.key] === "pending");
    const step = activeStep || pendingStep || workflowSteps[workflowSteps.length - 1];
    return copy.roles[step.ownerRole];
}
function normalizeWorkflowState(workflow: Partial<Record<WorkflowKey, WorkflowStatus>>): WorkflowMap {
    const next: WorkflowMap = { ...initialWorkflow, ...workflow };
    const firstOpenStep = workflowSteps.find((item) => next[item.key] !== "done");
    workflowSteps.forEach((item) => {
        if (next[item.key] === "done")
            return;
        next[item.key] = firstOpenStep?.key === item.key ? "active" : "pending";
    });
    return next;
}
function workflowStorageKeyFor(profile: Pick<Profile, "id" | "crm_environment">) {
    return `${workflowStorageKeyPrefix}:${profile.crm_environment}:${profile.id}`;
}
function readStoredWorkflows(storageKey: string): Record<string, WorkflowMap> {
    if (typeof window === "undefined")
        return {};
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw) as Record<string, Partial<Record<WorkflowKey, WorkflowStatus>>>;
        return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [
            key,
            normalizeWorkflowState(value)
        ])) as Record<string, WorkflowMap>;
    }
    catch {
        return {};
    }
}
function saveStoredWorkflows(storageKey: string, workflows: Record<string, WorkflowMap>) {
    if (typeof window === "undefined")
        return;
    window.localStorage.setItem(storageKey, JSON.stringify(workflows));
}
function defaultWorkflowForProcess(client: ProcessClient): WorkflowMap {
    const seed = client.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const variants: WorkflowMap[] = [
        { sales: "done", manager: "active", accounting: "pending", logistics: "pending", installer: "pending" },
        { sales: "done", manager: "done", accounting: "active", logistics: "pending", installer: "pending" },
        { sales: "done", manager: "done", accounting: "done", logistics: "active", installer: "pending" },
        { sales: "done", manager: "done", accounting: "done", logistics: "done", installer: "active" },
        { sales: "done", manager: "done", accounting: "done", logistics: "done", installer: "done" }
    ];
    return variants[seed % variants.length];
}
function toggleWorkflowStatus(current: WorkflowMap, step: WorkflowKey): WorkflowMap {
    const next: WorkflowMap = { ...current };
    const stepIndex = workflowSteps.findIndex((item) => item.key === step);
    const isReopening = current[step] === "done";
    next[step] = isReopening ? "active" : "done";
    if (isReopening) {
        workflowSteps.slice(stepIndex + 1).forEach((item) => {
            if (next[item.key] !== "done")
                next[item.key] = "pending";
        });
        return next;
    }
    const nextActiveStep = workflowSteps.find((item) => next[item.key] !== "done");
    workflowSteps.forEach((item) => {
        if (next[item.key] === "done")
            return;
        next[item.key] = nextActiveStep?.key === item.key ? "active" : "pending";
    });
    return next;
}
function workflowForProcess(client: ProcessClient, workflows: Record<string, WorkflowMap>) {
    if (!client.id)
        return normalizeWorkflowState(initialWorkflow);
    return normalizeWorkflowState(workflows[client.id] || defaultWorkflowForProcess(client));
}
function leadToProcessClient(lead: Lead): ProcessClient {
    const ownerRole = lead.assigned_profile?.role
        ? normalizeRole(lead.assigned_profile.role, lead.assigned_profile.email)
        : null;
    return {
        id: lead.id,
        fullName: lead.full_name,
        phone: lead.phone,
        status: lead.status,
        contractNumber: lead.contract_number,
        source: lead.source,
        createdAt: lead.created_at,
        updatedAt: lead.updated_at,
        ownerName: lead.assigned_profile?.full_name || lead.assigned_profile?.email || null,
        ownerRole
    };
}
function emptyProcessClient(): ProcessClient {
    return {
        id: "",
        fullName: "",
        phone: null,
        status: null,
        contractNumber: null,
        source: null,
        createdAt: null,
        updatedAt: null,
        ownerName: null,
        ownerRole: null
    };
}
function formatProcessDate(value: string | null) {
    if (!value)
        return "—";
    return new Intl.DateTimeFormat("pl-PL", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}
function canControlStep(role: UserRole, ownerRole: UserRole) {
    return role === "owner" || role === "admin" || role === ownerRole;
}
function isContractReady(record: ContractCustomerRecord) {
    return Boolean(record.contractNumber && record.clientName && record.address && record.grossPrice);
}
function ContractPreview({ record, title, copy, fieldLabels }: {
    record: ContractCustomerRecord;
    title: string;
    copy: RealizationCopy;
    fieldLabels: Record<keyof ContractCustomerRecord, string>;
}) {
    return (<div className="rounded-lg border border-line bg-[#eef3f8] p-4">
      <div className="mx-auto aspect-[1/1.414] max-h-[720px] w-full max-w-[510px] overflow-hidden rounded-lg border border-line bg-white p-6 shadow-sm">
        <div className="border-b border-line pb-4">
          <div className="h-1.5 w-20 rounded-full bg-solar"/>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-black text-ink">B-CRM</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
            </div>
            <div className="text-right text-xs text-muted">
              <div>{record.contractNumber || copy.noContractNumber}</div>
              <div>{record.contractDate || fieldLabels.contractDate}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              {fieldLabels.clientName}
            </div>
            <div className="mt-1 text-lg font-black text-ink">
              {record.clientName || fieldLabels.clientName}
            </div>
            <div className="text-muted">
              {record.address || fieldLabels.address}, {record.postalCode || "00-000"}{" "}
              {record.city || fieldLabels.city}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PreviewField label={fieldLabels.installationPowerKw} value={record.installationPowerKw ? `${record.installationPowerKw} kW` : copy.blank}/>
            <PreviewField label={fieldLabels.panelsCount} value={record.panelsCount || copy.blank}/>
            <PreviewField label={fieldLabels.grossPrice} value={record.grossPrice || copy.blank}/>
            <PreviewField label={fieldLabels.financing} value={record.financing || copy.blank}/>
          </div>

          <div className="rounded-lg border border-line bg-[#f9fbfd] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              {fieldLabels.inverterModel}
            </div>
            <div className="mt-1 font-bold text-ink">{record.inverterModel || copy.blank}</div>
          </div>

          <div className="rounded-lg border border-line bg-[#f9fbfd] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              {fieldLabels.warehouseNote}
            </div>
            <div className="mt-1 text-muted">{record.warehouseNote || copy.blank}</div>
          </div>
        </div>
      </div>
    </div>);
}
function PreviewField({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="rounded-lg border border-line bg-[#f9fbfd] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-bold text-ink">{value}</div>
    </div>);
}
export default function RealizacjaPage() {
    const copy = realizationCopy.pl;
    const fieldLabels = contractFieldLabelsByLanguage.pl;
    const { loading, profile } = useAuth([
        "owner",
        "admin",
        "kierownik",
        "handlowiec",
        "ksiegowosc",
        "logistyk",
        "monter"
    ]);
    const [contractData, setContractData] = useState<ContractCustomerRecord>(emptyContractData);
    const [previewRecord, setPreviewRecord] = useState<ContractCustomerRecord | null>(null);
    const [previewTitle, setPreviewTitle] = useState<string>(copy.previewTitle);
    const [contractFileName, setContractFileName] = useState("");
    const [processLeads, setProcessLeads] = useState<Lead[]>([]);
    const [processLoading, setProcessLoading] = useState(false);
    const [processError, setProcessError] = useState("");
    const [selectedProcessId, setSelectedProcessId] = useState("");
    const [workflowByProcess, setWorkflowByProcess] = useState<Record<string, WorkflowMap>>({});
    const [documentMessage, setDocumentMessage] = useState("");
    const [showProcessList, setShowProcessList] = useState(false);
    const [showContractData, setShowContractData] = useState(false);
    const contractInputRef = useRef<HTMLInputElement | null>(null);
    const processClients = useMemo<ProcessClient[]>(() => {
        return processLeads.map(leadToProcessClient);
    }, [processLeads]);
    const selectedProcess = processClients.find((client) => client.id === selectedProcessId) || processClients[0] || emptyProcessClient();
    const hasProcessClients = processClients.length > 0;
    const selectedWorkflow = workflowForProcess(selectedProcess, workflowByProcess);
    const completion = hasProcessClients ? workflowCompletion(selectedWorkflow) : 0;
    const currentRoleLabel = profile ? copy.roles[profile.role] : "";
    const contractReady = isContractReady(contractData);
    useEffect(() => {
        if (!profile)
            return;
        setWorkflowByProcess(readStoredWorkflows(workflowStorageKeyFor(profile)));
        const storedProcessId = readSelectedProcessId(selectedProcessStorageKeyFor(profile));
        if (storedProcessId)
            setSelectedProcessId(storedProcessId);
        void loadProcesses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.id, profile?.role, profile?.crm_environment]);
    if (loading || !profile)
        return <LoadingScreen />;
    if (!canUseOperations(profile.role))
        return <LoadingScreen />;
    async function loadProcesses() {
        if (!profile)
            return;
        setProcessLoading(true);
        setProcessError("");
        let query = supabase
            .from("leads")
            .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)")
            .eq("crm_environment", profile.crm_environment)
            .or("status.eq.Umowa,contract_number.not.is.null")
            .order("updated_at", { ascending: false })
            .limit(50);
        if (profile.role === "handlowiec") {
            query = query.eq("assigned_to", profile.id);
        }
        const { data, error } = await query;
        if (error) {
            setProcessError(error.message || copy.processError);
            setProcessLeads([]);
        }
        else {
            const nextLeads = (data || []) as Lead[];
            setProcessLeads(nextLeads);
            if (nextLeads.length > 0) {
                setSelectedProcessId((current) => {
                    if (nextLeads.some((lead) => lead.id === current))
                        return current;
                    const nextId = nextLeads[0].id;
                    saveSelectedProcessId(selectedProcessStorageKeyFor(profile), nextId);
                    return nextId;
                });
            }
        }
        setProcessLoading(false);
    }
    function updateContractField(key: keyof ContractCustomerRecord, value: string) {
        const next = { ...contractData, [key]: value };
        setContractData(next);
    }
    function showContractPreview() {
        setPreviewRecord(referenceContractData);
        setPreviewTitle(copy.contractPreviewTitle);
        setDocumentMessage("");
    }
    function fillContractFromReference() {
        setContractData(referenceContractData);
        setPreviewRecord(referenceContractData);
        setPreviewTitle(copy.contractPreviewTitle);
        setDocumentMessage(copy.contractDataInserted);
    }
    function showCurrentContractPreview() {
        setPreviewRecord(contractData);
        setPreviewTitle(copy.formPreviewTitle);
    }
    function useSelectedClientData() {
        const next = {
            ...contractData,
            contractNumber: selectedProcess.contractNumber || contractData.contractNumber,
            clientName: selectedProcess.fullName || contractData.clientName,
            phone: selectedProcess.phone || contractData.phone,
            sellerName: selectedProcess.ownerName || contractData.sellerName
        };
        setContractData(next);
        setDocumentMessage(copy.selectedClientInserted);
    }
    function addContractFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file)
            return;
        setContractFileName(file.name);
        setDocumentMessage(`${copy.contractAddedPrefix}: ${file.name}. ${copy.contractAddedSuffix}`);
        event.target.value = "";
    }
    function moveWorkflow(step: WorkflowKey) {
        if (!profile || !hasProcessClients)
            return;
        setWorkflowByProcess((current) => {
            const next = {
                ...current,
                [selectedProcess.id]: toggleWorkflowStatus(workflowForProcess(selectedProcess, current), step)
            };
            saveStoredWorkflows(workflowStorageKeyFor(profile), next);
            return next;
        });
    }
    return (<AppShell profile={profile}>
      <div className="grid gap-5">
        <section className="app-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-sky/15 bg-sky/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true"/>
                {copy.headerEyebrow}
              </div>
              <h1 className="section-title">{copy.pageTitle}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted">
                {copy.pageDescription}
              </p>
            </div>
            <div className="grid gap-2 rounded-lg border border-line bg-[#f8fafc] px-4 py-3 text-sm sm:min-w-[260px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">{copy.loggedRole}</span>
                <span className="font-bold text-ink">{currentRoleLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">{copy.processProgress}</span>
                <span className="font-bold text-ink">{completion}%</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
          <div className={showProcessList ? "app-card" : "rounded-lg border border-line bg-white px-4 py-3 shadow-sm"} data-guide-target="process-list">
            <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${showProcessList ? "mb-4" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky/10 text-sky">
                  <FolderKanban className="h-5 w-5" aria-hidden="true"/>
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink">{copy.processListTitle}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {processClients.length} {"klientów w procesie"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowProcessList((value) => !value)} className="btn-secondary">
                <ChevronDown className={`h-4 w-4 transition ${showProcessList ? "rotate-180" : ""}`} aria-hidden="true"/>
                {showProcessList
            ? "Ukryj listę"
            : "Pokaż listę"}
              </button>
            </div>

            {showProcessList && processLoading ? (<div className="mb-3 rounded-md border border-line bg-[#f8fafc] p-3 text-sm font-semibold text-muted">
                {copy.processLoading}
              </div>) : null}

            {showProcessList && processError ? (<div className="mb-3 rounded-md border border-solar/30 bg-solar/10 p-3 text-sm font-semibold text-[#8a5a00]">
                {copy.processError}
              </div>) : null}

            {showProcessList ? (<div className="grid gap-3">
              {processClients.map((client) => {
                const workflow = workflowForProcess(client, workflowByProcess);
                const progress = workflowCompletion(workflow);
                const isSelected = selectedProcess.id === client.id;
                return (<button key={client.id} type="button" onClick={() => {
                        setSelectedProcessId(client.id);
                        saveSelectedProcessId(selectedProcessStorageKeyFor(profile), client.id);
                    }} className={`grid gap-3 rounded-lg border p-4 text-left transition sm:grid-cols-[1fr_auto] sm:items-center ${isSelected ? "border-ink bg-[#f8fafc]" : "border-line bg-white hover:border-sky/30"}`}>
                    <span>
                      <span className="block text-sm font-black text-ink">{client.fullName}</span>
                      <span className="mt-1 block text-xs font-semibold text-muted">
                        {copy.ownerLabel}: {client.ownerName || copy.noOwner}
                        {client.ownerRole ? ` · ${copy.roles[client.ownerRole]}` : ""}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted">
                        <span>
                          {copy.contractLabel}: {client.contractNumber || copy.noContractNumber}
                        </span>
                        <span>
                          {copy.updatedLabel}: {formatProcessDate(client.updatedAt)}
                        </span>
                      </span>
                    </span>
                    <span className="grid gap-2 text-right">
                      <span className="rounded-md border border-sky/20 bg-sky/10 px-3 py-1 text-xs font-bold text-sky">
                        {processStatusLabel(workflow, copy)}
                      </span>
                      <span className="text-xs font-bold text-ink">{progress}%</span>
                    </span>
                  </button>);
            })}
              {!processLoading && processClients.length === 0 ? (<EmptyState title={"Brak klientów w procesie"} description={"Dane produkcyjne pozostają puste, dopóki w tym środowisku nie pojawi się klient z umową."}/>) : null}
            </div>) : null}
          </div>

          {hasProcessClients ? (<div className="app-card" data-guide-target="active-process" data-tour-id="tour-process">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {copy.selectedProcessTitle}
                </div>
                <h2 className="mt-1 text-xl font-black text-ink">{selectedProcess.fullName}</h2>
                <p className="mt-1 text-sm text-muted">
                  {copy.ownerLabel}: {selectedProcess.ownerName || copy.noOwner}
                  {selectedProcess.ownerRole ? ` · ${copy.roles[selectedProcess.ownerRole]}` : ""}
                </p>
              </div>
              <span className="w-fit rounded-md border border-leaf/20 bg-leaf/10 px-3 py-1 text-xs font-bold text-leaf">
                {processStatusLabel(selectedWorkflow, copy)}
              </span>
            </div>

            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-muted">{copy.processProgress}</span>
                <span className="font-black text-ink">{completion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e8edf4]">
                <div className="h-full rounded-full bg-sky transition-all" style={{ width: `${completion}%` }}/>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <PreviewField label={copy.contractLabel} value={selectedProcess.contractNumber || copy.noContractNumber}/>
              <PreviewField label={copy.currentStage} value={currentWorkflowStage(selectedWorkflow, copy)}/>
              <PreviewField label={copy.statusLabel} value={selectedProcess.status || copy.blank}/>
              <PreviewField label={copy.phoneLabel} value={selectedProcess.phone || copy.blank}/>
              <PreviewField label={copy.sourceLabel} value={selectedProcess.source || copy.blank}/>
              <PreviewField label={copy.updatedLabel} value={formatProcessDate(selectedProcess.updatedAt)}/>
            </div>

            <button type="button" onClick={useSelectedClientData} className="btn-primary mt-4">
              <FileSignature className="h-4 w-4" aria-hidden="true"/>
              {copy.useSelectedClient}
            </button>
          </div>) : (<div className="app-card">
              <EmptyState title={"Brak aktywnego procesu"} description={"Wybierz klienta z umową, gdy pojawi się w tym środowisku CRM."}/>
            </div>)}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={showContractData ? "app-card" : "rounded-lg border border-line bg-white px-4 py-3 shadow-sm"} data-guide-target="contract-data">
            <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${showContractData ? "mb-4" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky/10 text-sky">
                  <FolderKanban className="h-5 w-5" aria-hidden="true"/>
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink">{copy.contractDataTitle}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {contractData.clientName || selectedProcess.fullName || copy.contractDataDescription}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowContractData((value) => !value)} className="btn-secondary">
                <ChevronDown className={`h-4 w-4 transition ${showContractData ? "rotate-180" : ""}`} aria-hidden="true"/>
                {showContractData
            ? "Ukryj dane"
            : "Pokaż dane"}
              </button>
            </div>

            {showContractData ? (<>
            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={showContractPreview} className="btn-secondary">
                <Eye className="h-4 w-4" aria-hidden="true"/>
                {copy.showContractPreview}
              </button>
              <button type="button" onClick={fillContractFromReference} className="btn-secondary">
                <ClipboardCheck className="h-4 w-4" aria-hidden="true"/>
                {copy.fillClientData}
              </button>
              <button type="button" onClick={showCurrentContractPreview} disabled={!contractReady} className="btn-secondary">
                <FileSignature className="h-4 w-4" aria-hidden="true"/>
                {copy.showFormPreview}
              </button>
              <input ref={contractInputRef} type="file" accept="application/pdf" className="hidden" onChange={addContractFile}/>
              <button type="button" onClick={() => contractInputRef.current?.click()} className="btn-primary">
                <Upload className="h-4 w-4" aria-hidden="true"/>
                {copy.addContractPdf}
              </button>
            </div>

            {contractFileName ? (<div className="mb-4 rounded-md border border-sky/20 bg-sky/10 p-3 text-sm font-semibold text-sky">
                {copy.addedContract}: {contractFileName}
              </div>) : null}

            {documentMessage ? (<Alert tone="success" className="mb-4">
                {documentMessage}
              </Alert>) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {contractFields.map((field) => (<label key={field}>
                  <span className="label">{fieldLabels[field]}</span>
                  <input className="field" value={contractData[field]} onChange={(event) => updateContractField(field, event.target.value)}/>
                </label>))}
            </div>
            </>) : null}
          </div>

          <div className="app-card">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true"/>
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">{copy.workflowTitle}</h2>
                <p className="mt-1 text-sm text-muted">{copy.workflowDescription}</p>
              </div>
            </div>

            <div className="grid gap-3">
              {workflowSteps.map((item) => {
            const Icon = item.icon;
            const workflowKey = item.key;
            const canControl = canControlStep(profile.role, item.ownerRole);
            const status = selectedWorkflow[workflowKey];
            return (<div key={item.key} data-guide-target={`workflow-${item.key}`} className={`grid gap-3 rounded-lg border px-4 py-3 transition sm:grid-cols-[1fr_auto] sm:items-center ${statusClasses(status)}`}>
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/70">
                        <Icon className="h-5 w-5" aria-hidden="true"/>
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{copy.roles[item.ownerRole]}</span>
                        <span className="block text-xs">
                          {copy.workflowStatus[status]} · {copy.roles[item.ownerRole]}
                        </span>
                      </span>
                    </span>
                    <button type="button" onClick={() => moveWorkflow(workflowKey)} disabled={!canControl} className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition ${canControl
                    ? "bg-white text-ink shadow-sm hover:border hover:border-ink"
                    : "cursor-not-allowed border border-line bg-white/40 text-muted opacity-70"}`}>
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true"/>
                      {status === "done" ? copy.reopenStep : copy.markDone}
                    </button>
                  </div>);
        })}
            </div>
          </div>
        </section>

        {previewRecord ? (<ModalShell open={Boolean(previewRecord)} title={previewTitle} description={copy.formPreviewDescription} onClose={() => setPreviewRecord(null)} size="xl">
            <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
              <ContractPreview record={previewRecord} title={previewTitle} copy={copy} fieldLabels={fieldLabels}/>
              <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                <h3 className="mb-4 text-base font-bold text-ink">{copy.previewData}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {contractFields.map((field) => (<div key={field} className="rounded-lg border border-line bg-[#f9fbfd] p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {fieldLabels[field]}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-ink">{previewRecord[field] || copy.blank}</div>
                    </div>))}
                </div>
              </div>
            </div>
          </ModalShell>) : null}

      </div>
    </AppShell>);
}
