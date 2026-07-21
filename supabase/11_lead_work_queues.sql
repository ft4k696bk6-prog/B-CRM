-- Uproszczony obieg pracy: siedem statusów, dwa zamknięte worki i czysty powrót do bazy.

update public.leads
set status = case
  when status = 'Przypisany' then 'Nowy'
  when status = 'Zwrot' then 'Nowy'
  when status = 'Błędny numer' then 'Nie odebrał'
  when status = 'Do weryfikacji' then 'Nowy'
  else status
end,
assigned_to = case when status = 'Zwrot' then null else assigned_to end,
callback_at = case when status = 'Zwrot' then null else callback_at end,
meeting_at = case when status = 'Zwrot' then null else meeting_at end,
meeting_address = case when status = 'Zwrot' then null else meeting_address end,
meeting_note = case when status = 'Zwrot' then null else meeting_note end,
resignation_reason = case when status = 'Zwrot' then null else resignation_reason end,
contract_number = case when status = 'Zwrot' then null else contract_number end,
last_opened_at = case when status = 'Zwrot' then null else last_opened_at end
where status in ('Przypisany', 'Zwrot', 'Błędny numer', 'Do weryfikacji');

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (
  status in (
    'Nowy',
    'Nie odebrał',
    'Call back',
    'Spotkanie',
    'Po spotkaniu',
    'Umowa',
    'Rezygnacja'
  )
);

create or replace function public.validate_sales_lead_path()
returns trigger
as $$
begin
  -- Statusy końcowe są trwałymi workami, również dla administratora.
  if old.status = 'Rezygnacja' and new.status is distinct from old.status then
    raise exception 'Rezygnacja jest statusem końcowym i nie może zostać zmieniona.';
  end if;

  if old.status = 'Umowa' and new.status is distinct from old.status then
    raise exception 'Umowa jest statusem końcowym i nie może zostać zmieniona.';
  end if;

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
    if not (new.assigned_to is null and new.status = 'Nowy') then
      raise exception 'Handlowiec nie może przypisywać leadów.';
    end if;
  end if;

  if new.status = 'Umowa' and old.status not in ('Spotkanie', 'Po spotkaniu', 'Umowa') then
    raise exception 'Umowę można oznaczyć dopiero po spotkaniu.';
  end if;

  if new.status = 'Umowa'
    and nullif(trim(coalesce(new.contract_number, '')), '') is null then
    raise exception 'Status Umowa wymaga numeru umowy.';
  end if;

  if new.status = 'Spotkanie'
    and (new.meeting_at is null or nullif(trim(coalesce(new.meeting_address, new.address, '')), '') is null) then
    raise exception 'Status Spotkanie wymaga terminu i adresu klienta.';
  end if;

  if new.status = 'Po spotkaniu'
    and nullif(trim(coalesce(new.meeting_note, '')), '') is null then
    raise exception 'Status Po spotkaniu wymaga notatki.';
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
