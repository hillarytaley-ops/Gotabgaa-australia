-- Social welfare program — run in Supabase SQL Editor
-- Safe to run more than once (idempotent).

create table if not exists public.welfare_registrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  membership_id text,
  state_chapter text,
  package_id text,
  package_title text,
  fee_amount numeric(10, 2),
  fee_currency text not null default 'AUD',
  fee_display text,
  payment_status text not null default 'pending',
  payment_reference text,
  paid_at timestamptz,
  welfare_status text not null default 'pending',
  notes text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

comment on table public.welfare_registrations is 'Social welfare program registrations from welfare.html';

create index if not exists welfare_registrations_created_at_idx
  on public.welfare_registrations (created_at desc);

create index if not exists welfare_registrations_email_idx
  on public.welfare_registrations (lower(email));

create index if not exists welfare_registrations_membership_id_idx
  on public.welfare_registrations (membership_id)
  where membership_id is not null;

create index if not exists welfare_registrations_welfare_status_idx
  on public.welfare_registrations (welfare_status, created_at desc);

create table if not exists public.welfare_reimbursement_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  membership_id text not null,
  member_name text,
  deceased_name text,
  relationship text,
  date_of_loss text,
  summary text,
  status text not null default 'submitted',
  status_message text,
  status_updated_at timestamptz,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

comment on table public.welfare_reimbursement_requests is 'Bereavement reimbursement requests from welfare members';

create index if not exists welfare_reimbursement_requests_created_at_idx
  on public.welfare_reimbursement_requests (created_at desc);

create index if not exists welfare_reimbursement_requests_member_idx
  on public.welfare_reimbursement_requests (lower(email), membership_id);

create index if not exists welfare_reimbursement_requests_status_idx
  on public.welfare_reimbursement_requests (status, created_at desc);

create table if not exists public.welfare_community_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null default 'reimbursement_in_progress',
  message text not null,
  related_request_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.welfare_community_alerts is 'Anonymous alerts shown to active welfare members';

create index if not exists welfare_community_alerts_active_idx
  on public.welfare_community_alerts (active, created_at desc);

alter table public.welfare_registrations enable row level security;
alter table public.welfare_reimbursement_requests enable row level security;
alter table public.welfare_community_alerts enable row level security;
