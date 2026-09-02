alter table public.contracts
  add column if not exists submission_status text not null default 'draft'
  check (submission_status in ('draft', 'submitted'));

alter table public.contracts add column if not exists submitted_at timestamptz;

update public.contracts
set submission_status = case when process_status = 'incomplete' then 'draft' else 'submitted' end,
    submitted_at = case when process_status = 'incomplete' then null else coalesce(submitted_at, updated_at, created_at) end,
    is_process_visible = case when process_status = 'incomplete' then false else is_process_visible end;

create index if not exists contracts_submission_scope_idx
  on public.contracts(crm_environment, submission_status, created_by, updated_at desc);

create or replace function public.submit_contract(p_contract_id uuid, p_actor_id uuid)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.contracts;
  v_pdf_count integer;
  v_photo_count integer;
begin
  select * into v_contract from public.contracts where id = p_contract_id for update;
  if v_contract.id is null then raise exception 'Nie znaleziono umowy.'; end if;
  if v_contract.submission_status = 'submitted' then return v_contract; end if;

  select count(*) filter (where kind = 'contract_pdf'), count(*) filter (where kind = 'photo')
  into v_pdf_count, v_photo_count
  from public.contract_files where contract_id = p_contract_id;
  if v_pdf_count < 1 then raise exception 'Dodaj PDF umowy przed wysłaniem.'; end if;
  if v_photo_count < 1 then raise exception 'Dodaj co najmniej jedno zdjęcie przed wysłaniem.'; end if;

  update public.contracts
  set submission_status = 'submitted', submitted_at = now(), process_status = 'verification',
      is_process_visible = true, updated_at = now()
  where id = p_contract_id returning * into v_contract;

  update public.leads
  set status = 'Umowa', assigned_to = null, contract_number = v_contract.contract_number,
      callback_at = null, meeting_at = null, updated_at = now()
  where id = v_contract.lead_id and crm_environment = v_contract.crm_environment;

  insert into public.lead_history(lead_id, user_id, action_type, description, new_value)
  values (v_contract.lead_id, p_actor_id, 'contract_submitted',
          'Wysłano komplet umowy ' || v_contract.contract_number || ' do weryfikacji.',
          jsonb_build_object('contract_id', v_contract.id, 'submission_status', 'submitted', 'process_status', 'verification'));
  return v_contract;
end;
$$;

revoke all on function public.submit_contract(uuid, uuid) from public;
grant execute on function public.submit_contract(uuid, uuid) to service_role;

-- Lead visibility: only administrators have the full CRM scope. Managers see
-- the unassigned pool and their team; salespeople see their own records.
create or replace function public.can_view_lead(p_assigned_to uuid)
returns boolean
as $$
  select public.can_manage_lead(p_assigned_to) or p_assigned_to = auth.uid();
$$
language sql
stable
security definer
set search_path = public;
