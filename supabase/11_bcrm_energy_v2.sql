-- B-CRM Energy V2 data layer.
-- Adds post-sales entities, status constraints and manager-level "kierownik" role support.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (
    role in (
      'owner',
      'admin',
      'handlowiec',
      'menadzer',
      'kierownik',
      'finance',
      'viewer',
      'ksiegowosc',
      'logistyk',
      'monter',
      'sales',
      'manager'
    )
  );

alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check check (
    status in (
      'Nowy',
      'Przypisany',
      'Call back',
      'Spotkanie',
      'Po spotkaniu',
      'Oferta wysłana',
      'Oferta zaakceptowana',
      'Podpis elektroniczny',
      'Umowa',
      'W realizacji',
      'Zrealizowany',
      'Zwrot',
      'Rezygnacja',
      'Nie odebrał',
      'Błędny numer',
      'Do weryfikacji',
      'Zimna baza'
    )
  );

alter table public.leads
  add column if not exists email text,
  add column if not exists phone_key text,
  add column if not exists email_key text;

update public.leads
set
  phone_key = case
    when nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '') is null then phone_key
    when length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) = 9
      then 'phone:+48' || regexp_replace(coalesce(phone, ''), '\D', '', 'g')
    when length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) = 11
      and regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '48%'
      then 'phone:+' || regexp_replace(coalesce(phone, ''), '\D', '', 'g')
    else 'phone:' || regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  end,
  email_key = case
    when email is null or position('@' in email) = 0 then email_key
    else 'email:' || lower(trim(email))
  end
where phone_key is null or email_key is null;

create index if not exists leads_scope_status_updated_idx on public.leads(crm_environment, status, updated_at desc);
create index if not exists leads_scope_assigned_updated_idx on public.leads(crm_environment, assigned_to, updated_at desc);
create index if not exists leads_scope_created_idx on public.leads(crm_environment, created_at desc);
create index if not exists leads_phone_key_idx on public.leads(phone_key);
create index if not exists leads_email_key_idx on public.leads(email_key);

create or replace function public.is_menadzer()
returns boolean
as $$
  select public.current_user_role() in ('menadzer', 'kierownik', 'manager');
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_kierownik()
returns boolean
as $$
  select public.current_user_role() in ('kierownik', 'menadzer', 'manager');
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_energy_operations_role()
returns boolean
as $$
  select public.current_user_role() in ('ksiegowosc', 'logistyk', 'monter', 'finance', 'viewer');
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_admin_or_menadzer()
returns boolean
as $$
  select public.current_user_role() in ('owner', 'admin', 'menadzer', 'kierownik', 'manager');
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.can_manage_lead(p_assigned_to uuid)
returns boolean
as $$
  select
    public.is_admin()
    or (
      public.is_menadzer()
      and (
        p_assigned_to is null
        or public.is_manager_salesperson(p_assigned_to)
      )
    );
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.can_view_energy_v2_record(p_owner_id uuid)
returns boolean
as $$
  select
    public.is_admin()
    or public.is_energy_operations_role()
    or p_owner_id = auth.uid()
    or (
      public.is_kierownik()
      and (
        p_owner_id is null
        or public.is_manager_salesperson(p_owner_id)
      )
    );
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.can_edit_energy_v2_record(p_owner_id uuid)
returns boolean
as $$
  select
    public.is_admin()
    or p_owner_id = auth.uid()
    or (
      public.is_kierownik()
      and (
        p_owner_id is null
        or public.is_manager_salesperson(p_owner_id)
      )
    );
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := 'handlowiec';
begin
  if new.raw_user_meta_data ->> 'role' in (
    'admin',
    'handlowiec',
    'menadzer',
    'kierownik',
    'owner',
    'finance',
    'viewer',
    'ksiegowosc',
    'logistyk',
    'monter',
    'sales',
    'manager'
  ) then
    requested_role := new.raw_user_meta_data ->> 'role';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    requested_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role;

  return new;
end;
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  customer_type text not null default 'person' check (customer_type in ('person', 'company')),
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked', 'archived')),
  full_name text not null,
  email text,
  phone text,
  tax_id text,
  address text,
  postal_code text,
  city text,
  voivodeship text,
  county text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  contract_number text not null,
  status text not null default 'draft' check (
    status in ('draft', 'sent', 'signed', 'active', 'in_realization', 'completed', 'cancelled', 'archived')
  ),
  product_type text not null default 'pv' check (
    product_type in ('pv', 'heat_pump', 'energy_storage', 'boiler', 'rainwater', 'other')
  ),
  signed_at timestamptz,
  starts_at date,
  gross_amount numeric(12,2),
  net_amount numeric(12,2),
  currency text not null default 'PLN',
  document_file_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_contract_number_scope_key unique (crm_environment, contract_number)
);

create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  provider text not null default 'manual' check (provider in ('manual', 'autenti', 'docusign', 'signius', 'other')),
  status text not null default 'draft' check (
    status in ('draft', 'queued', 'sent', 'opened', 'signed', 'declined', 'expired', 'cancelled', 'failed')
  ),
  recipient_email text,
  recipient_phone text,
  external_id text,
  signing_url text,
  sent_at timestamptz,
  opened_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.process_cases (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  case_number text,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'waiting_for_customer', 'waiting_for_backoffice', 'blocked', 'completed', 'cancelled')
  ),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  current_step_key text,
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint process_cases_case_number_scope_key unique (crm_environment, case_number)
);

create table if not exists public.process_steps (
  id uuid primary key default gen_random_uuid(),
  process_case_id uuid not null references public.process_cases(id) on delete cascade,
  owner_role text not null check (owner_role in ('handlowiec', 'finance', 'ksiegowosc', 'logistyk', 'monter', 'menadzer', 'kierownik', 'admin')),
  assigned_to uuid references public.profiles(id) on delete set null,
  step_key text not null,
  title text not null,
  status text not null default 'pending' check (
    status in ('pending', 'ready', 'in_progress', 'waiting', 'blocked', 'completed', 'skipped', 'cancelled')
  ),
  sort_order integer not null default 0,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint process_steps_case_key_unique unique (process_case_id, step_key)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  sku text not null,
  name text not null,
  category text not null check (
    category in ('panel', 'inverter', 'battery', 'heat_pump', 'boiler', 'rainwater', 'mounting', 'accessory', 'service', 'other')
  ),
  manufacturer text,
  model text,
  status text not null default 'active' check (status in ('active', 'inactive', 'discontinued', 'archived')),
  unit text not null default 'pcs',
  quantity_available numeric(12,3) not null default 0,
  quantity_reserved numeric(12,3) not null default 0,
  min_quantity numeric(12,3) not null default 0,
  net_price numeric(12,2),
  gross_price numeric(12,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_sku_scope_key unique (crm_environment, sku),
  constraint inventory_items_quantities_check check (
    quantity_available >= 0 and quantity_reserved >= 0 and min_quantity >= 0
  )
);

create table if not exists public.equipment_compatibility (
  id uuid primary key default gen_random_uuid(),
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  source_item_id uuid not null references public.inventory_items(id) on delete cascade,
  target_item_id uuid not null references public.inventory_items(id) on delete cascade,
  relation_type text not null default 'compatible' check (
    relation_type in ('compatible', 'requires', 'replaces', 'incompatible')
  ),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_compatibility_pair_unique unique (source_item_id, target_item_id, relation_type),
  constraint equipment_compatibility_not_self_check check (source_item_id <> target_item_id)
);

create table if not exists public.equipment_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.equipment_brands(id) on delete set null,
  brand_name text not null,
  model_name text not null,
  equipment_kind text not null check (equipment_kind in ('inverter', 'battery', 'panel', 'accessory', 'meter', 'other')),
  phase text not null default 'unknown' check (phase in ('one_phase', 'three_phase', 'unknown')),
  battery_voltage text not null default 'unknown' check (battery_voltage in ('lv_48v', 'hv', 'none', 'unknown')),
  protocols text[] not null default '{}'::text[],
  source_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_models_brand_model_unique unique (brand_name, model_name, equipment_kind)
);

create table if not exists public.compatibility_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text,
  source_url text not null,
  retrieved_at timestamptz not null default now(),
  published_at date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compatibility_rules (
  id uuid primary key default gen_random_uuid(),
  inverter_model_id uuid references public.equipment_models(id) on delete cascade,
  battery_model_id uuid references public.equipment_models(id) on delete cascade,
  verdict text not null check (verdict in ('compatible', 'conditional', 'unknown', 'not_compatible')),
  voltage_note text,
  protocol_note text,
  bms_note text,
  firmware_note text,
  risk_note text,
  source_id uuid references public.compatibility_sources(id) on delete set null,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compatibility_rules_pair_unique unique (inverter_model_id, battery_model_id)
);

create table if not exists public.assistant_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  assistant_area text not null check (assistant_area in ('technical', 'operations')),
  question text not null,
  answer text,
  verdict text check (verdict in ('compatible', 'conditional', 'unknown', 'not_compatible')),
  missing_data text[] not null default '{}'::text[],
  confirmed_action boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.offer_deliveries (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  sent_by uuid references public.profiles(id) on delete set null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  campaign_key text,
  template_key text,
  channel text not null default 'email' check (channel in ('email', 'sms', 'phone', 'portal', 'paper', 'other')),
  status text not null default 'draft' check (
    status in (
      'draft',
      'queued',
      'sent',
      'delivered',
      'opened',
      'clicked',
      'downloaded',
      'accepted',
      'rejected',
      'expired',
      'failed',
      'bounced_invalid',
      'suppressed',
      'cancelled'
    )
  ),
  recipient text,
  recipient_email text,
  normalized_recipient_email text,
  subject text,
  external_id text,
  provider_message_id text,
  failure_reason text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  downloaded_at timestamptz,
  public_token text unique not null default encode(gen_random_bytes(18), 'hex'),
  responded_at timestamptz,
  follow_up_eligible_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mail_events (
  id uuid primary key default gen_random_uuid(),
  offer_delivery_id uuid references public.offer_deliveries(id) on delete set null,
  signature_request_id uuid references public.signature_requests(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  provider text,
  message_id text,
  event_type text not null check (
    event_type in ('queued', 'sent', 'delivered', 'opened', 'visited', 'clicked', 'downloaded', 'bounced', 'complained', 'unsubscribed', 'failed')
  ),
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  source text not null,
  entity_type text not null check (
    entity_type in ('leads', 'customers', 'contracts', 'inventory_items', 'equipment_compatibility')
  ),
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled')
  ),
  file_name text,
  file_path text,
  total_rows integer not null default 0,
  processed_rows integer not null default 0,
  failed_rows integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_batches_row_counts_check check (
    total_rows >= 0 and processed_rows >= 0 and failed_rows >= 0
  )
);

create table if not exists public.import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null,
  status text not null default 'pending' check (status in ('pending', 'imported', 'skipped', 'failed')),
  entity_id uuid,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  constraint import_batch_rows_batch_row_unique unique (import_batch_id, row_number)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  notification_type text not null check (
    notification_type in (
      'new_lead',
      'lead_assigned',
      'callback_due',
      'meeting_due',
      'offer_opened',
      'contract_ready',
      'process_step_due',
      'process_blocked',
      'signature_update',
      'offer_update',
      'inventory_low',
      'import_finished',
      'custom'
    )
  ),
  status text not null default 'unread' check (status in ('unread', 'read', 'archived', 'dismissed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customers_lead_idx on public.customers(lead_id);
create index if not exists customers_owner_idx on public.customers(owner_id, created_at desc);
create index if not exists customers_scope_status_idx on public.customers(crm_environment, status, updated_at desc);
create index if not exists customers_phone_idx on public.customers(phone);
create index if not exists customers_tax_id_idx on public.customers(tax_id);

create index if not exists contracts_customer_idx on public.contracts(customer_id, created_at desc);
create index if not exists contracts_lead_idx on public.contracts(lead_id);
create index if not exists contracts_owner_idx on public.contracts(owner_id, created_at desc);
create index if not exists contracts_scope_status_idx on public.contracts(crm_environment, status, updated_at desc);

create index if not exists signature_requests_contract_idx on public.signature_requests(contract_id, created_at desc);
create index if not exists signature_requests_customer_idx on public.signature_requests(customer_id, created_at desc);
create index if not exists signature_requests_scope_status_idx on public.signature_requests(crm_environment, status, updated_at desc);
create index if not exists signature_requests_external_idx on public.signature_requests(provider, external_id);

create index if not exists process_cases_contract_idx on public.process_cases(contract_id);
create index if not exists process_cases_customer_idx on public.process_cases(customer_id, updated_at desc);
create index if not exists process_cases_owner_idx on public.process_cases(owner_id, updated_at desc);
create index if not exists process_cases_scope_status_idx on public.process_cases(crm_environment, status, updated_at desc);

create index if not exists process_steps_case_order_idx on public.process_steps(process_case_id, sort_order);
create index if not exists process_steps_assigned_idx on public.process_steps(assigned_to, status, due_at);
create index if not exists process_steps_status_idx on public.process_steps(status, due_at);

create index if not exists inventory_items_scope_category_idx on public.inventory_items(crm_environment, category, status);
create index if not exists inventory_items_name_idx on public.inventory_items(name);
create index if not exists equipment_compatibility_source_idx on public.equipment_compatibility(source_item_id, relation_type);
create index if not exists equipment_compatibility_target_idx on public.equipment_compatibility(target_item_id, relation_type);
create index if not exists equipment_models_brand_kind_idx on public.equipment_models(brand_name, equipment_kind);
create index if not exists equipment_models_kind_voltage_idx on public.equipment_models(equipment_kind, battery_voltage);
create index if not exists compatibility_rules_inverter_idx on public.compatibility_rules(inverter_model_id, verdict);
create index if not exists compatibility_rules_battery_idx on public.compatibility_rules(battery_model_id, verdict);
create index if not exists compatibility_sources_url_idx on public.compatibility_sources(source_url);
create index if not exists assistant_queries_user_idx on public.assistant_queries(user_id, created_at desc);
create index if not exists assistant_queries_lead_idx on public.assistant_queries(lead_id, created_at desc);
create index if not exists assistant_queries_scope_area_idx on public.assistant_queries(crm_environment, assistant_area, created_at desc);

create index if not exists offer_deliveries_lead_idx on public.offer_deliveries(lead_id, created_at desc);
create index if not exists offer_deliveries_customer_idx on public.offer_deliveries(customer_id, created_at desc);
create index if not exists offer_deliveries_contract_idx on public.offer_deliveries(contract_id, created_at desc);
create index if not exists offer_deliveries_scope_status_idx on public.offer_deliveries(crm_environment, status, updated_at desc);
create index if not exists offer_deliveries_public_token_idx on public.offer_deliveries(public_token);
create index if not exists offer_deliveries_recipient_idx on public.offer_deliveries(crm_environment, normalized_recipient_email, created_at desc);
create unique index if not exists offer_deliveries_dedupe_active_idx
  on public.offer_deliveries(dedupe_key)
  where dedupe_key is not null and status <> 'failed';

create index if not exists mail_events_offer_idx on public.mail_events(offer_delivery_id, occurred_at desc);
create index if not exists mail_events_signature_idx on public.mail_events(signature_request_id, occurred_at desc);
create index if not exists mail_events_message_idx on public.mail_events(provider, message_id);
create index if not exists mail_events_scope_type_idx on public.mail_events(crm_environment, event_type, occurred_at desc);

create index if not exists import_batches_created_by_idx on public.import_batches(created_by, created_at desc);
create index if not exists import_batches_scope_status_idx on public.import_batches(crm_environment, status, created_at desc);
create index if not exists import_batch_rows_batch_status_idx on public.import_batch_rows(import_batch_id, status);

create index if not exists notifications_recipient_status_idx on public.notifications(recipient_id, status, created_at desc);
create index if not exists notifications_entity_idx on public.notifications(entity_type, entity_id);
create index if not exists notifications_scope_idx on public.notifications(crm_environment, created_at desc);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_lead_updated_at();

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_lead_updated_at();

drop trigger if exists signature_requests_set_updated_at on public.signature_requests;
create trigger signature_requests_set_updated_at
  before update on public.signature_requests
  for each row execute function public.set_lead_updated_at();

drop trigger if exists process_cases_set_updated_at on public.process_cases;
create trigger process_cases_set_updated_at
  before update on public.process_cases
  for each row execute function public.set_lead_updated_at();

drop trigger if exists process_steps_set_updated_at on public.process_steps;
create trigger process_steps_set_updated_at
  before update on public.process_steps
  for each row execute function public.set_lead_updated_at();

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_lead_updated_at();

drop trigger if exists equipment_compatibility_set_updated_at on public.equipment_compatibility;
create trigger equipment_compatibility_set_updated_at
  before update on public.equipment_compatibility
  for each row execute function public.set_lead_updated_at();

drop trigger if exists equipment_brands_set_updated_at on public.equipment_brands;
create trigger equipment_brands_set_updated_at
  before update on public.equipment_brands
  for each row execute function public.set_lead_updated_at();

drop trigger if exists equipment_models_set_updated_at on public.equipment_models;
create trigger equipment_models_set_updated_at
  before update on public.equipment_models
  for each row execute function public.set_lead_updated_at();

drop trigger if exists compatibility_sources_set_updated_at on public.compatibility_sources;
create trigger compatibility_sources_set_updated_at
  before update on public.compatibility_sources
  for each row execute function public.set_lead_updated_at();

drop trigger if exists compatibility_rules_set_updated_at on public.compatibility_rules;
create trigger compatibility_rules_set_updated_at
  before update on public.compatibility_rules
  for each row execute function public.set_lead_updated_at();

drop trigger if exists offer_deliveries_set_updated_at on public.offer_deliveries;
create trigger offer_deliveries_set_updated_at
  before update on public.offer_deliveries
  for each row execute function public.set_lead_updated_at();

drop trigger if exists import_batches_set_updated_at on public.import_batches;
create trigger import_batches_set_updated_at
  before update on public.import_batches
  for each row execute function public.set_lead_updated_at();

alter table public.customers enable row level security;
alter table public.contracts enable row level security;
alter table public.signature_requests enable row level security;
alter table public.process_cases enable row level security;
alter table public.process_steps enable row level security;
alter table public.inventory_items enable row level security;
alter table public.equipment_compatibility enable row level security;
alter table public.equipment_brands enable row level security;
alter table public.equipment_models enable row level security;
alter table public.compatibility_sources enable row level security;
alter table public.compatibility_rules enable row level security;
alter table public.assistant_queries enable row level security;
alter table public.offer_deliveries enable row level security;
alter table public.mail_events enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_batch_rows enable row level security;
alter table public.notifications enable row level security;

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (public.can_access_crm_environment(crm_environment) and public.can_view_energy_v2_record(owner_id));

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id))
  with check (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id));

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete to authenticated
  using (public.is_admin() and public.can_access_crm_environment(crm_environment));

drop policy if exists contracts_select on public.contracts;
create policy contracts_select on public.contracts
  for select to authenticated
  using (public.can_access_crm_environment(crm_environment) and public.can_view_energy_v2_record(owner_id));

drop policy if exists contracts_insert on public.contracts;
create policy contracts_insert on public.contracts
  for insert to authenticated
  with check (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id));

drop policy if exists contracts_update on public.contracts;
create policy contracts_update on public.contracts
  for update to authenticated
  using (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id))
  with check (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id));

drop policy if exists contracts_delete on public.contracts;
create policy contracts_delete on public.contracts
  for delete to authenticated
  using (public.is_admin() and public.can_access_crm_environment(crm_environment));

drop policy if exists signature_requests_select on public.signature_requests;
create policy signature_requests_select on public.signature_requests
  for select to authenticated
  using (
    public.can_access_crm_environment(crm_environment)
    and exists (
      select 1 from public.contracts
      where contracts.id = signature_requests.contract_id
        and public.can_view_energy_v2_record(contracts.owner_id)
    )
  );

drop policy if exists signature_requests_insert on public.signature_requests;
create policy signature_requests_insert on public.signature_requests
  for insert to authenticated
  with check (
    public.can_access_crm_environment(crm_environment)
    and (requested_by = auth.uid() or public.is_admin())
    and exists (
      select 1 from public.contracts
      where contracts.id = signature_requests.contract_id
        and public.can_edit_energy_v2_record(contracts.owner_id)
    )
  );

drop policy if exists signature_requests_update on public.signature_requests;
create policy signature_requests_update on public.signature_requests
  for update to authenticated
  using (
    public.can_access_crm_environment(crm_environment)
    and exists (
      select 1 from public.contracts
      where contracts.id = signature_requests.contract_id
        and public.can_edit_energy_v2_record(contracts.owner_id)
    )
  )
  with check (public.can_access_crm_environment(crm_environment));

drop policy if exists process_cases_select on public.process_cases;
create policy process_cases_select on public.process_cases
  for select to authenticated
  using (public.can_access_crm_environment(crm_environment) and public.can_view_energy_v2_record(owner_id));

drop policy if exists process_cases_insert on public.process_cases;
create policy process_cases_insert on public.process_cases
  for insert to authenticated
  with check (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id));

drop policy if exists process_cases_update on public.process_cases;
create policy process_cases_update on public.process_cases
  for update to authenticated
  using (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id))
  with check (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id));

drop policy if exists process_steps_select on public.process_steps;
create policy process_steps_select on public.process_steps
  for select to authenticated
  using (
    exists (
      select 1 from public.process_cases
      where process_cases.id = process_steps.process_case_id
        and public.can_access_crm_environment(process_cases.crm_environment)
        and (
          public.can_view_energy_v2_record(process_cases.owner_id)
          or process_steps.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists process_steps_insert on public.process_steps;
create policy process_steps_insert on public.process_steps
  for insert to authenticated
  with check (
    exists (
      select 1 from public.process_cases
      where process_cases.id = process_steps.process_case_id
        and public.can_access_crm_environment(process_cases.crm_environment)
        and public.can_edit_energy_v2_record(process_cases.owner_id)
    )
  );

drop policy if exists process_steps_update on public.process_steps;
create policy process_steps_update on public.process_steps
  for update to authenticated
  using (
    assigned_to = auth.uid()
    or exists (
      select 1 from public.process_cases
      where process_cases.id = process_steps.process_case_id
        and public.can_access_crm_environment(process_cases.crm_environment)
        and public.can_edit_energy_v2_record(process_cases.owner_id)
    )
  )
  with check (
    exists (
      select 1 from public.process_cases
      where process_cases.id = process_steps.process_case_id
        and public.can_access_crm_environment(process_cases.crm_environment)
    )
  );

drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items
  for select to authenticated
  using (public.can_access_crm_environment(crm_environment) and (public.is_admin_or_menadzer() or public.is_energy_operations_role()));

drop policy if exists inventory_items_write on public.inventory_items;
create policy inventory_items_write on public.inventory_items
  for all to authenticated
  using (public.can_access_crm_environment(crm_environment) and (public.is_admin() or public.current_user_role() = 'logistyk'))
  with check (public.can_access_crm_environment(crm_environment) and (public.is_admin() or public.current_user_role() = 'logistyk'));

drop policy if exists equipment_compatibility_select on public.equipment_compatibility;
create policy equipment_compatibility_select on public.equipment_compatibility
  for select to authenticated
  using (public.can_access_crm_environment(crm_environment) and (public.is_admin_or_menadzer() or public.is_energy_operations_role()));

drop policy if exists equipment_compatibility_write on public.equipment_compatibility;
create policy equipment_compatibility_write on public.equipment_compatibility
  for all to authenticated
  using (public.can_access_crm_environment(crm_environment) and (public.is_admin() or public.current_user_role() = 'logistyk'))
  with check (public.can_access_crm_environment(crm_environment) and (public.is_admin() or public.current_user_role() = 'logistyk'));

drop policy if exists equipment_brands_select on public.equipment_brands;
create policy equipment_brands_select on public.equipment_brands
  for select to authenticated
  using (true);

drop policy if exists equipment_brands_write on public.equipment_brands;
create policy equipment_brands_write on public.equipment_brands
  for all to authenticated
  using (public.is_admin_or_menadzer() or public.current_user_role() = 'logistyk')
  with check (public.is_admin_or_menadzer() or public.current_user_role() = 'logistyk');

drop policy if exists equipment_models_select on public.equipment_models;
create policy equipment_models_select on public.equipment_models
  for select to authenticated
  using (true);

drop policy if exists equipment_models_write on public.equipment_models;
create policy equipment_models_write on public.equipment_models
  for all to authenticated
  using (public.is_admin_or_menadzer() or public.current_user_role() = 'logistyk')
  with check (public.is_admin_or_menadzer() or public.current_user_role() = 'logistyk');

drop policy if exists compatibility_sources_select on public.compatibility_sources;
create policy compatibility_sources_select on public.compatibility_sources
  for select to authenticated
  using (true);

drop policy if exists compatibility_sources_write on public.compatibility_sources;
create policy compatibility_sources_write on public.compatibility_sources
  for all to authenticated
  using (public.is_admin_or_menadzer() or public.current_user_role() = 'logistyk')
  with check (public.is_admin_or_menadzer() or public.current_user_role() = 'logistyk');

drop policy if exists compatibility_rules_select on public.compatibility_rules;
create policy compatibility_rules_select on public.compatibility_rules
  for select to authenticated
  using (true);

drop policy if exists compatibility_rules_write on public.compatibility_rules;
create policy compatibility_rules_write on public.compatibility_rules
  for all to authenticated
  using (public.is_admin_or_menadzer() or public.current_user_role() = 'logistyk')
  with check (public.is_admin_or_menadzer() or public.current_user_role() = 'logistyk');

drop policy if exists assistant_queries_select on public.assistant_queries;
create policy assistant_queries_select on public.assistant_queries
  for select to authenticated
  using (
    public.can_access_crm_environment(crm_environment)
    and (user_id = auth.uid() or public.is_admin_or_menadzer())
  );

drop policy if exists assistant_queries_insert on public.assistant_queries;
create policy assistant_queries_insert on public.assistant_queries
  for insert to authenticated
  with check (
    public.can_access_crm_environment(crm_environment)
    and (user_id = auth.uid() or public.is_admin_or_menadzer())
  );

drop policy if exists offer_deliveries_select on public.offer_deliveries;
create policy offer_deliveries_select on public.offer_deliveries
  for select to authenticated
  using (public.can_access_crm_environment(crm_environment) and public.can_view_energy_v2_record(owner_id));

drop policy if exists offer_deliveries_insert on public.offer_deliveries;
create policy offer_deliveries_insert on public.offer_deliveries
  for insert to authenticated
  with check (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id));

drop policy if exists offer_deliveries_update on public.offer_deliveries;
create policy offer_deliveries_update on public.offer_deliveries
  for update to authenticated
  using (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id))
  with check (public.can_access_crm_environment(crm_environment) and public.can_edit_energy_v2_record(owner_id));

drop policy if exists mail_events_select on public.mail_events;
create policy mail_events_select on public.mail_events
  for select to authenticated
  using (public.can_access_crm_environment(crm_environment) and (public.is_admin_or_menadzer() or public.is_energy_operations_role()));

drop policy if exists mail_events_insert on public.mail_events;
create policy mail_events_insert on public.mail_events
  for insert to authenticated
  with check (public.can_access_crm_environment(crm_environment) and public.is_admin());

drop policy if exists import_batches_select on public.import_batches;
create policy import_batches_select on public.import_batches
  for select to authenticated
  using (
    public.can_access_crm_environment(crm_environment)
    and (created_by = auth.uid() or public.is_admin_or_menadzer())
  );

drop policy if exists import_batches_insert on public.import_batches;
create policy import_batches_insert on public.import_batches
  for insert to authenticated
  with check (
    public.can_access_crm_environment(crm_environment)
    and (created_by = auth.uid() or public.is_admin())
    and public.is_admin_or_menadzer()
  );

drop policy if exists import_batches_update on public.import_batches;
create policy import_batches_update on public.import_batches
  for update to authenticated
  using (public.can_access_crm_environment(crm_environment) and (created_by = auth.uid() or public.is_admin()))
  with check (public.can_access_crm_environment(crm_environment) and (created_by = auth.uid() or public.is_admin()));

drop policy if exists import_batch_rows_select on public.import_batch_rows;
create policy import_batch_rows_select on public.import_batch_rows
  for select to authenticated
  using (
    exists (
      select 1 from public.import_batches
      where import_batches.id = import_batch_rows.import_batch_id
        and public.can_access_crm_environment(import_batches.crm_environment)
        and (import_batches.created_by = auth.uid() or public.is_admin_or_menadzer())
    )
  );

drop policy if exists import_batch_rows_write on public.import_batch_rows;
create policy import_batch_rows_write on public.import_batch_rows
  for all to authenticated
  using (
    exists (
      select 1 from public.import_batches
      where import_batches.id = import_batch_rows.import_batch_id
        and public.can_access_crm_environment(import_batches.crm_environment)
        and (import_batches.created_by = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.import_batches
      where import_batches.id = import_batch_rows.import_batch_id
        and public.can_access_crm_environment(import_batches.crm_environment)
        and (import_batches.created_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.can_access_crm_environment(crm_environment)
    and (recipient_id = auth.uid() or public.is_admin())
  );

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (
    public.can_access_crm_environment(crm_environment)
    and (actor_id = auth.uid() or public.is_admin())
  );

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (
    public.can_access_crm_environment(crm_environment)
    and (recipient_id = auth.uid() or public.is_admin())
  )
  with check (
    public.can_access_crm_environment(crm_environment)
    and (recipient_id = auth.uid() or public.is_admin())
  );
