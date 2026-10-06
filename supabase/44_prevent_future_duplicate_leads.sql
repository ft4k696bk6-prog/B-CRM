create or replace function public.prevent_duplicate_lead_phone()
returns trigger
language plpgsql
as $$
begin
  if new.phone_key is null or btrim(new.phone_key) = '' then
    return new;
  end if;

  if exists (
    select 1
    from public.leads existing
    where existing.crm_environment = new.crm_environment
      and existing.phone_key = new.phone_key
  ) then
    raise exception 'Lead z tym numerem telefonu już istnieje w tym środowisku CRM.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_lead_phone on public.leads;
create trigger trg_prevent_duplicate_lead_phone
before insert on public.leads
for each row
execute function public.prevent_duplicate_lead_phone();
