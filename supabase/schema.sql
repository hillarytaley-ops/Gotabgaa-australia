-- Gotabgaa Australia — Supabase Postgres schema
-- Run in Supabase Dashboard → SQL Editor

-- Site CMS content (mirrors data/content.json)
create table if not exists public.site_content (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Contact form submissions
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

create index if not exists contact_submissions_created_at_idx
  on public.contact_submissions (created_at desc);

-- Seed row (import full JSON via Admin → Publish, or paste content.json into data column)
insert into public.site_content (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

-- Row Level Security (API uses service role; these protect direct client access)
alter table public.site_content enable row level security;
alter table public.contact_submissions enable row level security;

-- Optional: allow public read of published content via anon key (if you use client-side Supabase later)
create policy "Public read site content"
  on public.site_content for select
  using (true);

-- No public policies on contact_submissions — inserts/reads go through Vercel API only
