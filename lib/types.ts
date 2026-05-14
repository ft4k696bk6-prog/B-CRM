export type UserRole = "admin" | "sales";

export type LeadStatus =
  | "Nowy"
  | "Przypisany"
  | "Call back"
  | "Spotkanie"
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
  created_at: string;
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
