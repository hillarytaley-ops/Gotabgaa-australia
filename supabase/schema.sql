-- ============================================================
-- Gotabgaa Australia — Supabase Postgres
-- Run this ENTIRE file in: Supabase Dashboard → SQL Editor → Run
-- Safe to run more than once (idempotent).
-- ============================================================

-- 1) CMS content (events, programs, leadership, gallery, site settings — one JSON document)
create table if not exists public.site_content (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.site_content is 'Published website content (mirrors data/content.json)';

-- 2) Contact form inbox
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

comment on table public.contact_submissions is 'Messages from the website contact form';

create index if not exists contact_submissions_created_at_idx
  on public.contact_submissions (created_at desc);

create index if not exists contact_submissions_read_idx
  on public.contact_submissions (read, created_at desc);

-- Empty row so Admin → Publish can upsert immediately
insert into public.site_content (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

-- Row Level Security
alter table public.site_content enable row level security;
alter table public.contact_submissions enable row level security;

drop policy if exists "Public read site content" on public.site_content;
create policy "Public read site content"
  on public.site_content for select
  using (true);

-- contact_submissions: no public policies (Vercel API uses service_role only)

-- Verify tables exist (results appear below the editor after Run)
select
  'site_content' as table_name,
  count(*) as row_count
from public.site_content
union all
select
  'contact_submissions',
  count(*)
from public.contact_submissions;
