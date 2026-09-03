alter table public.profiles
  add column if not exists mandatory_queue_snoozed_until timestamptz;
