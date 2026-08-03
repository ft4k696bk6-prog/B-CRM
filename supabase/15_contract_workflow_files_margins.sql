alter table public.profiles add column if not exists company_margin_net numeric(12,2) not null default 10000;
alter table public.profiles add column if not exists sales_margin_net numeric(12,2) not null default 5000;

update public.profiles set company_margin_net = 5000, sales_margin_net = 10000
where lower(full_name) like '%krystian%' or lower(full_name) like '%wiktoria%';

alter table public.contracts add column if not exists process_status text not null default 'incomplete';
alter table public.contracts add column if not exists is_process_visible boolean not null default true;
alter table public.contracts add column if not exists process_note text;
alter table public.contracts add column if not exists resignation_note text;
alter table public.contracts add column if not exists resigned_at timestamptz;

update public.contracts set process_status = 'paused', is_process_visible = false;
update public.contracts set process_status = 'installation_scheduled', is_process_visible = true, installation_at = '2026-08-06T08:00:00Z'
where (lower(customer_name) like '%antoni%kisiel%' or lower(customer_name) like '%kazimiera%napora%');
update public.contracts set process_status = 'installation_to_schedule', is_process_visible = true
where lower(customer_name) like '%irena%wielgos%' or lower(customer_name) like '%marian%maksymiec%';
update public.contracts set process_status = 'equipment_to_order', is_process_visible = true where lower(customer_name) like '%watrach%';

create table if not exists public.contract_notes (
  id uuid primary key default gen_random_uuid(), contract_id uuid not null references public.contracts(id) on delete cascade,
  author_id uuid references public.profiles(id), content text not null, created_at timestamptz not null default now()
);
create table if not exists public.contract_files (
  id uuid primary key default gen_random_uuid(), contract_id uuid not null references public.contracts(id) on delete cascade,
  uploaded_by uuid references public.profiles(id), kind text not null check(kind in ('contract_pdf','photo','video')),
  file_name text not null, file_path text not null, mime_type text, file_size bigint, created_at timestamptz not null default now()
);
