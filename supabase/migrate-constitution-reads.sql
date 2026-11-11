-- Constitution draft reader analytics (anonymous sessions)
-- Run in Supabase Dashboard → SQL Editor → Run

create table if not exists public.constitution_reads (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  visited_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  max_page integer not null default 1,
  pages_viewed integer not null default 1,
  dwell_seconds integer not null default 0,
  total_pages integer,
  engaged boolean not null default false,
  referrer text,
  path text,
  user_agent text,
  constraint constitution_reads_session_id_unique unique (session_id)
);

comment on table public.constitution_reads is
  'Anonymous constitution viewer sessions: visits and read engagement';

create index if not exists constitution_reads_visited_at_idx
  on public.constitution_reads (visited_at desc);

create index if not exists constitution_reads_engaged_idx
  on public.constitution_reads (engaged);

create index if not exists constitution_reads_last_seen_at_idx
  on public.constitution_reads (last_seen_at desc);

alter table public.constitution_reads enable row level security;
-- No public policies: Vercel API uses service_role only
