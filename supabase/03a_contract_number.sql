alter table public.leads
add column if not exists contract_number text;

create or replace function public.log_contract_number_update()
returns trigger
as $$
begin
  if old.contract_number is distinct from new.contract_number then
    insert into public.lead_history (
      lead_id,
      user_id,
      action_type,
      description,
      old_value,
      new_value
    )
    values (
      new.id,
      auth.uid(),
      'contract_number',
      'Zmieniono numer umowy.',
      jsonb_build_object('contract_number', old.contract_number),
      jsonb_build_object('contract_number', new.contract_number)
    );
  end if;

  return new;
end;
$$
language plpgsql
security definer
set search_path = public;

drop trigger if exists leads_log_contract_number_update on public.leads;
create trigger leads_log_contract_number_update
  after update of contract_number on public.leads
  for each row execute function public.log_contract_number_update();
