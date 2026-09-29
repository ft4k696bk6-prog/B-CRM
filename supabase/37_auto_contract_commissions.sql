begin;

alter table public.contracts
  add column if not exists commission_margin_net numeric(12,2) not null default 0,
  add column if not exists commission_percent numeric(6,3) not null default 0
    check (commission_percent >= 0 and commission_percent <= 100),
  add column if not exists commission_amount numeric(12,2) not null default 0;

create or replace function public.snapshot_contract_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_margin numeric(12,2) := 0;
  v_percent numeric(6,3) := 0;
begin
  if new.created_by is null then
    new.commission_margin_net := 0;
    new.commission_percent := 0;
    new.commission_amount := 0;
    return new;
  end if;

  if tg_op = 'INSERT'
     or new.created_by is distinct from old.created_by
     or (
       old.submission_status is distinct from 'submitted'
       and new.submission_status = 'submitted'
     ) then
    select
      coalesce(p.sales_margin_net, 0),
      coalesce(p.commission_percent, 0)
    into v_margin, v_percent
    from public.profiles p
    where p.id = new.created_by;

    new.commission_margin_net := coalesce(v_margin, 0);
    new.commission_percent := coalesce(v_percent, 0);
    new.commission_amount := round(
      coalesce(v_margin, 0) * coalesce(v_percent, 0) / 100,
      2
    );
  end if;

  return new;
end;
$$;

revoke all on function public.snapshot_contract_commission() from public, anon, authenticated;

drop trigger if exists a_snapshot_contract_commission on public.contracts;
create trigger a_snapshot_contract_commission
  before insert or update of created_by, submission_status
  on public.contracts
  for each row execute function public.snapshot_contract_commission();

update public.contracts c
set
  commission_margin_net = coalesce(p.sales_margin_net, 0),
  commission_percent = coalesce(p.commission_percent, 0),
  commission_amount = round(
    coalesce(p.sales_margin_net, 0) * coalesce(p.commission_percent, 0) / 100,
    2
  )
from public.profiles p
where p.id = c.created_by;

create or replace function public.guard_contract_workflow_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role') then return new; end if;
  if new.process_status is distinct from old.process_status
    or new.is_process_visible is distinct from old.is_process_visible
    or new.installation_at is distinct from old.installation_at
    or new.installer_id is distinct from old.installer_id
    or new.installer_name is distinct from old.installer_name
    or new.resigned_at is distinct from old.resigned_at
    or new.commission_margin_net is distinct from old.commission_margin_net
    or new.commission_percent is distinct from old.commission_percent
    or new.commission_amount is distinct from old.commission_amount then
    raise exception 'Oznaczenia realizacji i prowizje można zmieniać wyłącznie przez moduł umów.' using errcode='42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_contract_workflow_fields() from public, anon, authenticated;

commit;
