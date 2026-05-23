-- Shared lead pool for Meta and other unassigned leads.
-- Admin and managers see the pool by role. Salespeople see it only after admin enables the flag.

alter table public.profiles
  add column if not exists can_view_lead_pool boolean not null default false;

create or replace function public.can_view_lead_pool()
returns boolean
as $$
  select coalesce((
    select profiles.can_view_lead_pool
    from public.profiles
    where profiles.id = auth.uid()
  ), false);
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.can_view_lead(p_assigned_to uuid)
returns boolean
as $$
  select public.can_manage_lead(p_assigned_to)
    or p_assigned_to = auth.uid()
    or (p_assigned_to is null and public.can_view_lead_pool());
$$
language sql
stable
security definer
set search_path = public;

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

  if old.assigned_to is null
     and new.assigned_to = auth.uid()
     and public.can_view_lead_pool()
     and new.status in ('Nowy', 'Przypisany')
     and (to_jsonb(new) - 'updated_at' - 'last_opened_at' - 'assigned_to' - 'status')
       = (to_jsonb(old) - 'updated_at' - 'last_opened_at' - 'assigned_to' - 'status') then
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
    raise exception 'Status Call back wymaga terminu callbacku.';
  end if;

  return new;
end;
$$;
