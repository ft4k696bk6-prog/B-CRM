-- Jednorazowe porządkowanie przydziałów z 21 lipca 2026.
-- Spotkania i call-backi pozostają u handlowców. Pozostałe rekordy wracają do bazy.

update public.leads
set
  status = 'Nowy',
  assigned_to = null,
  meeting_at = null,
  meeting_address = null,
  meeting_note = null,
  last_opened_at = null
where status = 'Spotkanie'
  and (meeting_at < date_trunc('month', now()) or meeting_at is null)
  and updated_at <= '2026-07-21T23:59:59.999Z'::timestamptz;

update public.leads
set
  status = 'Nowy',
  assigned_to = null,
  callback_at = null,
  meeting_at = null,
  meeting_address = null,
  meeting_note = null,
  resignation_reason = null,
  contract_number = null,
  last_opened_at = null
where assigned_to is not null
  and status not in ('Spotkanie', 'Call back', 'Umowa', 'Rezygnacja')
  and updated_at <= '2026-07-21T23:59:59.999Z'::timestamptz;

update public.leads
set assigned_to = null
where assigned_to is not null
  and status in ('Umowa', 'Rezygnacja')
  and updated_at <= '2026-07-21T23:59:59.999Z'::timestamptz;
