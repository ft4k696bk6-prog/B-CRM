import { referenceContractData, type ContractCustomerRecord } from "@/lib/contract-documents";
import { normalizeRole } from "@/lib/roles";
import type { Lead, Profile, UserRole } from "@/lib/types";

export type WorkflowStatus = "pending" | "active" | "done";
export type WorkflowKey = "sales" | "manager" | "accounting" | "logistics" | "installer";
export type WorkflowMap = Record<WorkflowKey, WorkflowStatus>;

export type ProcessClient = {
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

export const workflowSteps: Array<{ key: WorkflowKey; ownerRole: UserRole }> = [
  { key: "sales", ownerRole: "handlowiec" },
  { key: "manager", ownerRole: "kierownik" },
  { key: "accounting", ownerRole: "ksiegowosc" },
  { key: "logistics", ownerRole: "logistyk" },
  { key: "installer", ownerRole: "monter" }
];

export const initialWorkflow: WorkflowMap = {
  sales: "done",
  manager: "active",
  accounting: "pending",
  logistics: "pending",
  installer: "pending"
};

const workflowStorageKeyPrefix = "bcrm-process-workflows";
const selectedProcessStorageKeyPrefix = "bcrm-selected-process";

export function workflowStorageKeyFor(profile: Pick<Profile, "id" | "crm_environment">) {
  return `${workflowStorageKeyPrefix}:${profile.crm_environment}:${profile.id}`;
}

export function selectedProcessStorageKeyFor(profile: Pick<Profile, "id" | "crm_environment">) {
  return `${selectedProcessStorageKeyPrefix}:${profile.crm_environment}:${profile.id}`;
}

export function workflowCompletion(workflow: WorkflowMap) {
  const values = Object.values(workflow);
  return Math.round((values.filter((value) => value === "done").length / values.length) * 100);
}

export function normalizeWorkflowState(workflow: Partial<Record<WorkflowKey, WorkflowStatus>>): WorkflowMap {
  const next: WorkflowMap = { ...initialWorkflow, ...workflow };
  const firstOpenStep = workflowSteps.find((item) => next[item.key] !== "done");

  workflowSteps.forEach((item) => {
    if (next[item.key] === "done") return;
    next[item.key] = firstOpenStep?.key === item.key ? "active" : "pending";
  });

  return next;
}

export function readStoredWorkflows(storageKey: string): Record<string, WorkflowMap> {
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

export function saveStoredWorkflows(storageKey: string, workflows: Record<string, WorkflowMap>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(workflows));
}

export function readSelectedProcessId(storageKey: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(storageKey) || "";
}

export function saveSelectedProcessId(storageKey: string, processId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, processId);
}

export function defaultWorkflowForProcess(client: ProcessClient): WorkflowMap {
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

export function toggleWorkflowStatus(current: WorkflowMap, step: WorkflowKey): WorkflowMap {
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

export function workflowForProcess(client: ProcessClient, workflows: Record<string, WorkflowMap>) {
  if (!client.id) return normalizeWorkflowState(initialWorkflow);
  return normalizeWorkflowState(workflows[client.id] || defaultWorkflowForProcess(client));
}

export function leadToProcessClient(lead: Lead): ProcessClient {
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

export function emptyProcessClient(): ProcessClient {
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

export function contractDataFromProcess(client: ProcessClient): ContractCustomerRecord {
  return {
    ...referenceContractData,
    contractNumber: client.contractNumber || referenceContractData.contractNumber,
    clientName: client.fullName || referenceContractData.clientName,
    phone: client.phone || referenceContractData.phone,
    sellerName: client.ownerName || referenceContractData.sellerName
  };
}

export function formatProcessDate(value: string | null, locale: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
