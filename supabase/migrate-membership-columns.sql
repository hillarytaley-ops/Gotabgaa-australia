-- Ensure membership_registrations has columns used by join + admin + auth
-- Run in Supabase SQL Editor (safe to re-run)

alter table public.membership_registrations
  add column if not exists address text,
  add column if not exists date_of_birth text,
  add column if not exists referral_source text,
  add column if not exists fee_amount numeric(10, 2),
  add column if not exists fee_currency text default 'AUD',
  add column if not exists fee_display text,
  add column if not exists payment_status text default 'pending',
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz,
  add column if not exists membership_id text,
  add column if not exists member_status text default 'pending',
  add column if not exists auth_user_id uuid,
  add column if not exists data jsonb default '{}'::jsonb,
  add column if not exists read boolean default false;

-- Refresh PostgREST schema cache (or wait ~1 minute / restart project API)
notify pgrst, 'reload schema';
