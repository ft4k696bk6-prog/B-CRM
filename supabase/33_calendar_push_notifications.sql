begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  crm_environment text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  notification_time time not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_profile_idx on public.push_subscriptions(profile_id, enabled);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create table if not exists public.push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  delivery_date date not null,
  delivery_kind text not null default 'daily_calendar',
  sent_at timestamptz not null default now(),
  unique(subscription_id, delivery_date, delivery_kind)
);
alter table public.push_delivery_log enable row level security;
revoke all on public.push_delivery_log from anon, authenticated;

create table if not exists public.push_config (
  id text primary key,
  vapid_public_key text not null,
  vapid_private_jwk jsonb not null,
  vapid_subject text not null,
  cron_token_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

commit;
