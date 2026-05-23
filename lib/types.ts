export type UserRole =
  | "owner"
  | "admin"
  | "kierownik"
  | "handlowiec"
  | "finance"
  | "viewer"
  | "ksiegowosc"
  | "logistyk"
  | "monter";

export type LegacyUserRole =
  | "menadzer"
  | "manager"
  | "sales"
  | "accounting"
  | "ksiegowy"
  | "logistics"
  | "logistyka"
  | "installer";

export type CrmDataScope = "production" | "demo";

export type LeadStatus =
  | "Nowy"
  | "Przypisany"
  | "Call back"
  | "Spotkanie"
  | "Po spotkaniu"
  | "Oferta wysłana"
  | "Oferta zaakceptowana"
  | "Podpis elektroniczny"
  | "Umowa"
  | "W realizacji"
  | "Zrealizowany"
  | "Zwrot"
  | "Rezygnacja"
  | "Nie odebrał"
  | "Błędny numer"
  | "Do weryfikacji"
  | "Zimna baza";

export type EnergyV2LeadStatus = LeadStatus;

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  manager_id: string | null;
  business_phone: string | null;
  can_view_lead_pool: boolean;
  crm_environment: CrmDataScope;
  created_at: string;
  manager_profile?: Pick<Profile, "id" | "email" | "full_name" | "role" | "crm_environment"> | null;
};

export type Lead = {
  id: string;
  full_name: string;
  postal_code: string | null;
  phone: string;
  email: string | null;
  phone_key: string | null;
  email_key: string | null;
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
  crm_environment: CrmDataScope;
  assigned_profile?: Pick<Profile, "id" | "email" | "full_name" | "role" | "crm_environment"> | null;
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
  | "lead_created"
  | "call_logged"
  | "call_transcript"
  | "ai_call_summary";

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
  crm_environment: CrmDataScope;
  created_at: string;
};

export type LeadCallStatus =
  | "queued"
  | "ringing_user"
  | "connecting_customer"
  | "in_progress"
  | "completed"
  | "failed"
  | "busy"
  | "no_answer"
  | "canceled"
  | "demo_completed";

export type LeadCall = {
  id: string;
  lead_id: string;
  user_id: string;
  crm_environment: CrmDataScope;
  user_phone: string;
  customer_phone: string;
  status: LeadCallStatus;
  recording_consent: boolean;
  twilio_parent_call_sid: string | null;
  twilio_child_call_sid: string | null;
  twilio_recording_sid: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  duration_seconds: number | null;
  transcript: string | null;
  ai_summary: string | null;
  ai_next_step: string | null;
  note_saved_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  user_profile?: Pick<Profile, "id" | "email" | "full_name" | "role"> | null;
};

export type Customer = {
  id: string;
  lead_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  postal_code: string | null;
  address: string | null;
  voivodeship: string | null;
  county: string | null;
  owner_id: string | null;
  crm_environment: CrmDataScope;
  created_at: string;
  updated_at: string;
};

export type ContractStatus =
  | "draft"
  | "manager_review"
  | "ready_to_sign"
  | "sent_for_signature"
  | "signed"
  | "rejected"
  | "canceled";

export type Contract = {
  id: string;
  customer_id: string;
  lead_id: string | null;
  contract_number: string | null;
  status: ContractStatus;
  gross_amount: number | null;
  net_amount: number | null;
  document_path: string | null;
  signed_document_path: string | null;
  signed_at: string | null;
  created_by: string | null;
  approved_by: string | null;
  crm_environment: CrmDataScope;
  created_at: string;
  updated_at: string;
};

export type SignatureProvider = "autenti" | "manual" | "none";

export type SignatureRequestStatus =
  | "draft"
  | "created"
  | "sent"
  | "opened"
  | "signed"
  | "declined"
  | "expired"
  | "failed";

export type SignatureRequest = {
  id: string;
  contract_id: string;
  provider: SignatureProvider;
  provider_request_id: string | null;
  status: SignatureRequestStatus;
  signer_email: string | null;
  signer_phone: string | null;
  document_hash: string | null;
  evidence: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProcessCaseStatus = "active" | "blocked" | "completed" | "canceled";

export type ProcessCase = {
  id: string;
  customer_id: string;
  contract_id: string | null;
  status: ProcessCaseStatus;
  current_step: string;
  admin_override_by: string | null;
  admin_override_reason: string | null;
  crm_environment: CrmDataScope;
  created_at: string;
  updated_at: string;
};

export type EquipmentKind = "inverter" | "battery" | "panel" | "accessory" | "meter" | "other";

export type EquipmentModel = {
  id: string;
  brand: string;
  model: string;
  kind: EquipmentKind;
  phase: "one_phase" | "three_phase" | "unknown";
  battery_voltage: "lv_48v" | "hv" | "none" | "unknown";
  protocols: string[];
  notes: string | null;
  source_url: string | null;
};

export type CompatibilityVerdict = "compatible" | "conditional" | "unknown" | "not_compatible";

export type CompatibilityRule = {
  id: string;
  inverter_model_id: string;
  battery_model_id: string;
  verdict: CompatibilityVerdict;
  reason: string;
  source_url: string | null;
  firmware_note: string | null;
  updated_at: string;
};

export type EmailSendLockStatus = "claimed" | "sent" | "failed" | "skipped" | "bounced_invalid" | "suppressed";

export type EmailSuppressionReason = "invalid_address" | "blocked_sector" | "manual";

export type EmailSendLock = {
  id: string;
  dedupe_key: string;
  crm_environment: CrmDataScope;
  scope: string;
  recipient_email: string;
  normalized_recipient_email: string;
  status: EmailSendLockStatus;
  reason: EmailSuppressionReason | null;
  claimed_by: string | null;
  provider_message_id: string | null;
  metadata: Record<string, unknown>;
  attempt_count: number;
  first_claimed_at: string;
  last_seen_at: string;
  sent_at: string | null;
  follow_up_eligible_at: string | null;
  updated_at: string;
};

export type OfferDeliveryStatus =
  | "draft"
  | "queued"
  | "sent"
  | "opened"
  | "clicked"
  | "downloaded"
  | "failed"
  | "bounced_invalid"
  | "suppressed";

export type OfferDelivery = {
  id: string;
  dedupe_key: string | null;
  lead_id: string | null;
  customer_id: string | null;
  campaign_key: string | null;
  template_key: string | null;
  sent_by: string | null;
  recipient_email: string;
  normalized_recipient_email: string;
  status: OfferDeliveryStatus;
  public_token: string;
  provider_message_id: string | null;
  failure_reason: string | null;
  sent_at: string | null;
  follow_up_eligible_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  downloaded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationKind =
  | "new_lead"
  | "lead_assigned"
  | "callback_due"
  | "meeting_due"
  | "offer_opened"
  | "contract_ready"
  | "process_blocked";

export type CrmNotification = {
  id: string;
  user_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export type CustomerStatus = "active" | "inactive" | "blocked" | "archived";
export type CustomerType = "person" | "company";

export type EnergyCustomer = {
  id: string;
  lead_id: string | null;
  owner_id: string | null;
  crm_environment: CrmDataScope;
  customer_type: CustomerType;
  status: CustomerStatus;
  full_name: string;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  voivodeship: string | null;
  county: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EnergyContractStatus =
  | ContractStatus
  | "sent"
  | "active"
  | "in_realization"
  | "completed"
  | "cancelled"
  | "archived";

export type ContractProductType = "pv" | "heat_pump" | "energy_storage" | "boiler" | "rainwater" | "other";

export type EnergyContract = {
  id: string;
  customer_id: string;
  lead_id: string | null;
  owner_id: string | null;
  crm_environment: CrmDataScope;
  contract_number: string;
  status: EnergyContractStatus;
  product_type: ContractProductType;
  signed_at: string | null;
  starts_at: string | null;
  gross_amount: number | null;
  net_amount: number | null;
  currency: string;
  document_file_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EnergySignatureProvider = SignatureProvider | "docusign" | "signius" | "other";
export type EnergySignatureRequestStatus = SignatureRequestStatus | "queued" | "cancelled";

export type EnergySignatureRequest = {
  id: string;
  contract_id: string;
  customer_id: string;
  requested_by: string | null;
  crm_environment: CrmDataScope;
  provider: EnergySignatureProvider;
  status: EnergySignatureRequestStatus;
  recipient_email: string | null;
  recipient_phone: string | null;
  external_id: string | null;
  signing_url: string | null;
  sent_at: string | null;
  opened_at: string | null;
  signed_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EnergyProcessCaseStatus =
  | ProcessCaseStatus
  | "not_started"
  | "in_progress"
  | "waiting_for_customer"
  | "waiting_for_backoffice"
  | "cancelled";

export type ProcessPriority = "low" | "normal" | "high" | "urgent";

export type EnergyProcessCase = {
  id: string;
  contract_id: string;
  customer_id: string;
  lead_id: string | null;
  owner_id: string | null;
  crm_environment: CrmDataScope;
  case_number: string | null;
  status: EnergyProcessCaseStatus;
  priority: ProcessPriority;
  current_step_key: string | null;
  due_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProcessStepStatus = "pending" | "ready" | "in_progress" | "waiting" | "blocked" | "completed" | "skipped" | "cancelled";

export type ProcessStep = {
  id: string;
  process_case_id: string;
  owner_role: UserRole | LegacyUserRole | "admin";
  assigned_to: string | null;
  step_key: string;
  title: string;
  status: ProcessStepStatus;
  sort_order: number;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type InventoryCategory =
  | "panel"
  | "inverter"
  | "battery"
  | "heat_pump"
  | "boiler"
  | "rainwater"
  | "mounting"
  | "accessory"
  | "service"
  | "other";

export type InventoryItemStatus = "active" | "inactive" | "discontinued" | "archived";

export type InventoryItem = {
  id: string;
  crm_environment: CrmDataScope;
  sku: string;
  name: string;
  category: InventoryCategory;
  manufacturer: string | null;
  model: string | null;
  status: InventoryItemStatus;
  unit: string;
  quantity_available: number;
  quantity_reserved: number;
  min_quantity: number;
  net_price: number | null;
  gross_price: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EquipmentCompatibilityRelation = "compatible" | "requires" | "replaces" | "incompatible";
export type EquipmentCompatibilityStatus = "active" | "inactive" | "archived";

export type EquipmentCompatibilityRecord = {
  id: string;
  crm_environment: CrmDataScope;
  source_item_id: string;
  target_item_id: string;
  relation_type: EquipmentCompatibilityRelation;
  status: EquipmentCompatibilityStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EquipmentBrand = {
  id: string;
  name: string;
  slug: string;
  website_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CompatibilitySource = {
  id: string;
  title: string;
  publisher: string | null;
  source_url: string;
  retrieved_at: string;
  published_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AssistantQuery = {
  id: string;
  user_id: string | null;
  lead_id: string | null;
  crm_environment: CrmDataScope;
  assistant_area: "technical" | "operations";
  question: string;
  answer: string | null;
  verdict: CompatibilityVerdict | null;
  missing_data: string[];
  confirmed_action: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DeliveryChannel = "email" | "sms" | "phone" | "portal" | "paper" | "other";
export type EnergyOfferDeliveryStatus =
  | OfferDeliveryStatus
  | "delivered"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

export type EnergyOfferDelivery = {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  contract_id: string | null;
  owner_id: string | null;
  crm_environment: CrmDataScope;
  channel: DeliveryChannel;
  status: EnergyOfferDeliveryStatus;
  recipient: string | null;
  subject: string | null;
  external_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  downloaded_at: string | null;
  public_token: string | null;
  responded_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MailEventType =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "visited"
  | "clicked"
  | "downloaded"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "failed";
export type MailEventStatus = "received" | "processed" | "ignored" | "failed";

export type MailEvent = {
  id: string;
  offer_delivery_id: string | null;
  signature_request_id: string | null;
  customer_id: string | null;
  crm_environment: CrmDataScope;
  provider: string | null;
  message_id: string | null;
  event_type: MailEventType;
  status: MailEventStatus;
  occurred_at: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ImportEntityType = "leads" | "customers" | "contracts" | "inventory_items" | "equipment_compatibility";
export type ImportBatchStatus = "queued" | "processing" | "completed" | "completed_with_errors" | "failed" | "cancelled";

export type ImportBatch = {
  id: string;
  created_by: string | null;
  crm_environment: CrmDataScope;
  source: string;
  entity_type: ImportEntityType;
  status: ImportBatchStatus;
  file_name: string | null;
  file_path: string | null;
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  started_at: string | null;
  finished_at: string | null;
  error_summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ImportBatchRowStatus = "pending" | "imported" | "skipped" | "failed";

export type ImportBatchRow = {
  id: string;
  import_batch_id: string;
  row_number: number;
  status: ImportBatchRowStatus;
  entity_id: string | null;
  raw_data: Record<string, unknown>;
  normalized_data: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
};

export type EnergyNotificationType =
  | "new_lead"
  | "lead_assigned"
  | "callback_due"
  | "meeting_due"
  | "offer_opened"
  | "contract_ready"
  | "process_step_due"
  | "process_blocked"
  | "signature_update"
  | "offer_update"
  | "inventory_low"
  | "import_finished"
  | "custom";

export type NotificationStatus = "unread" | "read" | "archived" | "dismissed";

export type EnergyNotification = {
  id: string;
  recipient_id: string | null;
  actor_id: string | null;
  crm_environment: CrmDataScope;
  notification_type: EnergyNotificationType;
  status: NotificationStatus;
  priority: ProcessPriority;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
