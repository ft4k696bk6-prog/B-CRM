-- Canonical phone storage for leads.
-- Production was audited before applying this migration. Ambiguous legacy
-- numbers are intentionally not guessed or rewritten.

create or replace function public.normalize_lead_phone_e164()
returns trigger
language plpgsql
as $$
declare
  normalized text;
  digits text;
begin
  normalized := btrim(coalesce(new.phone, ''));
  if normalized = '' then
    raise exception 'Numer telefonu jest wymagany.';
  end if;

  normalized := regexp_replace(normalized, '[^0-9+]', '', 'g');

  if left(normalized, 2) = '00' then
    normalized := '+' || substr(normalized, 3);
  end if;

  digits := regexp_replace(normalized, '[^0-9]', '', 'g');

  if left(normalized, 1) <> '+' then
    if length(digits) = 9 then
      normalized := '+48' || digits;
    elsif length(digits) = 11 and left(digits, 2) = '48' then
      normalized := '+' || digits;
    else
      raise exception 'Numer telefonu musi mieć format międzynarodowy, np. +48600123456.';
    end if;
  end if;

  if normalized !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Niepoprawny numer telefonu. Użyj formatu E.164, np. +48600123456.';
  end if;

  new.phone := normalized;
  return new;
end;
$$;

drop trigger if exists trg_normalize_lead_phone_e164 on public.leads;
create trigger trg_normalize_lead_phone_e164
before insert or update of phone on public.leads
for each row
execute function public.normalize_lead_phone_e164();

-- Safe legacy Polish numbers only. Other international/ambiguous values must
-- be reviewed rather than assigned a guessed country code.
update public.leads
set phone = '+48' || regexp_replace(phone, '[^0-9]', '', 'g')
where length(regexp_replace(phone, '[^0-9]', '', 'g')) = 9;

update public.leads
set phone = '+' || regexp_replace(phone, '[^0-9]', '', 'g')
where left(regexp_replace(phone, '[^0-9]', '', 'g'), 2) = '48'
  and length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11
  and left(btrim(phone), 1) <> '+';

update public.leads
set phone = '+' || regexp_replace(phone, '[^0-9]', '', 'g')
where btrim(phone) like '+%'
  and ('+' || regexp_replace(phone, '[^0-9]', '', 'g')) ~ '^\+[1-9][0-9]{7,14}$'
  and phone <> '+' || regexp_replace(phone, '[^0-9]', '', 'g');
