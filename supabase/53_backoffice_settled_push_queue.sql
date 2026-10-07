begin;

create table if not exists public.backoffice_push_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  crm_environment text not null,
  event_kind text not null default 'settled' check (event_kind = 'settled'),
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  last_attempt_at timestamptz,
  attempts integer not null default 0,
  processed_at timestamptz,
  last_error text,
  unique(contract_id, event_kind)
);

create index if not exists backoffice_push_events_pending_idx
  on public.backoffice_push_events(processed_at, created_at)
  where processed_at is null;

alter table public.backoffice_push_events enable row level security;
revoke all on public.backoffice_push_events from anon, authenticated;

create or replace function public.queue_backoffice_settled_push()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  environment text;
begin
  if new.settled = true and old.settled is distinct from true then
    select c.crm_environment into environment
    from public.contracts c
    where c.id = new.contract_id;

    if environment is not null then
      insert into public.backoffice_push_events(contract_id, crm_environment, event_kind)
      values(new.contract_id, environment, 'settled')
      on conflict (contract_id, event_kind) do nothing;
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.queue_backoffice_settled_push() from public, anon, authenticated;

drop trigger if exists trg_queue_backoffice_settled_push on public.contract_workflow;
create trigger trg_queue_backoffice_settled_push
after update of settled on public.contract_workflow
for each row
execute function public.queue_backoffice_settled_push();

create or replace function public.claim_backoffice_push_events(p_limit integer default 25)
returns table(
  id uuid,
  contract_id uuid,
  crm_environment text,
  attempts integer
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return query
  with picked as (
    select e.id
    from public.backoffice_push_events e
    where e.processed_at is null
      and (e.locked_at is null or e.locked_at < now() - interval '5 minutes')
    order by e.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.backoffice_push_events e
  set
    locked_at = now(),
    last_attempt_at = now(),
    attempts = e.attempts + 1,
    last_error = null
  from picked
  where e.id = picked.id
  returning e.id, e.contract_id, e.crm_environment, e.attempts;
end;
$function$;

revoke all on function public.claim_backoffice_push_events(integer) from public, anon, authenticated;
grant execute on function public.claim_backoffice_push_events(integer) to service_role;

-- Use the same protected token/Vault secret as the existing calendar push worker.
-- Recreating by name keeps this migration idempotent when replayed.
do $block$
begin
  if exists (select 1 from cron.job where jobname = 'bcrm-backoffice-push-every-minute') then
    perform cron.unschedule('bcrm-backoffice-push-every-minute');
  end if;

  perform cron.schedule(
    'bcrm-backoffice-push-every-minute',
    '* * * * *',
    $cron$
      select net.http_post(
        url := 'https://b-crm-berni.vercel.app/api/push/send-events',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-bcrm-push-token', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name='bcrm_calendar_push_cron_token'
            limit 1
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );
end;
$block$;

commit;
