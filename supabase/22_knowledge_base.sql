begin;

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  crm_environment text not null default 'production',
  title text not null,
  category text not null default 'Ogólne',
  content text not null,
  source_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_articles_scope_updated_idx
  on public.knowledge_articles(crm_environment, updated_at desc);

alter table public.knowledge_articles enable row level security;
drop policy if exists knowledge_articles_read_scope on public.knowledge_articles;
create policy knowledge_articles_read_scope on public.knowledge_articles for select to authenticated
  using (crm_environment = coalesce((select p.crm_environment from public.profiles p where p.id = auth.uid()), 'production'));

commit;
