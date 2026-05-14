create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role text not null default 'sales',
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'sales'))
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  postal_code text,
  phone text not null,
  address text,
  voivodeship text,
  county text,
  status text not null default 'Nowy',
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz,
  source text,
  resignation_reason text,
  callback_at timestamptz,
  meeting_at timestamptz,
  meeting_address text,
  contract_number text,
  constraint leads_status_check check (
    status in (
      'Nowy',
      'Przypisany',
      'Call back',
      'Spotkanie',
      'Umowa',
      'Zwrot',
      'Rezygnacja',
      'Nie odebrał',
      'Błędny numer',
      'Do weryfikacji'
    )
  ),
  constraint leads_assigned_to_fkey
    foreign key (assigned_to)
    references public.profiles(id)
    on delete set null
);

create table if not exists public.lead_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  user_id uuid,
  action_type text not null,
  description text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now(),
  constraint lead_history_lead_id_fkey
    foreign key (lead_id)
    references public.leads(id)
    on delete cascade,
  constraint lead_history_user_id_fkey
    foreign key (user_id)
    references public.profiles(id)
    on delete set null
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists leads_assigned_to_idx on public.leads(assigned_to);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_updated_at_idx on public.leads(updated_at desc);
create index if not exists leads_last_opened_at_idx on public.leads(last_opened_at desc);
create index if not exists leads_postal_code_idx on public.leads(postal_code);
create index if not exists leads_region_idx on public.leads(voivodeship, county);
create index if not exists lead_history_lead_id_idx on public.lead_history(lead_id, created_at desc);
