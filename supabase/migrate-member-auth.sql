-- Member Auth (Supabase Auth email/password)
-- Optional: links membership_registrations rows to auth.users
-- Run in Supabase SQL Editor after Auth is enabled (default on all projects).

alter table public.membership_registrations
  add column if not exists auth_user_id uuid;

create index if not exists membership_registrations_auth_user_id_idx
  on public.membership_registrations (auth_user_id)
  where auth_user_id is not null;

comment on column public.membership_registrations.auth_user_id is
  'Supabase auth.users.id for email/password member login';
