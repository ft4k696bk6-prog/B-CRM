import type { ArchiveReason, ContractWorkflow } from "@/lib/contract-workflow";

export const FINANCING_OPTIONS = [
  ["gotowka", "Gotówka"],
  ["kredyt_do_sprawdzenia", "Kredyt — do sprawdzenia"],
  ["kredyt_do_uruchomienia", "Kredyt — zgoda banku / do uruchomienia"],
  ["kredyt_uruchomiony", "Kredyt — uruchomiony"],
] as const;

export const PRODUCT_OPTIONS = ["PV", "ME", "PV+ME"] as const;

export const MOUNTING_OPTIONS = [
  "Grunt",
  "Blachodachówka",
  "Blacha trapezowa",
  "Gont bitumiczny",
  "Dach płaski / ekierki",
  "Dachówka ceramiczna",
  "Dachówka betonowa",
] as const;

export const CONTRACT_STATUSES = [
  ["incomplete", "Umowa niekompletna"],
  ["verification", "Dział weryfikacji"],
  ["equipment_ordered", "Sprzęt zamówiony"],
  ["installation_scheduled", "Montaż umówiony"],
  ["invoice_issued", "Faktura wystawiona"],
  ["settled", "Rozliczone"],
  ["commission_paid", "Prowizja wypłacona"],
  ["resigned", "Rezygnacja"],
  // Legacy statuses kept so historical snapshots still render correctly.
  ["equipment_to_order", "Dział weryfikacji"],
  ["installation_to_schedule", "Sprzęt zamówiony"],
  ["installation_confirmation", "Montaż umówiony"],
  ["settlement", "Faktura wystawiona"],
  ["paused", "Wstrzymana"],
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number][0];
export type ContractSubmissionStatus = "draft" | "submitted";
export const ACTIVE_CONTRACT_STATUSES: ContractStatus[] = [
  "incomplete",
  "verification",
  "equipment_ordered",
  "installation_scheduled",
  "invoice_issued",
  "settled",
  "commission_paid",
  "equipment_to_order",
  "installation_to_schedule",
  "installation_confirmation",
  "settlement",
];
export const CONTRACT_TASKS = [
  ["zamowic_sprzet", "Zamówić sprzęt"],
  ["umowic_montaz", "Umówić montaż"],
  ["do_montazu", "Do montażu"],
  ["zglosic_pge", "Zgłosić PGE"],
  ["do_rozliczenia", "Do rozliczenia"],
] as const;

export type ContractTaskKey = (typeof CONTRACT_TASKS)[number][0];

export type ContractRecord = {
  id: string;
  lead_id: string;
  contract_number: string;
  signed_at: string;
  customer_name: string;
  phone: string;
  email: string;
  postal_code: string;
  city: string;
  street: string;
  house_number: string;
  financing: string;
  credit_amount: number | null;
  product_type: "PV" | "ME" | "PV+ME";
  pv_power_kwp: number | null;
  storage_capacity_kwh: number | null;
  panel_power_wp: number | null;
  panels_count: number | null;
  has_inverter: boolean;
  inverter_power_kw: number | null;
  inverter_phase: "1F" | "3F" | null;
  mounting_locations: string[];
  multiple_mounting_locations: boolean;
  gross_amount: number;
  backup_power: boolean;
  optimizer_count: number;
  surge_protection: boolean;
  grounding: boolean;
  additional_notes: string | null;
  installation_at: string | null;
  installer_id: string | null;
  installer_name: string | null;
  created_by: string;
  crm_environment: string;
  created_at: string;
  updated_at: string;
  workflow?: ContractWorkflow | null;
  archived_at?: string | null;
  archive_reason?: ArchiveReason | null;
  equipment_ordered?: boolean;
  installation_scheduled?: boolean;
  creator?: {
    id: string;
    full_name: string;
    email: string | null;
    manager_id: string | null;
    manager_name?: string | null;
  } | null;
  installer?: {
    id: string;
    full_name: string;
  } | null;
  tasks?: ContractTask[];
  submission_status?: ContractSubmissionStatus;
  submitted_at?: string | null;
  process_status?: ContractStatus;
  process_note?: string | null;
  is_process_visible?: boolean;
  resignation_note?: string | null;
  resigned_at?: string | null;
  commission_margin_net?: number;
  commission_percent?: number;
  commission_amount?: number;
  management_notes?: Array<{
    id: string;
    author: string;
    content: string;
    created_at: string;
  }>;
  files?: Array<{
    id: string;
    name: string;
    kind: "contract_pdf" | "photo" | "video";
    path: string;
    mime: string;
    drive_file_id?: string | null;
    drive_folder_id?: string | null;
    drive_web_view_link?: string | null;
    drive_sync_error?: string | null;
    drive_synced_at?: string | null;
  }>;
};

export function calculateCommission(marginNet: number, percent: number) {
  if (!Number.isFinite(marginNet) || !Number.isFinite(percent)) return 0;
  return Math.round(Math.max(0, marginNet) * Math.min(100, Math.max(0, percent))) / 100;
}

export type ContractTask = {
  id: string;
  contract_id: string;
  task_key: ContractTaskKey;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  updated_at: string;
};

export function contractProgress(
  contract: Pick<ContractRecord, "process_status"> | ContractTask[] = [],
) {
  if (Array.isArray(contract)) return 0;
  const aliases: Partial<Record<ContractStatus, ContractStatus>> = {
    equipment_to_order: "verification",
    installation_to_schedule: "equipment_ordered",
    installation_confirmation: "installation_scheduled",
    settlement: "invoice_issued",
  };
  const order: ContractStatus[] = [
    "incomplete",
    "verification",
    "equipment_ordered",
    "installation_scheduled",
    "invoice_issued",
    "settled",
    "commission_paid",
  ];
  const status = aliases[contract.process_status || "verification"] || contract.process_status || "verification";
  if (status === "commission_paid") return 100;
  const index = order.indexOf(status);
  return Math.max(0, Math.round((index / (order.length - 1)) * 100));
}

export function contractStatusLabel(status?: ContractStatus) {
  return (
    CONTRACT_STATUSES.find(([key]) => key === status)?.[1] || "Do weryfikacji"
  );
}
export function contractDisplayStatus(
  contract: Pick<ContractRecord, "submission_status" | "process_status">,
) {
  return contract.submission_status === "draft"
    ? "Wersja robocza"
    : contractStatusLabel(contract.process_status);
}

export function canViewContractForRole(input: {
  role: string;
  profileId: string;
  createdBy: string;
  creatorManagerId?: string | null;
  submissionStatus: ContractSubmissionStatus;
  archiveReason?: ArchiveReason | null;
  processStatus?: ContractStatus;
}) {
  if (input.role === "owner" || input.role === "admin") return true;
  if (input.role === "handlowiec") {
    const resigned = input.archiveReason === "resigned" || input.processStatus === "resigned";
    return input.createdBy === input.profileId && !resigned;
  }
  if (input.role === "menadzer")
    return (
      input.createdBy === input.profileId ||
      (input.submissionStatus === "submitted" &&
        input.creatorManagerId === input.profileId)
    );
  if (input.submissionStatus !== "submitted") return false;
  return true;
}

export function missingRequiredContractAttachments(
  files: Array<{ kind: "contract_pdf" | "photo" | "video" }> = [],
) {
  const missing: string[] = [];
  if (!files.some((file) => file.kind === "contract_pdf")) missing.push("PDF umowy");
  if (!files.some((file) => file.kind === "photo")) missing.push("co najmniej jedno zdjęcie");
  return missing;
}
