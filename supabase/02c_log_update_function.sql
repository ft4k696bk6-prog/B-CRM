create or replace function public.log_lead_update()
returns trigger
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
$$
language plpgsql
security definer
set search_path = public;
