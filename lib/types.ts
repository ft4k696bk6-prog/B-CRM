export type UserRole =
  | "owner"
  | "admin"
  | "menadzer"
  | "handlowiec"
  | "finance"
  | "viewer"
  | "ksiegowosc"
  | "logistyk"
  | "monter";

export type LegacyUserRole =
  | "manager"
  | "sales"
  | "accounting"
  | "ksiegowy"
  | "logistics"
  | "logistyka"
  | "installer";

export type LeadStatus =
  | "Nowy"
  | "Przypisany"
  | "Call back"
  | "Spotkanie"
  | "Po spotkaniu"
  | "Umowa"
  | "Zwrot"
  | "Rezygnacja"
  | "Nie odebrał"
  | "Błędny numer"
  | "Do weryfikacji";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  manager_id: string | null;
  created_at: string;
  manager_profile?: Pick<Profile, "id" | "email" | "full_name" | "role"> | null;
};

export type Lead = {
  id: string;
  full_name: string;
  postal_code: string | null;
  phone: string;
  address: string | null;
  voivodeship: string | null;
  county: string | null;
  status: LeadStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  source: string | null;
  resignation_reason: string | null;
  callback_at: string | null;
  meeting_at: string | null;
  meeting_address: string | null;
  meeting_note: string | null;
  contract_number: string | null;
  assigned_profile?: Pick<Profile, "id" | "email" | "full_name" | "role"> | null;
};

export type LeadHistory = {
  id: string;
  lead_id: string;
  user_id: string | null;
  action_type: string;
  description: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  user_profile?: Pick<Profile, "id" | "email" | "full_name" | "role"> | null;
};

export type AdminLeadFilters = {
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
  openedFrom: string;
  openedTo: string;
  postalCode: string;
  voivodeship: string;
  county: string;
  status: string;
  assignedTo: string;
};

export type SortOption = {
  column: keyof Pick<
    Lead,
    | "created_at"
    | "updated_at"
    | "last_opened_at"
    | "full_name"
    | "postal_code"
    | "status"
  >;
  direction: "asc" | "desc";
};

export type ActivityType =
  | "comment"
  | "status_change"
  | "callback_scheduled"
  | "meeting_scheduled"
  | "meeting_address_changed"
  | "contract_number_set"
  | "resignation_recorded"
  | "file_uploaded"
  | "file_deleted"
  | "assigned"
  | "unassigned"
  | "lead_created";

export type LeadActivity = {
  id: string;
  lead_id: string;
  user_id: string | null;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user_profile?: Pick<Profile, "id" | "email" | "full_name" | "role"> | null;
};

export type LeadFile = {
  id: string;
  lead_id: string;
  uploaded_by: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  created_at: string;
  user_profile?: Pick<Profile, "id" | "email" | "full_name" | "role"> | null;
};

export type LeadReminder = {
  id: string;
  lead_id: string;
  created_by: string | null;
  reminder_type: "callback" | "meeting" | "followup" | "custom";
  title: string;
  description: string | null;
  reminder_at: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  user_profile?: Pick<Profile, "id" | "email" | "full_name" | "role"> | null;
};

export type DailyReport = {
  id: string;
  user_id: string;
  report_date: string;
  total_leads_worked: number;
  total_activities: number;
  calls_made: number;
  meetings_scheduled: number;
  contracts_signed: number;
  resignations_recorded: number;
  summary: string | null;
  created_at: string;
};
