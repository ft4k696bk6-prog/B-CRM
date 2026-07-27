create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete restrict,
  contract_number text not null,
  signed_at date not null,
  customer_name text not null,
  phone text not null,
  email text not null,
  postal_code text not null,
  city text not null,
  street text not null,
  house_number text not null,
  financing text not null check (financing in ('gotowka', 'kredyt_do_sprawdzenia', 'kredyt_do_uruchomienia', 'kredyt_uruchomiony')),
  credit_amount numeric(12,2),
  product_type text not null check (product_type in ('PV', 'ME', 'PV+ME')),
  pv_power_kwp numeric(8,2),
  storage_capacity_kwh numeric(8,2),
  panel_power_wp integer,
  panels_count integer,
  has_inverter boolean not null default true,
  inverter_power_kw numeric(8,2),
  mounting_locations text[] not null default '{}',
  multiple_mounting_locations boolean not null default false,
  gross_amount numeric(12,2) not null,
  backup_power boolean not null default false,
  optimizer_count integer not null default 0,
  surge_protection boolean not null default false,
  grounding boolean not null default false,
  additional_notes text,
  installation_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  crm_environment text not null check (crm_environment in ('production', 'demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crm_environment, contract_number)
);

create table if not exists public.contract_tasks (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  task_key text not null check (task_key in ('do_domkniecia', 'zamowic_sprzet', 'umowic_montaz', 'do_montazu', 'zglosic_pge', 'do_rozliczenia')),
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (contract_id, task_key)
);

create table if not exists public.contract_task_history (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  task_key text not null,
  completed boolean not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contracts_environment_idx on public.contracts(crm_environment, updated_at desc);
create index if not exists contracts_created_by_idx on public.contracts(created_by);
create index if not exists contract_tasks_contract_idx on public.contract_tasks(contract_id);
create index if not exists contract_task_history_contract_idx on public.contract_task_history(contract_id, created_at desc);

alter table public.contracts enable row level security;
alter table public.contract_tasks enable row level security;
alter table public.contract_task_history enable row level security;

-- Dostęp aplikacji przechodzi przez chronione endpointy serwerowe korzystające z service role.

