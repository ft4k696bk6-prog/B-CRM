begin;

-- Production originally used an older, empty contracts table. Bring it forward
-- additively so no lead, history, note, meeting, or contract row is deleted.
alter table public.contracts alter column customer_id drop not null;
alter table public.contracts add column if not exists customer_name text;
alter table public.contracts add column if not exists phone text;
alter table public.contracts add column if not exists email text;
alter table public.contracts add column if not exists postal_code text;
alter table public.contracts add column if not exists city text;
alter table public.contracts add column if not exists street text;
alter table public.contracts add column if not exists house_number text;
alter table public.contracts add column if not exists financing text;
alter table public.contracts add column if not exists credit_amount numeric(12,2);
alter table public.contracts add column if not exists pv_power_kwp numeric(8,2);
alter table public.contracts add column if not exists storage_capacity_kwh numeric(8,2);
alter table public.contracts add column if not exists panel_power_wp integer;
alter table public.contracts add column if not exists panels_count integer;
alter table public.contracts add column if not exists has_inverter boolean not null default true;
alter table public.contracts add column if not exists inverter_power_kw numeric(8,2);
alter table public.contracts add column if not exists mounting_locations text[] not null default '{}';
alter table public.contracts add column if not exists multiple_mounting_locations boolean not null default false;
alter table public.contracts add column if not exists backup_power boolean not null default false;
alter table public.contracts add column if not exists optimizer_count integer not null default 0;
alter table public.contracts add column if not exists surge_protection boolean not null default false;
alter table public.contracts add column if not exists grounding boolean not null default false;
alter table public.contracts add column if not exists additional_notes text;
alter table public.contracts add column if not exists installation_at timestamptz;
alter table public.contracts add column if not exists created_by uuid references public.profiles(id) on delete restrict;
alter table public.contracts add column if not exists process_status text not null default 'incomplete';
alter table public.contracts add column if not exists is_process_visible boolean not null default true;
alter table public.contracts add column if not exists process_note text;
alter table public.contracts add column if not exists resignation_note text;
alter table public.contracts add column if not exists resigned_at timestamptz;
alter table public.contracts add column if not exists management_notes jsonb not null default '[]'::jsonb;

alter table public.contracts drop constraint if exists contracts_product_type_check;
alter table public.contracts add constraint contracts_product_type_check
  check (product_type in ('pv','heat_pump','energy_storage','boiler','rainwater','other','PV','ME','PV+ME'));

create unique index if not exists contracts_lead_unique_idx
  on public.contracts(lead_id) where lead_id is not null;

create table if not exists public.contract_tasks (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  task_key text not null check (task_key in ('do_domkniecia','zamowic_sprzet','umowic_montaz','do_montazu','zglosic_pge','do_rozliczenia')),
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

create table if not exists public.contract_files (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  kind text not null check(kind in ('contract_pdf','photo','video')),
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table public.contract_tasks enable row level security;
alter table public.contract_task_history enable row level security;
alter table public.contract_files enable row level security;

create index if not exists contract_tasks_contract_idx on public.contract_tasks(contract_id);
create index if not exists contract_task_history_contract_idx on public.contract_task_history(contract_id, created_at desc);
create index if not exists contract_files_contract_idx on public.contract_files(contract_id, created_at desc);
create index if not exists contracts_environment_installation_idx
  on public.contracts(crm_environment, installation_at) where installation_at is not null;
create index if not exists contracts_environment_creator_updated_idx
  on public.contracts(crm_environment, created_by, updated_at desc);

alter table public.profiles add column if not exists company_margin_net numeric(12,2) not null default 10000;
alter table public.profiles add column if not exists sales_margin_net numeric(12,2) not null default 5000;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-files', 'contract-files', false, null, array['application/pdf', 'image/*', 'video/*'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.contracts
  add column if not exists submission_status text not null default 'draft'
  check (submission_status in ('draft', 'submitted'));

alter table public.contracts add column if not exists submitted_at timestamptz;

update public.contracts
set submission_status = case when process_status = 'incomplete' then 'draft' else 'submitted' end,
    submitted_at = case when process_status = 'incomplete' then null else coalesce(submitted_at, updated_at, created_at) end,
    is_process_visible = case when process_status = 'incomplete' then false else is_process_visible end;

create index if not exists contracts_submission_scope_idx
  on public.contracts(crm_environment, submission_status, created_by, updated_at desc);

create or replace function public.submit_contract(p_contract_id uuid, p_actor_id uuid)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.contracts;
  v_pdf_count integer;
  v_photo_count integer;
begin
  select * into v_contract from public.contracts where id = p_contract_id for update;
  if v_contract.id is null then raise exception 'Nie znaleziono umowy.'; end if;
  if v_contract.submission_status = 'submitted' then return v_contract; end if;

  select count(*) filter (where kind = 'contract_pdf'), count(*) filter (where kind = 'photo')
  into v_pdf_count, v_photo_count
  from public.contract_files where contract_id = p_contract_id;
  if v_pdf_count < 1 then raise exception 'Dodaj PDF umowy przed wysłaniem.'; end if;
  if v_photo_count < 1 then raise exception 'Dodaj co najmniej jedno zdjęcie przed wysłaniem.'; end if;

  update public.contracts
  set submission_status = 'submitted', submitted_at = now(), process_status = 'verification',
      is_process_visible = true, updated_at = now()
  where id = p_contract_id returning * into v_contract;

  update public.leads
  set status = 'Umowa', assigned_to = null, contract_number = v_contract.contract_number,
      callback_at = null, meeting_at = null, updated_at = now()
  where id = v_contract.lead_id and crm_environment = v_contract.crm_environment;

  insert into public.lead_history(lead_id, user_id, action_type, description, new_value)
  values (v_contract.lead_id, p_actor_id, 'contract_submitted',
          'Wysłano komplet umowy ' || v_contract.contract_number || ' do weryfikacji.',
          jsonb_build_object('contract_id', v_contract.id, 'submission_status', 'submitted', 'process_status', 'verification'));
  return v_contract;
end;
$$;

revoke all on function public.submit_contract(uuid, uuid) from public;
grant execute on function public.submit_contract(uuid, uuid) to service_role;

-- Lead visibility: only administrators have the full CRM scope. Managers see
-- the unassigned pool and their team; salespeople see their own records.
create or replace function public.can_view_lead(p_assigned_to uuid)
returns boolean
as $$
  select public.can_manage_lead(p_assigned_to) or p_assigned_to = auth.uid();
$$
language sql
stable
security definer
set search_path = public;

commit;
