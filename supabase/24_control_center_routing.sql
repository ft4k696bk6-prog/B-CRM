-- CRM control center and weighted automatic lead routing.
-- Apply after 23_contract_commissions_and_resignations.sql.

create table if not exists public.crm_settings (
  crm_environment text primary key check (crm_environment in ('production', 'demo')),
  mandatory_queue_enabled boolean not null default true,
  operations_modules_enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.crm_settings (crm_environment)
values ('production'), ('demo')
on conflict (crm_environment) do nothing;

alter table public.crm_settings enable row level security;

create table if not exists public.lead_routing_rules (
  id uuid primary key default gen_random_uuid(),
  crm_environment text not null check (crm_environment in ('production', 'demo')),
  voivodeship text not null,
  salesperson_id uuid not null references public.profiles(id) on delete cascade,
  weight integer not null default 100 check (weight between 1 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crm_environment, voivodeship, salesperson_id)
);

create index if not exists lead_routing_rules_lookup_idx
  on public.lead_routing_rules (crm_environment, lower(voivodeship), active)
  where active = true;

alter table public.lead_routing_rules enable row level security;

-- These tables are intentionally server/API-managed. No direct authenticated
-- policies are added; the service-role API is the only mutation path.

create or replace function public.assign_lead_by_voivodeship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_slot numeric;
  v_salesperson uuid;
begin
  if new.assigned_to is not null or coalesce(trim(new.voivodeship), '') = '' then
    return new;
  end if;

  select coalesce(sum(r.weight), 0)::integer
    into v_total
  from public.lead_routing_rules r
  join public.profiles p on p.id = r.salesperson_id
  where r.crm_environment = new.crm_environment
    and lower(trim(r.voivodeship)) = lower(trim(new.voivodeship))
    and r.active = true
    and p.crm_environment = new.crm_environment
    and p.role in ('handlowiec', 'sales');

  if v_total <= 0 then
    return new;
  end if;

  -- Stable weighted selection based on lead UUID. This avoids a mutable
  -- round-robin cursor and remains concurrency-safe when many leads arrive at once.
  v_slot := mod(
    abs(hashtextextended(coalesce(new.id::text, gen_random_uuid()::text), 0))::numeric,
    v_total::numeric
  );

  select candidate.salesperson_id
    into v_salesperson
  from (
    select
      r.salesperson_id,
      sum(r.weight) over (order by r.salesperson_id, r.id) as cumulative_weight
    from public.lead_routing_rules r
    join public.profiles p on p.id = r.salesperson_id
    where r.crm_environment = new.crm_environment
      and lower(trim(r.voivodeship)) = lower(trim(new.voivodeship))
      and r.active = true
      and p.crm_environment = new.crm_environment
      and p.role in ('handlowiec', 'sales')
  ) candidate
  where candidate.cumulative_weight > v_slot
  order by candidate.cumulative_weight
  limit 1;

  if v_salesperson is not null then
    new.assigned_to := v_salesperson;
  end if;

  return new;
end;
$$;

drop trigger if exists leads_auto_assign_by_voivodeship on public.leads;
create trigger leads_auto_assign_by_voivodeship
before insert on public.leads
for each row
execute function public.assign_lead_by_voivodeship();
