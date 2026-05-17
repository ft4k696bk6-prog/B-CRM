alter table public.leads
add column if not exists meeting_note text;

alter table public.leads
drop constraint if exists leads_status_check;

alter table public.leads
add constraint leads_status_check check (
  status in (
    'Nowy',
    'Przypisany',
    'Call back',
    'Spotkanie',
    'Po spotkaniu',
    'Umowa',
    'Zwrot',
    'Rezygnacja',
    'Nie odebrał',
    'Błędny numer',
    'Do weryfikacji'
  )
);

create or replace function public.log_lead_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    perform public.insert_lead_history(
      new.id,
      'status_change',
      'Status zmieniony z "' || old.status || '" na "' || new.status || '".',
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    perform public.insert_lead_history(
      new.id,
      case when new.assigned_to is null then 'return' else 'assignment' end,
      case when new.assigned_to is null then 'Lead zwrócony do bazy leadów.' else 'Lead przypisany do handlowca.' end,
      jsonb_build_object('assigned_to', old.assigned_to),
      jsonb_build_object('assigned_to', new.assigned_to)
    );
  end if;

  if old.callback_at is distinct from new.callback_at then
    perform public.insert_lead_history(
      new.id,
      'callback_set',
      'Zmieniono termin callbacku.',
      jsonb_build_object('callback_at', old.callback_at),
      jsonb_build_object('callback_at', new.callback_at)
    );
  end if;

  if old.meeting_at is distinct from new.meeting_at then
    perform public.insert_lead_history(
      new.id,
      'meeting_set',
      'Zmieniono termin spotkania.',
      jsonb_build_object('meeting_at', old.meeting_at),
      jsonb_build_object('meeting_at', new.meeting_at)
    );
  end if;

  if old.meeting_address is distinct from new.meeting_address then
    perform public.insert_lead_history(
      new.id,
      'meeting_address',
      'Zmieniono adres spotkania.',
      jsonb_build_object('meeting_address', old.meeting_address),
      jsonb_build_object('meeting_address', new.meeting_address)
    );
  end if;

  if old.meeting_note is distinct from new.meeting_note then
    perform public.insert_lead_history(
      new.id,
      'meeting_note',
      'Dodano notatkę po spotkaniu.',
      jsonb_build_object('meeting_note', old.meeting_note),
      jsonb_build_object('meeting_note', new.meeting_note)
    );
  end if;

  if old.resignation_reason is distinct from new.resignation_reason then
    perform public.insert_lead_history(
      new.id,
      'resignation',
      'Zmieniono powód rezygnacji.',
      jsonb_build_object('resignation_reason', old.resignation_reason),
      jsonb_build_object('resignation_reason', new.resignation_reason)
    );
  end if;

  return new;
end;
$$;

create or replace function public.validate_sales_lead_path()
returns trigger
language plpgsql
security definer
set search_path = public
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
$$;

drop trigger if exists leads_validate_sales_lead_path on public.leads;
create trigger leads_validate_sales_lead_path
  before update on public.leads
  for each row execute function public.validate_sales_lead_path();

drop policy if exists "leads_insert_sales_manual" on public.leads;
create policy "leads_insert_sales_manual"
  on public.leads
  for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      assigned_to = auth.uid()
      and source in ('własne', 'polecenie', 'B2B', 'B2C')
      and status in ('Nowy', 'Przypisany')
    )
  );
