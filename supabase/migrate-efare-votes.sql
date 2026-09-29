-- Interim Leadership vote on the E-Fare proposal
-- Run in Supabase Dashboard → SQL Editor → Run

create table if not exists public.efare_votes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  vote text not null check (vote in ('aye', 'nay')),
  created_at timestamptz not null default now()
);

comment on table public.efare_votes is 'Aye / Nay votes on the Empowerment Fare proposal';

create unique index if not exists efare_votes_email_unique_idx
  on public.efare_votes (lower(email));

alter table public.efare_votes add column if not exists suggestion text;

alter table public.efare_votes enable row level security;
-- No public policies: Vercel API uses service_role only

create table if not exists public.efare_suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  suggestion text not null,
  created_at timestamptz not null default now()
);

comment on table public.efare_suggestions is 'Ideas to improve the E-Fare proposal';

create index if not exists efare_suggestions_created_at_idx
  on public.efare_suggestions (created_at desc);

alter table public.efare_suggestions enable row level security;
