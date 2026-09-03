begin;

alter table public.profiles
  add column if not exists commission_percent numeric(6,3) not null default 0
  check (commission_percent >= 0 and commission_percent <= 100);

alter table public.leads add column if not exists campaign text;

-- Recover the latest complete contract snapshots that survived in lead history.
do $$
declare
  snapshot record;
  recovered public.contracts;
begin
  for snapshot in
    select distinct on (lead_id) lead_id, new_value
    from public.lead_history
    where action_type = 'contract_record' and new_value ? 'id'
    order by lead_id, created_at desc
  loop
    recovered := jsonb_populate_record(
      null::public.contracts,
      jsonb_build_object(
        'status', 'active',
        'currency', 'PLN',
        'metadata', '{}'::jsonb,
        'has_inverter', true,
        'mounting_locations', '[]'::jsonb,
        'multiple_mounting_locations', false,
        'backup_power', false,
        'optimizer_count', 0,
        'surge_protection', false,
        'grounding', false,
        'process_status', 'paused',
        'is_process_visible', false,
        'management_notes', '[]'::jsonb,
        'submission_status', 'submitted',
        'submitted_at', coalesce(snapshot.new_value->>'updated_at', snapshot.new_value->>'created_at')
      ) || snapshot.new_value
    );
    recovered.status := coalesce(recovered.status, 'active');
    recovered.currency := coalesce(recovered.currency, 'PLN');
    recovered.metadata := coalesce(recovered.metadata, '{}'::jsonb);
    recovered.submission_status := 'submitted';
    recovered.submitted_at := coalesce(recovered.submitted_at, recovered.updated_at, recovered.created_at);
    if exists (
      select 1 from public.contracts c
      where c.crm_environment = recovered.crm_environment
        and c.contract_number = recovered.contract_number
        and c.lead_id is distinct from recovered.lead_id
    ) then
      recovered.contract_number := recovered.contract_number || '-' || left(recovered.lead_id::text, 8);
    end if;
    insert into public.contracts select recovered.*
    on conflict (id) do nothing;
  end loop;
end $$;

-- Keep every older contract lead available in the archive, even when its old
-- form snapshot is unavailable.
insert into public.contracts (
  id, lead_id, crm_environment, contract_number, status, product_type, signed_at,
  gross_amount, currency, metadata, customer_name, phone, email, postal_code,
  street, created_by, process_status, is_process_visible, additional_notes,
  submission_status, submitted_at, created_at, updated_at
)
select
  l.id, l.id, l.crm_environment,
  case
    when nullif(l.contract_number, '') is null then 'DO UZUPEŁNIENIA-' || left(l.id::text, 8)
    when upper(trim(l.contract_number)) in ('NIEZNANY', '??') then l.contract_number || '-' || left(l.id::text, 8)
    else l.contract_number
  end,
  'active', 'other', l.updated_at::date, 0, 'PLN', '{}'::jsonb, l.full_name,
  l.phone, l.email, l.postal_code, l.address,
  coalesce(
    (select h.user_id from public.lead_history h where h.lead_id = l.id and h.user_id is not null order by h.created_at desc limit 1),
    l.assigned_to
  ),
  'paused', false, 'Odzyskana starsza umowa — brak pełnego formularza w historii.',
  'submitted', l.updated_at, l.created_at, l.updated_at
from public.leads l
where l.status = 'Umowa'
  and not exists (select 1 from public.contracts existing where existing.lead_id = l.id)
on conflict (id) do nothing;

-- Restore file metadata from the physical Storage objects. No object is moved
-- or overwritten; records are only linked back to their contracts.
insert into public.contract_files (
  id, contract_id, uploaded_by, kind, file_name, file_path, mime_type, file_size, created_at
)
select
  o.id,
  c.id,
  null,
  case
    when coalesce(o.metadata->>'mimetype', '') = 'application/pdf' then 'contract_pdf'
    when coalesce(o.metadata->>'mimetype', '') like 'video/%' then 'video'
    else 'photo'
  end,
  regexp_replace(split_part(o.name, '/', 3), '^[0-9a-fA-F-]{36}-', ''),
  o.name,
  o.metadata->>'mimetype',
  nullif(o.metadata->>'size', '')::bigint,
  o.created_at
from storage.objects o
join public.contracts c
  on c.lead_id::text = split_part(o.name, '/', 2)
 and c.crm_environment = split_part(o.name, '/', 1)
where o.bucket_id = 'contract-files'
on conflict (id) do nothing;

-- Recreate task rows from the newest saved contract snapshot.
with latest as (
  select distinct on (lead_id) lead_id, new_value
  from public.lead_history
  where action_type = 'contract_record' and new_value ? 'tasks'
  order by lead_id, created_at desc
), task_rows as (
  select c.id as contract_id, task
  from latest l
  join public.contracts c on c.lead_id = l.lead_id
  cross join lateral jsonb_array_elements(coalesce(l.new_value->'tasks', '[]'::jsonb)) task
)
insert into public.contract_tasks (id, contract_id, task_key, completed, completed_at, completed_by, updated_at)
select
  coalesce(nullif(task->>'id', '')::uuid, gen_random_uuid()), contract_id,
  task->>'task_key', coalesce((task->>'completed')::boolean, false),
  nullif(task->>'completed_at', '')::timestamptz,
  nullif(task->>'completed_by', '')::uuid,
  coalesce(nullif(task->>'updated_at', '')::timestamptz, now())
from task_rows
where task->>'task_key' in ('do_domkniecia','zamowic_sprzet','umowic_montaz','do_montazu','zglosic_pge','do_rozliczenia')
on conflict (id) do nothing;

-- Recover the five current operational items requested on 3 September 2026.
insert into public.contracts (
  id, lead_id, crm_environment, contract_number, status, product_type, signed_at,
  gross_amount, currency, metadata, customer_name, phone, email, postal_code,
  street, created_by, process_status, is_process_visible, installation_at,
  additional_notes, submission_status, submitted_at, created_at, updated_at
)
select
  l.id, l.id, l.crm_environment,
  coalesce(nullif(l.contract_number, ''), 'DO UZUPEŁNIENIA-' || upper(left(replace(l.full_name, ' ', ''), 4))),
  'active', 'other', current_date, 0, 'PLN', '{}'::jsonb, l.full_name, l.phone,
  l.email, l.postal_code, l.address, l.assigned_to,
  case when l.id = '8a1fc12f-d70e-456d-9380-858c4bde3ed3'::uuid then 'equipment_to_order' else 'installation_scheduled' end,
  true,
  case l.id
    when '7c6b6d30-c9eb-444c-bda9-9b421df43b1e'::uuid then '2026-09-03 08:00 Europe/Warsaw'::timestamptz
    when '41644e24-876c-4098-9de6-88112a19caf3'::uuid then '2026-09-04 08:00 Europe/Warsaw'::timestamptz
    when '56531fff-03d3-4f13-89bd-5b1838573e57'::uuid then '2026-09-22 08:00 Europe/Warsaw'::timestamptz
    when 'c2b7dc32-8d4b-429f-8c9b-70830d1fa0c8'::uuid then '2026-09-23 08:00 Europe/Warsaw'::timestamptz
    else null
  end,
  'Termin przekazany jako data bez godziny — godzina montażu do potwierdzenia.',
  'submitted', now(), l.created_at, now()
from public.leads l
where l.id in (
  '7c6b6d30-c9eb-444c-bda9-9b421df43b1e'::uuid,
  '41644e24-876c-4098-9de6-88112a19caf3'::uuid,
  '56531fff-03d3-4f13-89bd-5b1838573e57'::uuid,
  'c2b7dc32-8d4b-429f-8c9b-70830d1fa0c8'::uuid,
  '8a1fc12f-d70e-456d-9380-858c4bde3ed3'::uuid
)
and not exists (select 1 from public.contracts existing where existing.lead_id = l.id)
on conflict (id) do nothing;

update public.contracts
set process_status = case
      when lead_id = '8a1fc12f-d70e-456d-9380-858c4bde3ed3'::uuid then 'equipment_to_order'
      else 'installation_scheduled'
    end,
    is_process_visible = true,
    installation_at = case lead_id
      when '7c6b6d30-c9eb-444c-bda9-9b421df43b1e'::uuid then '2026-09-03 08:00 Europe/Warsaw'::timestamptz
      when '41644e24-876c-4098-9de6-88112a19caf3'::uuid then '2026-09-04 08:00 Europe/Warsaw'::timestamptz
      when '56531fff-03d3-4f13-89bd-5b1838573e57'::uuid then '2026-09-22 08:00 Europe/Warsaw'::timestamptz
      when 'c2b7dc32-8d4b-429f-8c9b-70830d1fa0c8'::uuid then '2026-09-23 08:00 Europe/Warsaw'::timestamptz
      else null
    end,
    submission_status = 'submitted',
    submitted_at = coalesce(submitted_at, now()),
    additional_notes = concat_ws(E'\n', nullif(additional_notes, ''), 'Termin przekazany jako data bez godziny — godzina montażu do potwierdzenia.'),
    updated_at = now()
where lead_id in (
  '7c6b6d30-c9eb-444c-bda9-9b421df43b1e'::uuid,
  '41644e24-876c-4098-9de6-88112a19caf3'::uuid,
  '56531fff-03d3-4f13-89bd-5b1838573e57'::uuid,
  'c2b7dc32-8d4b-429f-8c9b-70830d1fa0c8'::uuid,
  '8a1fc12f-d70e-456d-9380-858c4bde3ed3'::uuid
);

update public.leads
set status = 'Umowa', assigned_to = null, callback_at = null, meeting_at = null, updated_at = now()
where id in (
  '7c6b6d30-c9eb-444c-bda9-9b421df43b1e'::uuid,
  'c2b7dc32-8d4b-429f-8c9b-70830d1fa0c8'::uuid,
  '8a1fc12f-d70e-456d-9380-858c4bde3ed3'::uuid
);

-- Administrators may correct archived contracts and resignations. Salespeople
-- still cannot change a terminal lead or its assignment.
create or replace function public.validate_sales_lead_path()
returns trigger
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if old.status in ('Rezygnacja', 'Umowa') and new is distinct from old then
    raise exception 'Umowa i rezygnacja są dostępne wyłącznie w koszyku administracyjnym.';
  end if;
  if (to_jsonb(new) - 'updated_at' - 'last_opened_at') = (to_jsonb(old) - 'updated_at' - 'last_opened_at') then return new; end if;
  if old.assigned_to is distinct from auth.uid() then raise exception 'Handlowiec może edytować tylko swoje leady.'; end if;
  if new.assigned_to is distinct from old.assigned_to and not (new.assigned_to is null and new.status = 'Nowy') then raise exception 'Handlowiec nie może przypisywać leadów.'; end if;
  if new.status = 'Umowa' and old.status not in ('Spotkanie', 'Po spotkaniu', 'Umowa') then raise exception 'Umowę można oznaczyć dopiero po spotkaniu.'; end if;
  if new.status = 'Umowa' and nullif(trim(coalesce(new.contract_number, '')), '') is null then raise exception 'Status Umowa wymaga numeru umowy.'; end if;
  if new.status = 'Spotkanie' and (new.meeting_at is null or nullif(trim(coalesce(new.meeting_address, new.address, '')), '') is null) then raise exception 'Status Spotkanie wymaga terminu i adresu klienta.'; end if;
  if new.status = 'Po spotkaniu' and nullif(trim(coalesce(new.meeting_note, '')), '') is null then raise exception 'Status Po spotkaniu wymaga notatki.'; end if;
  if new.status = 'Call back' and new.callback_at is null then raise exception 'Status Call back wymaga daty i godziny.'; end if;
  if new.status = 'Rezygnacja' and nullif(trim(coalesce(new.resignation_reason, '')), '') is null then raise exception 'Rezygnacja wymaga powodu.'; end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

commit;
