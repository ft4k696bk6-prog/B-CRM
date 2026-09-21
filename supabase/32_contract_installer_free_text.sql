begin;

alter table public.contracts
  add column if not exists installer_name text;

create or replace function public.guard_contract_workflow_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role') then return new; end if;
  if new.process_status is distinct from old.process_status
    or new.is_process_visible is distinct from old.is_process_visible
    or new.installation_at is distinct from old.installation_at
    or new.installer_id is distinct from old.installer_id
    or new.installer_name is distinct from old.installer_name
    or new.resigned_at is distinct from old.resigned_at then
    raise exception 'Oznaczenia realizacji można zmieniać wyłącznie przez moduł umów.' using errcode='42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_contract_workflow_fields() from public, anon, authenticated;

create or replace function public.update_contract_workflow(
  p_contract_id uuid, p_actor_id uuid, p_command jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  c public.contracts;
  actor public.profiles;
  legacy_installer public.profiles;
  w public.contract_workflow;
  before_state jsonb;
  operation text := p_command->>'action';
  field_name text := p_command->>'field';
  field_value boolean;
  next_installation timestamptz;
  next_installer_id uuid;
  next_installer_name text;
begin
  select * into actor from public.profiles where id = p_actor_id;
  if actor.id is null or actor.role not in ('owner','admin') then
    raise exception 'Oznaczeniami i archiwum zarządza właściciel lub administrator.' using errcode='42501';
  end if;

  select * into c from public.contracts where id = p_contract_id for update;
  if c.id is null or c.crm_environment is distinct from actor.crm_environment then
    raise exception 'Nie znaleziono umowy.' using errcode='42501';
  end if;

  select * into w from public.contract_workflow where contract_id = c.id for update;
  if w.contract_id is null then raise exception 'Brak danych realizacji umowy.'; end if;
  if (p_command->>'expected_version')::integer is distinct from w.version then
    raise exception 'Umowa została zmieniona przez inną osobę. Odśwież listę.' using errcode='40001';
  end if;

  before_state := to_jsonb(w) || jsonb_build_object(
    'installation_at', c.installation_at,
    'installer_name', c.installer_name
  );
  next_installation := c.installation_at;
  next_installer_id := c.installer_id;
  next_installer_name := c.installer_name;

  if operation = 'workflow' then
    if w.archived_at is not null then raise exception 'Najpierw przywróć umowę z archiwum.'; end if;
    if c.submission_status <> 'submitted' then raise exception 'Najpierw wyślij umowę do weryfikacji.'; end if;
    if jsonb_typeof(p_command->'value') is distinct from 'boolean' then raise exception 'Niepoprawne oznaczenie.'; end if;
    field_value := (p_command->>'value')::boolean;

    case field_name
      when 'verified' then w.verified := field_value;
      when 'equipment_ordered' then w.equipment_ordered := field_value;
      when 'pge_submitted' then w.pge_submitted := field_value;
      when 'settled' then w.settled := field_value;
      when 'installation_scheduled' then
        w.installation_scheduled := field_value;
        if field_value then
          next_installation := nullif(p_command->>'installation_at','')::timestamptz;
          if next_installation is null then raise exception 'Podaj termin montażu.'; end if;
          next_installer_name := btrim(coalesce(p_command->>'installer_name', ''));
          if next_installer_name <> '' then
            next_installer_id := null;
          elsif p_command ? 'installer_id' then
            next_installer_id := nullif(p_command->>'installer_id', '')::uuid;
            select * into legacy_installer
            from public.profiles
            where id = next_installer_id
              and crm_environment = actor.crm_environment;
            next_installer_name := btrim(coalesce(legacy_installer.full_name, ''));
          end if;
          if next_installer_name = '' then raise exception 'Wpisz montera lub ekipę.'; end if;
          if char_length(next_installer_name) > 160 then raise exception 'Nazwa montera jest za długa.'; end if;
        else
          next_installation := null;
          next_installer_id := null;
          next_installer_name := null;
        end if;
      else raise exception 'Niepoprawne oznaczenie.';
    end case;
  elsif operation = 'archive' then
    if w.archived_at is not null then raise exception 'Ta umowa jest już w archiwum.'; end if;
    if p_command->>'reason' = 'settled' then
      if not w.settled then raise exception 'Najpierw oznacz umowę jako rozliczoną.'; end if;
    elsif p_command->>'reason' is distinct from 'resigned' then
      raise exception 'Wybierz powód archiwizacji.';
    end if;
    w.archive_reason := p_command->>'reason';
    w.archived_at := now();
  elsif operation = 'restore' then
    w.archive_reason := null;
    w.archived_at := null;
  else
    raise exception 'Niepoprawna operacja.';
  end if;

  w.version := w.version + 1;
  w.updated_at := now();

  update public.contract_workflow set
    verified=w.verified,
    equipment_ordered=w.equipment_ordered,
    installation_scheduled=w.installation_scheduled,
    pge_submitted=w.pge_submitted,
    settled=w.settled,
    archived_at=w.archived_at,
    archive_reason=w.archive_reason,
    version=w.version,
    updated_at=w.updated_at
  where contract_id=c.id;

  update public.contracts set
    installation_at=next_installation,
    installer_name=next_installer_name,
    installer_id=next_installer_id,
    is_process_visible=c.submission_status='submitted' and w.archived_at is null,
    process_status=case
      when w.archive_reason='resigned' then 'resigned'
      when w.settled then 'settled'
      when c.submission_status='draft' then 'incomplete'
      when w.installation_scheduled then 'installation_scheduled'
      when w.equipment_ordered then 'installation_to_schedule'
      when w.verified then 'equipment_to_order'
      else 'verification'
    end,
    resigned_at=case
      when w.archive_reason='resigned' then coalesce(c.resigned_at,now())
      else null
    end
  where id=c.id;

  if w.installation_scheduled
    and next_installation is not null
    and w.archive_reason is distinct from 'resigned' then
    insert into public.calendar_events(
      id,title,description,starts_at,owner_id,owner_role,visibility,created_by,crm_environment
    )
    values(
      c.id,
      'Montaż — ' || c.customer_name,
      'Umowa ' || c.contract_number,
      next_installation,
      actor.id,
      actor.role,
      'internal',
      actor.id,
      c.crm_environment
    )
    on conflict(id) do update set
      starts_at=excluded.starts_at,
      title=excluded.title,
      description=excluded.description;
  else
    delete from public.calendar_events
    where id=c.id and crm_environment=c.crm_environment;
  end if;

  insert into public.contract_workflow_events(
    contract_id,changed_by,action,before_state,after_state
  )
  values(
    c.id,
    actor.id,
    case when operation='workflow' then field_name else operation end,
    before_state,
    to_jsonb(w) || jsonb_build_object(
      'installation_at', next_installation,
      'installer_name', next_installer_name
    )
  );

  return to_jsonb(w);
end;
$$;

revoke all on function public.update_contract_workflow(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.update_contract_workflow(uuid,uuid,jsonb)
  to service_role;

commit;
