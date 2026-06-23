-- Member portal: membership IDs and status on registrations
alter table public.membership_registrations add column if not exists membership_id text;
alter table public.membership_registrations add column if not exists member_status text not null default 'pending';
alter table public.membership_registrations add column if not exists data jsonb not null default '{}'::jsonb;

create unique index if not exists membership_registrations_membership_id_idx
  on public.membership_registrations (membership_id)
  where membership_id is not null;

create index if not exists membership_registrations_member_status_idx
  on public.membership_registrations (member_status, created_at desc);
