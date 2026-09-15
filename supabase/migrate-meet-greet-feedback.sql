-- Meet & Greet feedback (website tick-box form)
-- Run in Supabase Dashboard → SQL Editor → Run

create table if not exists public.meet_greet_feedback (
  id uuid primary key default gen_random_uuid(),
  attended text not null,
  state text,
  overall text not null,
  useful text not null,
  topics text[] not null default '{}',
  time_ok text,
  zoom text,
  come_again text not null,
  next_steps text[] not null default '{}',
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

comment on table public.meet_greet_feedback is 'Responses from meet-greet-feedback.html';

create index if not exists meet_greet_feedback_created_at_idx
  on public.meet_greet_feedback (created_at desc);

alter table public.meet_greet_feedback enable row level security;
-- No public policies: Vercel API uses service_role only
