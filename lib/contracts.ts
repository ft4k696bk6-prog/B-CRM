export const FINANCING_OPTIONS = [
  ["gotowka", "Gotówka"],
  ["kredyt_do_sprawdzenia", "Kredyt — do sprawdzenia"],
  ["kredyt_do_uruchomienia", "Kredyt — zgoda banku / do uruchomienia"],
  ["kredyt_uruchomiony", "Kredyt — uruchomiony"]
] as const;

export const PRODUCT_OPTIONS = ["PV", "ME", "PV+ME"] as const;

export const MOUNTING_OPTIONS = [
  "Grunt", "Blachodachówka", "Blacha trapezowa", "Gont bitumiczny",
  "Dach płaski / ekierki", "Dachówka ceramiczna", "Dachówka betonowa"
] as const;

export const CONTRACT_TASKS = [
  ["do_domkniecia", "Do domknięcia"],
  ["zamowic_sprzet", "Zamówić sprzęt"],
  ["umowic_montaz", "Umówić montaż"],
  ["do_montazu", "Do montażu"],
  ["zglosic_pge", "Zgłosić PGE"],
  ["do_rozliczenia", "Do rozliczenia"]
] as const;

export type ContractTaskKey = (typeof CONTRACT_TASKS)[number][0];

export type ContractRecord = {
  id: string; lead_id: string; contract_number: string; signed_at: string;
  customer_name: string; phone: string; email: string; postal_code: string;
  city: string; street: string; house_number: string; financing: string;
  credit_amount: number | null; product_type: "PV" | "ME" | "PV+ME";
  pv_power_kwp: number | null; storage_capacity_kwh: number | null;
  panel_power_wp: number | null; panels_count: number | null; has_inverter: boolean;
  inverter_power_kw: number | null; mounting_locations: string[];
  multiple_mounting_locations: boolean; gross_amount: number; backup_power: boolean;
  optimizer_count: number; surge_protection: boolean; grounding: boolean;
  additional_notes: string | null; installation_at: string | null; created_by: string;
  crm_environment: string; created_at: string; updated_at: string;
  creator?: { id: string; full_name: string; email: string | null; manager_id: string | null } | null;
  tasks?: ContractTask[];
};

export type ContractTask = {
  id: string; contract_id: string; task_key: ContractTaskKey; completed: boolean;
  completed_at: string | null; completed_by: string | null; updated_at: string;
};

export function contractProgress(tasks: ContractTask[] = []) {
  const completed = CONTRACT_TASKS.filter(([key]) => tasks.some((task) => task.task_key === key && task.completed)).length;
  return Math.round((completed / CONTRACT_TASKS.length) * 100);
}

