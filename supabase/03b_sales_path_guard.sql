create or replace function public.validate_sales_lead_path()
returns trigger
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if (to_jsonb(new) - 'updated_at' - 'last_opened_at')
     = (to_jsonb(old) - 'updated_at' - 'last_opened_at') then
    return new;
  end if;

  if old.assigned_to is distinct from auth.uid() then
    raise exception 'Handlowiec może edytować tylko swoje leady.';
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    if not (new.assigned_to is null and new.status = 'Zwrot') then
      raise exception 'Handlowiec nie może przypisywać leadów.';
    end if;
  end if;

  if new.status = 'Umowa' and old.status not in ('Spotkanie', 'Umowa') then
    raise exception 'Umowę można oznaczyć dopiero po statusie Spotkanie.';
  end if;

  if new.status = 'Umowa'
    and nullif(trim(coalesce(new.contract_number, '')), '') is null then
    raise exception 'Status Umowa wymaga numeru umowy.';
  end if;

  if new.status = 'Spotkanie'
    and (new.meeting_at is null or nullif(trim(coalesce(new.meeting_address, new.address, '')), '') is null) then
    raise exception 'Status Spotkanie wymaga terminu i adresu klienta.';
  end if;

  if new.status = 'Call back' and new.callback_at is null then
    raise exception 'Status Call back wymaga daty i godziny.';
  end if;

  if new.status = 'Rezygnacja'
    and nullif(trim(coalesce(new.resignation_reason, '')), '') is null then
    raise exception 'Rezygnacja wymaga powodu.';
  end if;

  return new;
end;
$$
language plpgsql
security definer
set search_path = public;

drop trigger if exists leads_validate_sales_lead_path on public.leads;
create trigger leads_validate_sales_lead_path
  before update on public.leads
  for each row execute function public.validate_sales_lead_path();
