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
  ["verification", "Do weryfikacji"],
  ["equipment_to_order", "Sprzęt do zamówienia"],
  ["installation_to_schedule", "Montaż do umówienia"],
  ["installation_scheduled", "Montaż umówiony"],
  ["installation_confirmation", "Potwierdź montaż"],
  ["settlement", "Do rozliczenia"],
  ["settled", "Rozliczone"],
  ["resigned", "Rezygnacja"],
  ["paused", "Wstrzymana"],
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number][0];
export type ContractSubmissionStatus = "draft" | "submitted";
export const ACTIVE_CONTRACT_STATUSES: ContractStatus[] = [
  "incomplete",
  "verification",
  "equipment_to_order",
  "installation_to_schedule",
  "installation_scheduled",
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
  mounting_locations: string[];
  multiple_mounting_locations: boolean;
  gross_amount: number;
  backup_power: boolean;
  optimizer_count: number;
  surge_protection: boolean;
  grounding: boolean;
  additional_notes: string | null;
  installation_at: string | null;
  created_by: string;
  crm_environment: string;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    full_name: string;
    email: string | null;
    manager_id: string | null;
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
  const order: ContractStatus[] = [
    "incomplete",
    "verification",
    "equipment_to_order",
    "installation_to_schedule",
    "installation_scheduled",
    "installation_confirmation",
    "settlement",
    "settled",
  ];
  if (contract.process_status === "settled") return 100;
  const index = order.indexOf(contract.process_status || "verification");
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
}) {
  if (input.role === "owner" || input.role === "admin") return true;
  if (input.role === "handlowiec") return input.createdBy === input.profileId;
  if (input.submissionStatus !== "submitted") return false;
  if (input.role === "menadzer")
    return (
      input.createdBy === input.profileId ||
      input.creatorManagerId === input.profileId
    );
  return true;
}
