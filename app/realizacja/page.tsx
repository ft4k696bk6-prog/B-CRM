"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Calculator,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileSignature,
  FolderKanban,
  Hammer,
  Sparkles,
  Truck,
  Upload,
  UsersRound
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useLanguage } from "@/components/language-provider";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, ModalShell } from "@/components/ui";
import {
  contractFieldLabels,
  demoContractData,
  ksefDisclaimer,
  type DemoCustomerRecord
} from "@/lib/demo-documents";
import type { AppLanguage } from "@/lib/i18n";
import { canUseOperations, normalizeRole } from "@/lib/roles";
import {
  readSelectedProcessId,
  saveSelectedProcessId,
  selectedProcessStorageKeyFor
} from "@/lib/process-workspace";
import { isDemoScope } from "@/lib/scope";
import { supabase } from "@/lib/supabase";
import type { Lead, Profile, UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type WorkflowStatus = "pending" | "active" | "done";

const workflowSteps = [
  { key: "sales", ownerRole: "handlowiec", icon: FileSignature },
  { key: "manager", ownerRole: "menadzer", icon: UsersRound },
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
  postalCode: string | null;
  address: string | null;
  contractDate?: string | null;
  installation?: string | null;
  financing?: string | null;
  grossAmount?: string | null;
  montageDate?: string | null;
  operationsNote?: string | null;
  isDemo?: boolean;
};

const workflowStorageKeyPrefix = "bcrm-process-workflows";

const initialWorkflow: WorkflowMap = {
  sales: "done",
  manager: "active",
  accounting: "pending",
  logistics: "pending",
  installer: "pending"
};

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

const contractFieldLabelsByLanguage: Record<AppLanguage, Record<keyof DemoCustomerRecord, string>> = {
  pl: contractFieldLabels,
  en: {
    contractNumber: "Contract number",
    contractDate: "Contract date",
    sellerName: "Sales owner",
    companyName: "Company name",
    companyNip: "Company tax ID",
    clientName: "Client name",
    phone: "Phone",
    email: "Email",
    address: "Installation address",
    city: "City",
    postalCode: "Postal code",
    pesel: "National ID",
    identityDocument: "Identity document",
    installationPowerKw: "System power",
    panelsCount: "Panels",
    inverterModel: "Inverter model",
    netPrice: "Net price",
    grossPrice: "Gross price",
    financing: "Financing",
    creditInstallment: "Credit installment",
    montageDate: "Installation date",
    warehouseNote: "Operations note"
  }
};

const realizationCopy = {
  pl: {
    previewTitle: "Podgląd umowy",
    demoContractTitle: "Umowa demo",
    formPreviewTitle: "Podgląd z danych formularza",
    formPreviewDescription: "Podgląd otwiera się w osobnym oknie, bez automatycznego pobierania danych klienta.",
    demoInserted: "Wprowadzono dane demo do formularza.",
    selectedClientInserted: "Wprowadzono dane wybranego klienta do formularza.",
    contractAddedPrefix: "Dodano umowę",
    contractAddedSuffix: "Plik jest gotowy do powiązania z rekordem klienta.",
    annexGenerated: "Aneks PDF został wygenerowany.",
    annexError: "Nie udało się wygenerować aneksu PDF.",
    invoiceGenerated: "Faktura PDF została wygenerowana.",
    invoiceError: "Nie udało się wygenerować faktury PDF.",
    ksefError: "Nie udało się obsłużyć integracji KSeF.",
    unknownKsefError: "Nieznany błąd integracji.",
    ksefDemoPackageTitle: "Demo KSeF: paczka księgowa gotowa",
    ksefDemoSendTitle: "Demo KSeF: wysyłka zatrzymana",
    ksefDemoMessage:
      "To konto demo pokazuje gotowy payload i bezpiecznie nie wysyła danych klienta do systemów produkcyjnych.",
    headerEyebrow: "Realizacja po umowie",
    pageTitle: "Umowy i procesy",
    pageDescription:
      "Widok operacyjny pokazuje klientów po umowie, opiekuna sprawy, status procesu i procent realizacji dla każdego rekordu.",
    loggedRole: "Zalogowana rola",
    processProgress: "Postęp procesu",
    processListTitle: "Klienci w procesie",
    processListDescription: "Wybierz klienta, żeby uruchomić lub kontynuować jego proces realizacji.",
    processLoading: "Ładowanie procesów",
    processError: "Nie udało się pobrać procesów. Pokazuję bezpieczny rekord demo.",
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
      menadzer: "Menadżer",
      handlowiec: "Handlowiec",
      finance: "Finanse",
      viewer: "Podgląd",
      ksiegowosc: "Księgowość",
      logistyk: "Logistyka",
      monter: "Monter"
    },
    contractDataTitle: "Dane umowy",
    contractDataDescription: "Użyj danych klienta, wprowadź dane produkcyjne albo pokaż bezpieczną umowę demo.",
    showDemoContract: "Pokaż umowę demo",
    fillDemoData: "Wprowadź dane demo",
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
      manager:
        "Akceptuje kompletność danych i przekazuje sprawę do realizacji.",
      logistics: "Widzi moc, liczbę paneli, sprzęt, uwagi magazynowe i termin montażu.",
      installer: "Pracuje na gotowym rekordzie z adresem, terminem i specyfikacją instalacji."
    },
    demoGuide: {
      eyebrow: "Demo procesu",
      title: "Samouczek: od PDF umowy do montażu",
      description:
        "Krótki, bezpieczny walkthrough pokazuje, jak CRM prowadzi sprawę między sprzedażą, menadżerem, finansami, księgowością, logistyką i montażem.",
      start: "Uruchom samouczek",
      next: "Dalej",
      finish: "Zakończ",
      step: "Krok",
      problem: "Problem",
      crmAction: "Co robi CRM",
      effect: "Efekt",
      autofill: "Autouzupełnianie danych z umowy",
      clickOutsideTitle: "Zakończyć samouczek?",
      clickOutsideDescription: "Możesz wrócić do niego później. Dane demo pozostaną bezpieczne.",
      keepGoing: "Kontynuuj",
      endNow: "Zakończ",
      logisticsPreview: "Podgląd logistyki",
      pz: "PZ planowane",
      wz: "WZ zarezerwowane",
      finalWz: "WZ finalne w dniu montażu",
      scrollReady: "Przesuń w dół, żeby przejść dalej. CRM sam ustawi ekran.",
      scrollWaiting: "CRM ustawia ten etap. Za moment gest w dół przeprowadzi dalej.",
      note:
        "Komentarz wdrożeniowy: przy podpisie elektronicznym krok zdjęć papierowej umowy można pominąć, ale polityka firmy może nadal wymagać zdjęć dachu lub licznika."
    },
    hideDemoFinancing: "Ukryj finansowanie demo",
    showDemoFinancing: "Pokaż finansowanie demo",
    previewData: "Dane w podglądzie",
    close: "Zamknij",
    repositoryPayload: "Payload repozytorium",
    apiResponse: "Odpowiedź API",
    integrationMode: "Tryb",
    production: "Produkcja",
    demo: "Demo",
    error: "Błąd",
    sent: "Wysłano",
    yes: "Tak",
    no: "Nie",
    blank: "-"
  },
  en: {
    previewTitle: "Contract preview",
    demoContractTitle: "Demo contract",
    formPreviewTitle: "Preview from form data",
    formPreviewDescription: "The preview opens in a separate window without automatically downloading client data.",
    demoInserted: "Demo data has been entered into the form.",
    selectedClientInserted: "Selected client data has been entered into the form.",
    contractAddedPrefix: "Contract added",
    contractAddedSuffix: "The file is ready to be linked with the client record.",
    annexGenerated: "Annex PDF has been generated.",
    annexError: "Could not generate the annex PDF.",
    invoiceGenerated: "Invoice PDF has been generated.",
    invoiceError: "Could not generate the invoice PDF.",
    ksefError: "Could not complete the KSeF integration.",
    unknownKsefError: "Unknown integration error.",
    ksefDemoPackageTitle: "Demo KSeF: accounting package ready",
    ksefDemoSendTitle: "Demo KSeF: submission stopped",
    ksefDemoMessage:
      "This demo account shows the prepared payload and safely avoids sending client data to production systems.",
    headerEyebrow: "Post-contract operations",
    pageTitle: "Contracts and processes",
    pageDescription:
      "The operations view shows contracted clients, the case owner, process status, and completion percentage for every record.",
    loggedRole: "Signed-in role",
    processProgress: "Process progress",
    processListTitle: "Clients in process",
    processListDescription: "Choose a client to start or continue their operations process.",
    processLoading: "Loading processes",
    processError: "Could not load processes. Showing a safe demo record.",
    selectedProcessTitle: "Active client process",
    noContractNumber: "No contract number",
    ownerLabel: "Added by / owner",
    noOwner: "Unassigned",
    statusLabel: "Status",
    phoneLabel: "Phone",
    sourceLabel: "Source",
    updatedLabel: "Updated",
    contractLabel: "Contract",
    currentStage: "Current stage",
    openProcess: "Open process",
    useSelectedClient: "Use client data",
    processStatus: {
      notStarted: "Not started",
      inProgress: "In progress",
      completed: "Completed"
    },
    workflowTitle: "Client process",
    workflowDescription: "The status changes for the selected client and shows the actual completion percentage.",
    workflowStatus: {
      done: "Done",
      active: "Action needed",
      pending: "Waiting"
    },
    markDone: "Mark done",
    reopenStep: "Undo",
    roles: {
      owner: "Owner",
      admin: "Admin",
      menadzer: "Manager",
      handlowiec: "Sales",
      finance: "Finance",
      viewer: "Viewer",
      ksiegowosc: "Accounting",
      logistyk: "Logistics",
      monter: "Installer"
    },
    contractDataTitle: "Contract data",
    contractDataDescription: "Use client data, enter production details, or show a safe demo contract.",
    showDemoContract: "Show demo contract",
    fillDemoData: "Enter demo data",
    showFormPreview: "Preview from form",
    addContractPdf: "Add contract PDF",
    addedContract: "Added contract",
    accountingPackageTitle: "Accounting package",
    accountingPackageDescription: "Settlement data prepared from the current contract.",
    buyer: "Buyer",
    grossAmount: "Gross amount",
    netAmount: "Net price",
    prepareAccounting: "Prepare accounting package",
    preparing: "Preparing",
    packageReady: "Package ready",
    accountingOnly: "Accounting only",
    invoiceDownload: "Download invoice PDF",
    generating: "Generating",
    ksefTitle: "KSeF",
    ksefDescription: "Preparing structured invoice data for submission.",
    ksefDisclaimer:
      "Demo mode displays the full repository payload and integration response without sending sensitive client data to production systems.",
    connecting: "Connecting",
    ksefChecked: "KSeF checked",
    sendKsef: "Send to KSeF",
    annexTitle: "Annex generator",
    annexDescription: "The annex is generated as a PDF from the current contract and selected changes.",
    annexDownload: "Download annex PDF",
    automaticMode: "Automatic mode",
    manualMode: "Manual mode",
    panelsCount: "Panel count",
    installationPower: "System power",
    grossPrice: "Gross price",
    financing: "Financing",
    mode: "Mode",
    changes: "Changes",
    noSelectedChanges: "no selected changes",
    newConfiguration: "New configuration",
    panelsUnit: "panels",
    financingData: "Financing data",
    roleCards: {
      manager: "Approves data completeness and moves the case into operations.",
      logistics: "Sees system power, panel count, equipment, warehouse notes, and installation date.",
      installer: "Works from the ready record with address, date, and installation specification."
    },
    demoGuide: {
      eyebrow: "Process demo",
      title: "Tutorial: from contract PDF to installation",
      description:
        "A short, safe walkthrough shows how CRM moves work across sales, manager review, finance, accounting, logistics, and installation.",
      start: "Start tutorial",
      next: "Next",
      finish: "Finish",
      step: "Step",
      problem: "Problem",
      crmAction: "What CRM does",
      effect: "Outcome",
      autofill: "Autofilling data from the contract",
      clickOutsideTitle: "End tutorial?",
      clickOutsideDescription: "You can return to it later. Demo data stays safe.",
      keepGoing: "Continue",
      endNow: "End",
      logisticsPreview: "Logistics preview",
      pz: "Planned goods receipt",
      wz: "Reserved goods issue",
      finalWz: "Final goods issue on installation day",
      scrollReady: "Scroll down to continue. CRM will position the screen.",
      scrollWaiting: "CRM is positioning this stage. The next downward gesture will continue in a moment.",
      note:
        "Implementation note: with e-signature, the paper-contract photo step can be skipped, but company policy may still require roof or meter photos."
    },
    hideDemoFinancing: "Hide demo financing",
    showDemoFinancing: "Show demo financing",
    previewData: "Preview data",
    close: "Close",
    repositoryPayload: "Repository payload",
    apiResponse: "API response",
    integrationMode: "Mode",
    production: "Production",
    demo: "Demo",
    error: "Error",
    sent: "Sent",
    yes: "Yes",
    no: "No",
    blank: "-"
  }
} as const;

type RealizationCopy = (typeof realizationCopy)[AppLanguage];

function statusClasses(status: WorkflowStatus) {
  if (status === "done") return "border-leaf/25 bg-leaf/10 text-leaf";
  if (status === "active") return "border-sky/25 bg-sky/10 text-sky";
  return "border-line bg-white text-muted";
}

function workflowCompletion(workflow: WorkflowMap) {
  const values = Object.values(workflow);
  return Math.round((values.filter((value) => value === "done").length / values.length) * 100);
}

function processStatusLabel(workflow: WorkflowMap, copy: RealizationCopy) {
  const completion = workflowCompletion(workflow);
  if (completion === 100) return copy.processStatus.completed;
  if (completion === 0) return copy.processStatus.notStarted;
  return copy.processStatus.inProgress;
}

function currentWorkflowStage(workflow: WorkflowMap, copy: RealizationCopy) {
  const activeStep = workflowSteps.find((step) => workflow[step.key] === "active");
  const pendingStep = workflowSteps.find((step) => workflow[step.key] === "pending");
  const step = activeStep || pendingStep || workflowSteps[workflowSteps.length - 1];
  return copy.roles[step.ownerRole];
}

function operationalStageLabel(workflow: WorkflowMap, language: AppLanguage) {
  if (workflow.installer === "done") return language === "en" ? "Settled / installed" : "Rozliczone / zamontowane";
  if (workflow.installer === "active") return language === "en" ? "Install" : "Do montażu";
  if (workflow.logistics === "active") return language === "en" ? "Order equipment" : "Zamówić sprzęt";
  if (workflow.accounting === "active") return language === "en" ? "Accounting" : "Do rozliczenia";
  if (workflow.manager === "active") return language === "en" ? "Signed — review" : "Podpisane — do sprawdzenia";
  return language === "en" ? "Signed" : "Podpisane";
}

function matchesProcessSearch(client: ProcessClient, search: string) {
  const value = search.trim().toLowerCase();
  if (!value) return true;
  return [client.fullName, client.phone, client.contractNumber, client.ownerName, client.source]
    .filter(Boolean)
    .some((item) => String(item).toLowerCase().includes(value));
}

function isProcessWithinDates(client: ProcessClient, from: string, to: string) {
  const timestamp = client.updatedAt ? new Date(client.updatedAt).getTime() : 0;
  if (from && timestamp < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && timestamp > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

function normalizeWorkflowState(workflow: Partial<Record<WorkflowKey, WorkflowStatus>>): WorkflowMap {
  const next: WorkflowMap = { ...initialWorkflow, ...workflow };
  const firstOpenStep = workflowSteps.find((item) => next[item.key] !== "done");

  workflowSteps.forEach((item) => {
    if (next[item.key] === "done") return;
    next[item.key] = firstOpenStep?.key === item.key ? "active" : "pending";
  });

  return next;
}

function workflowStorageKeyFor(profile: Pick<Profile, "id" | "crm_environment">) {
  return `${workflowStorageKeyPrefix}:${profile.crm_environment}:${profile.id}`;
}

function readStoredWorkflows(storageKey: string): Record<string, WorkflowMap> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<Record<WorkflowKey, WorkflowStatus>>>;

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        normalizeWorkflowState(value)
      ])
    ) as Record<string, WorkflowMap>;
  } catch {
    return {};
  }
}

function saveStoredWorkflows(storageKey: string, workflows: Record<string, WorkflowMap>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(workflows));
}

function demoWorkflowForProcess(client: ProcessClient): WorkflowMap {
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
      if (next[item.key] !== "done") next[item.key] = "pending";
    });
    return next;
  }

  const nextActiveStep = workflowSteps.find((item) => next[item.key] !== "done");
  workflowSteps.forEach((item) => {
    if (next[item.key] === "done") return;
    next[item.key] = nextActiveStep?.key === item.key ? "active" : "pending";
  });

  return next;
}

function workflowForProcess(client: ProcessClient, workflows: Record<string, WorkflowMap>) {
  return normalizeWorkflowState(workflows[client.id] || demoWorkflowForProcess(client));
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
    ownerRole,
    postalCode: lead.postal_code,
    address: lead.address
  };
}

function demoProcessClients(): ProcessClient[] {
  const baseClient: ProcessClient = {
    id: "demo-process",
    fullName: demoContractData.clientName,
    phone: demoContractData.phone,
    status: "Umowa",
    contractNumber: demoContractData.contractNumber,
    source: "Demo",
    createdAt: demoContractData.contractDate,
    updatedAt: demoContractData.contractDate,
    ownerName: demoContractData.sellerName,
    ownerRole: "handlowiec",
    postalCode: demoContractData.postalCode,
    address: `${demoContractData.address}, ${demoContractData.city}`,
    contractDate: demoContractData.contractDate,
    installation: `${demoContractData.installationPowerKw} kW · ${demoContractData.inverterModel}`,
    financing: demoContractData.financing,
    grossAmount: demoContractData.grossPrice,
    montageDate: demoContractData.montageDate,
    operationsNote: demoContractData.warehouseNote,
    isDemo: true
  };

  return [
    baseClient,
    {
      ...baseClient,
      id: "demo-process-2",
      fullName: "Marta Zielińska",
      phone: "510 240 360",
      contractNumber: "BCRM/05/2026/021",
      postalCode: "30-001",
      address: "ul. Wiosenna 8, Kraków",
      ownerName: "Piotr Lis",
      contractDate: "2026-05-21",
      installation: "10 kW · Deye 3F Hybrid",
      financing: "Gotówka",
      grossAmount: "42 800 PLN",
      montageDate: "2026-06-12",
      operationsNote: "Magazyn energii 10 kWh, dach płaski."
    },
    {
      ...baseClient,
      id: "demo-process-3",
      fullName: "Tomasz Wiśniewski",
      phone: "698 120 445",
      contractNumber: "BCRM/05/2026/024",
      postalCode: "20-400",
      address: "ul. Polna 17, Lublin",
      ownerName: "Anna Nowak",
      contractDate: "2026-05-24",
      installation: "6.15 kW · Kon-Tec 6K",
      financing: "Kredyt 80% / gotówka 20%",
      grossAmount: "31 450 PLN",
      montageDate: "2026-06-18",
      operationsNote: "15 paneli, bojler 120 l."
    },
    {
      ...baseClient,
      id: "demo-process-4",
      fullName: "Karolina Maj",
      phone: "604 330 920",
      contractNumber: "BCRM/06/2026/003",
      postalCode: "35-001",
      address: "ul. Leśna 42, Rzeszów",
      ownerName: "Piotr Lis",
      contractDate: "2026-06-03",
      installation: "8.2 kW · Deye 3F Hybrid",
      financing: "Gotówka",
      grossAmount: "36 900 PLN",
      montageDate: "2026-06-25",
      operationsNote: "Klient prosi o kontakt 2 dni przed montażem."
    }
  ];
}

function demoProcessClient(): ProcessClient {
  return demoProcessClients()[0];
}

function formatProcessDate(value: string | null, language: AppLanguage) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function canControlStep(role: UserRole, ownerRole: UserRole) {
  return role === "owner" || role === "admin" || role === ownerRole;
}

function isContractReady(record: DemoCustomerRecord) {
  return Boolean(record.contractNumber && record.clientName && record.address && record.grossPrice);
}

function ContractPreview({
  record,
  title,
  copy,
  fieldLabels
}: {
  record: DemoCustomerRecord;
  title: string;
  copy: RealizationCopy;
  fieldLabels: Record<keyof DemoCustomerRecord, string>;
}) {
  return (
    <div className="rounded-lg border border-line bg-[#eef3f8] p-4">
      <div className="mx-auto aspect-[1/1.414] max-h-[720px] w-full max-w-[510px] overflow-hidden rounded-lg border border-line bg-white p-6 shadow-sm">
        <div className="border-b border-line pb-4">
          <div className="h-1.5 w-20 rounded-full bg-solar" />
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
            <PreviewField label={fieldLabels.installationPowerKw} value={record.installationPowerKw ? `${record.installationPowerKw} kW` : copy.blank} />
            <PreviewField label={fieldLabels.panelsCount} value={record.panelsCount || copy.blank} />
            <PreviewField label={fieldLabels.grossPrice} value={record.grossPrice || copy.blank} />
            <PreviewField label={fieldLabels.financing} value={record.financing || copy.blank} />
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
  const { language } = useLanguage();
  const copy = realizationCopy[language];
  const fieldLabels = contractFieldLabelsByLanguage[language];
  const { loading, profile } = useAuth([
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
  const [previewTitle, setPreviewTitle] = useState<string>(copy.previewTitle);
  const [contractFileName, setContractFileName] = useState("");
  const [processLeads, setProcessLeads] = useState<Lead[]>([]);
  const [processLoading, setProcessLoading] = useState(false);
  const [processError, setProcessError] = useState("");
  const [selectedProcessId, setSelectedProcessId] = useState(demoProcessClient().id);
  const [workflowByProcess, setWorkflowByProcess] = useState<Record<string, WorkflowMap>>({});
  const [documentMessage, setDocumentMessage] = useState("");
  const [showProcessList, setShowProcessList] = useState(true);
  const [processSearch, setProcessSearch] = useState("");
  const [processUpdatedFrom, setProcessUpdatedFrom] = useState("");
  const [processUpdatedTo, setProcessUpdatedTo] = useState("");
  const [processStageFilter, setProcessStageFilter] = useState("");
  const [showContractData, setShowContractData] = useState(false);
  const contractInputRef = useRef<HTMLInputElement | null>(null);
  const processClients = useMemo<ProcessClient[]>(() => {
    const clients = processLeads.map(leadToProcessClient);
    if (clients.length > 0) return clients;
    return profile && isDemoScope(profile.crm_environment) ? demoProcessClients() : [];
  }, [processLeads, profile]);
  const visibleProcessClients = useMemo(() => {
    return processClients.filter((client) => {
      const workflow = workflowForProcess(client, workflowByProcess);
      const stage = operationalStageLabel(workflow, language);
      return (
        matchesProcessSearch(client, processSearch) &&
        isProcessWithinDates(client, processUpdatedFrom, processUpdatedTo) &&
        (!processStageFilter || stage === processStageFilter)
      );
    });
  }, [language, processClients, processSearch, processStageFilter, processUpdatedFrom, processUpdatedTo, workflowByProcess]);
  const selectedProcess = visibleProcessClients.find((client) => client.id === selectedProcessId) || visibleProcessClients[0] || processClients[0] || demoProcessClient();
  const hasProcessClients = processClients.length > 0;
  const selectedWorkflow = workflowForProcess(selectedProcess, workflowByProcess);
  const completion = hasProcessClients ? workflowCompletion(selectedWorkflow) : 0;
  const currentRoleLabel = profile ? copy.roles[profile.role] : "";
  const contractReady = isContractReady(contractData);

  useEffect(() => {
    if (!profile) return;
    setWorkflowByProcess(readStoredWorkflows(workflowStorageKeyFor(profile)));
    const storedProcessId = readSelectedProcessId(selectedProcessStorageKeyFor(profile));
    if (storedProcessId) setSelectedProcessId(storedProcessId);
    void loadProcesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role, profile?.crm_environment]);

  if (loading || !profile) return <LoadingScreen />;
  if (!canUseOperations(profile.role)) return <LoadingScreen />;

  async function loadProcesses() {
    if (!profile) return;

    setProcessLoading(true);
    setProcessError("");

    let query = supabase
      .from("leads")
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)")
      .eq("crm_environment", profile.crm_environment)
      .or("status.eq.Umowa,contract_number.not.is.null")
      .order("updated_at", { ascending: false })
      .limit(250);

    if (profile.role === "handlowiec") {
      query = query.eq("assigned_to", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      setProcessError(error.message || copy.processError);
      setProcessLeads([]);
    } else {
      const nextLeads = (data || []) as Lead[];
      setProcessLeads(nextLeads);
      if (nextLeads.length > 0) {
        setSelectedProcessId((current) => {
          if (nextLeads.some((lead) => lead.id === current)) return current;
          const nextId = nextLeads[0].id;
          saveSelectedProcessId(selectedProcessStorageKeyFor(profile), nextId);
          return nextId;
        });
      }
    }

    setProcessLoading(false);
  }

  function updateContractField(key: keyof DemoCustomerRecord, value: string) {
    const next = { ...contractData, [key]: value };
    setContractData(next);
  }

  function showDemoContract() {
    setPreviewRecord(demoContractData);
    setPreviewTitle(copy.demoContractTitle);
    setDocumentMessage("");
  }

  function fillDemoContract() {
    setContractData(demoContractData);
    setPreviewRecord(demoContractData);
    setPreviewTitle(copy.demoContractTitle);
    setDocumentMessage(copy.demoInserted);
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
    if (!file) return;
    setContractFileName(file.name);
    setDocumentMessage(`${copy.contractAddedPrefix}: ${file.name}. ${copy.contractAddedSuffix}`);
    event.target.value = "";
  }

  function moveWorkflow(step: WorkflowKey) {
    if (!profile || !hasProcessClients) return;

    setWorkflowByProcess((current) => {
      const next = {
        ...current,
        [selectedProcess.id]: toggleWorkflowStatus(workflowForProcess(selectedProcess, current), step)
      };
      saveStoredWorkflows(workflowStorageKeyFor(profile), next);
      return next;
    });
  }

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <section className="app-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-sky/15 bg-sky/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
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

        <section className="grid gap-3">
          <div
            className={showProcessList ? "app-card" : "rounded-lg border border-line bg-white px-4 py-3 shadow-sm"}
            data-guide-target="process-list"
          >
            <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${showProcessList ? "mb-4" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky/10 text-sky">
                  <FolderKanban className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink">{copy.processListTitle}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {visibleProcessClients.length} / {processClients.length} {language === "en" ? "clients in process" : "klientów w procesie"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowProcessList((value) => !value)} className="btn-secondary">
                <ChevronDown
                  className={`h-4 w-4 transition ${showProcessList ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
                {showProcessList
                  ? language === "en" ? "Hide list" : "Ukryj listę"
                  : language === "en" ? "Show list" : "Pokaż listę"}
              </button>
            </div>

            {showProcessList ? (
              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px_220px]">
                <label className="md:col-span-2 xl:col-span-1">
                  <span className="label">Szukaj klienta</span>
                  <input
                    className="field"
                    value={processSearch}
                    onChange={(event) => setProcessSearch(event.target.value)}
                    placeholder="Imię i nazwisko, telefon, umowa albo opiekun"
                  />
                </label>
                <label>
                  <span className="label">Aktualizacja od</span>
                  <input className="field" type="date" value={processUpdatedFrom} onChange={(event) => setProcessUpdatedFrom(event.target.value)} />
                </label>
                <label>
                  <span className="label">Aktualizacja do</span>
                  <input className="field" type="date" value={processUpdatedTo} onChange={(event) => setProcessUpdatedTo(event.target.value)} />
                </label>
                <label>
                  <span className="label">Etap</span>
                  <select className="field" value={processStageFilter} onChange={(event) => setProcessStageFilter(event.target.value)}>
                    <option value="">Wszystkie etapy</option>
                    {[...new Set(processClients.map((client) => operationalStageLabel(workflowForProcess(client, workflowByProcess), language)))].map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {showProcessList && processLoading ? (
              <div className="mb-3 rounded-md border border-line bg-[#f8fafc] p-3 text-sm font-semibold text-muted">
                {copy.processLoading}
              </div>
            ) : null}

            {showProcessList && processError ? (
              <div className="mb-3 rounded-md border border-solar/30 bg-solar/10 p-3 text-sm font-semibold text-[#8a5a00]">
                {copy.processError}
              </div>
            ) : null}

            {showProcessList ? (
            <div>
              {visibleProcessClients.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-line bg-white">
                  <table className="min-w-[1500px] w-full border-collapse text-left text-xs">
                    <thead className="bg-sky/10 text-[11px] font-black uppercase tracking-wide text-ink">
                      <tr>
                        {[
                          language === "en" ? "Contract no." : "Numer umowy",
                          language === "en" ? "Client" : "Imię i nazwisko",
                          copy.phoneLabel,
                          language === "en" ? "Postal code" : "Kod pocztowy",
                          language === "en" ? "Address" : "Adres realizacji",
                          language === "en" ? "Sales owner" : "Opiekun / PH",
                          language === "en" ? "Contract date" : "Data umowy",
                          language === "en" ? "Installation" : "Instalacja / falownik",
                          language === "en" ? "Financing" : "Finansowanie",
                          language === "en" ? "Installation date" : "Termin montażu",
                          copy.statusLabel,
                          language === "en" ? "Gross amount" : "Kwota brutto",
                          language === "en" ? "Notes" : "Uwagi"
                        ].map((heading) => (
                          <th key={heading} className="whitespace-nowrap border-b border-r border-line px-3 py-3 last:border-r-0">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProcessClients.map((client) => {
                        const workflow = workflowForProcess(client, workflowByProcess);
                        const progress = workflowCompletion(workflow);
                        const stage = operationalStageLabel(workflow, language);
                        const isSelected = selectedProcess.id === client.id;
                        const values = [
                          client.contractNumber || copy.noContractNumber,
                          client.fullName,
                          client.phone || "—",
                          client.postalCode || "—",
                          client.address || "—",
                          client.ownerName || copy.noOwner,
                          client.contractDate || formatProcessDate(client.createdAt, language),
                          client.installation || "—",
                          client.financing || "—",
                          client.montageDate || "—",
                          stage,
                          client.grossAmount || "—",
                          client.operationsNote || "—"
                        ];

                        return (
                          <tr
                            key={client.id}
                            onClick={() => {
                              setSelectedProcessId(client.id);
                              saveSelectedProcessId(selectedProcessStorageKeyFor(profile), client.id);
                            }}
                            className={`cursor-pointer border-b border-line transition last:border-b-0 ${
                              isSelected ? "bg-sky/10" : "hover:bg-[#f8fafc]"
                            }`}
                          >
                            {values.map((value, index) => (
                              <td
                                key={`${client.id}-${index}`}
                                className={`max-w-[220px] border-r border-line px-3 py-3 align-top font-semibold last:border-r-0 ${
                                  index === 0 || index === 1 ? "font-black text-ink" : "text-muted"
                                }`}
                              >
                                {index === 10 ? (
                                  <span className="inline-flex whitespace-nowrap rounded-full border border-sky/20 bg-sky/10 px-2 py-1 font-bold text-sky">
                                    {value} · {progress}%
                                  </span>
                                ) : value}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {!processLoading && visibleProcessClients.length === 0 ? (
                <EmptyState
                  title={language === "en" ? "No clients in process" : "Brak klientów w procesie"}
                  description={
                    language === "en"
                      ? "Production data stays empty until a contracted client appears in this environment."
                      : "Dane produkcyjne pozostają puste, dopóki w tym środowisku nie pojawi się klient z umową."
                  }
                />
              ) : null}
            </div>
            ) : null}
          </div>

          {hasProcessClients ? (
          <div className="app-card" data-guide-target="active-process" data-tour-id="tour-process">
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
                <div className="h-full rounded-full bg-sky transition-all" style={{ width: `${completion}%` }} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <PreviewField label={copy.contractLabel} value={selectedProcess.contractNumber || copy.noContractNumber} />
              <PreviewField label={copy.currentStage} value={currentWorkflowStage(selectedWorkflow, copy)} />
              <PreviewField label={copy.statusLabel} value={selectedProcess.status || copy.blank} />
              <PreviewField label={copy.phoneLabel} value={selectedProcess.phone || copy.blank} />
              <PreviewField label={copy.sourceLabel} value={selectedProcess.source || copy.blank} />
              <PreviewField label={copy.updatedLabel} value={formatProcessDate(selectedProcess.updatedAt, language)} />
            </div>

            <button type="button" onClick={useSelectedClientData} className="btn-primary mt-4">
              <FileSignature className="h-4 w-4" aria-hidden="true" />
              {copy.useSelectedClient}
            </button>
          </div>
          ) : (
            <div className="app-card">
              <EmptyState
                title={language === "en" ? "No active process" : "Brak aktywnego procesu"}
                description={
                  language === "en"
                    ? "Select a contracted client when one appears in this CRM environment."
                    : "Wybierz klienta z umową, gdy pojawi się w tym środowisku CRM."
                }
              />
            </div>
          )}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <div
            className={showContractData ? "app-card" : "rounded-lg border border-line bg-white px-4 py-3 shadow-sm"}
            data-guide-target="contract-data"
          >
            <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${showContractData ? "mb-4" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky/10 text-sky">
                  <FolderKanban className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink">{copy.contractDataTitle}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {contractData.clientName || selectedProcess.fullName || copy.contractDataDescription}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowContractData((value) => !value)} className="btn-secondary">
                <ChevronDown
                  className={`h-4 w-4 transition ${showContractData ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
                {showContractData
                  ? language === "en" ? "Hide data" : "Ukryj dane"
                  : language === "en" ? "Show data" : "Pokaż dane"}
              </button>
            </div>

            {showContractData ? (
            <>
            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={showDemoContract} className="btn-secondary">
                <Eye className="h-4 w-4" aria-hidden="true" />
                {copy.showDemoContract}
              </button>
              <button type="button" onClick={fillDemoContract} className="btn-secondary">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {copy.fillDemoData}
              </button>
              <button
                type="button"
                onClick={showCurrentContractPreview}
                disabled={!contractReady}
                className="btn-secondary"
              >
                <FileSignature className="h-4 w-4" aria-hidden="true" />
                {copy.showFormPreview}
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
                {copy.addContractPdf}
              </button>
            </div>

            {contractFileName ? (
              <div className="mb-4 rounded-md border border-sky/20 bg-sky/10 p-3 text-sm font-semibold text-sky">
                {copy.addedContract}: {contractFileName}
              </div>
            ) : null}

            {documentMessage ? (
              <Alert tone="success" className="mb-4">
                {documentMessage}
              </Alert>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {contractFields.map((field) => (
                <label key={field}>
                  <span className="label">{fieldLabels[field]}</span>
                  <input
                    className="field"
                    value={contractData[field]}
                    onChange={(event) => updateContractField(field, event.target.value)}
                  />
                </label>
              ))}
            </div>
            </>
            ) : null}
          </div>

          <div className="app-card">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
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

                return (
                  <div
                    key={item.key}
                    data-guide-target={`workflow-${item.key}`}
                    className={`grid gap-3 rounded-lg border px-4 py-3 transition sm:grid-cols-[1fr_auto] sm:items-center ${statusClasses(
                      status
                    )}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/70">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{copy.roles[item.ownerRole]}</span>
                        <span className="block text-xs">
                          {copy.workflowStatus[status]} · {copy.roles[item.ownerRole]}
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
                      {status === "done" ? copy.reopenStep : copy.markDone}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {previewRecord ? (
          <ModalShell
            open={Boolean(previewRecord)}
            title={previewTitle}
            description={copy.formPreviewDescription}
            onClose={() => setPreviewRecord(null)}
            size="xl"
          >
            <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
              <ContractPreview record={previewRecord} title={previewTitle} copy={copy} fieldLabels={fieldLabels} />
              <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                <h3 className="mb-4 text-base font-bold text-ink">{copy.previewData}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {contractFields.map((field) => (
                    <div key={field} className="rounded-lg border border-line bg-[#f9fbfd] p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {fieldLabels[field]}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-ink">{previewRecord[field] || copy.blank}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ModalShell>
        ) : null}

      </div>
    </AppShell>
  );
}
