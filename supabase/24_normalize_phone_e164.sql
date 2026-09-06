-- Canonical CRM phone format: E.164-like +<country code><subscriber number>.
-- Polish 9-digit numbers are normalized to +48XXXXXXXXX.
-- Existing international numbers keep their country code and gain a leading + when missing.

create or replace function public.normalize_crm_phone(input_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if input_phone is null or btrim(input_phone) = '' then
    return input_phone;
  end if;

  digits := regexp_replace(input_phone, '\D', '', 'g');

  if left(digits, 2) = '00' then
    digits := substr(digits, 3);
  end if;

  if length(digits) = 9 then
    digits := '48' || digits;
  end if;

  if length(digits) < 8 or length(digits) > 15 or left(digits, 1) = '0' then
    raise exception 'Niepoprawny numer telefonu: %', input_phone
      using errcode = '22023';
  end if;

  return '+' || digits;
end;
$$;

create or replace function public.normalize_lead_phone_trigger()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.normalize_crm_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists normalize_lead_phone_before_write on public.leads;
create trigger normalize_lead_phone_before_write
before insert or update of phone on public.leads
for each row execute function public.normalize_lead_phone_trigger();

update public.leads
set phone = public.normalize_crm_phone(phone)
where phone is not null
  and phone <> public.normalize_crm_phone(phone);

alter table public.leads
  drop constraint if exists leads_phone_e164_check;
alter table public.leads
  add constraint leads_phone_e164_check
  check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');

-- Keep copied phone numbers on contract records in the same canonical form.
create or replace function public.normalize_contract_phone_trigger()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.normalize_crm_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists normalize_contract_phone_before_write on public.contracts;
create trigger normalize_contract_phone_before_write
before insert or update of phone on public.contracts
for each row execute function public.normalize_contract_phone_trigger();

update public.contracts
set phone = public.normalize_crm_phone(phone)
where phone is not null
  and phone <> public.normalize_crm_phone(phone);

alter table public.contracts
  drop constraint if exists contracts_phone_e164_check;
alter table public.contracts
  add constraint contracts_phone_e164_check
  check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');
