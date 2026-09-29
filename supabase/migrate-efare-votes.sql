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

alter table public.efare_votes enable row level security;
-- No public policies: Vercel API uses service_role only
