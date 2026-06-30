-- PayID / payment tracking — run in Supabase SQL Editor (safe to re-run)

alter table public.event_bookings
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists fee_amount numeric(10, 2),
  add column if not exists fee_display text,
  add column if not exists data jsonb not null default '{}'::jsonb;

alter table public.membership_registrations
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz;

create index if not exists event_bookings_payment_status_idx
  on public.event_bookings (payment_status, created_at desc);

create index if not exists membership_registrations_payment_status_idx
  on public.membership_registrations (payment_status, created_at desc);
