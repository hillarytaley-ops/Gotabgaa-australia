-- Run this in Supabase SQL Editor if application submit/status features fail
-- or after upgrading from an older schema.

alter table public.ailcd_applications add column if not exists reference_code text;
alter table public.ailcd_applications add column if not exists status text not null default 'pending';
alter table public.ailcd_applications add column if not exists status_message text;
alter table public.ailcd_applications add column if not exists status_updated_at timestamptz;

create unique index if not exists ailcd_applications_reference_code_idx
  on public.ailcd_applications (reference_code)
  where reference_code is not null;

create index if not exists ailcd_applications_status_idx
  on public.ailcd_applications (status, created_at desc);

create unique index if not exists ailcd_applications_email_unique_idx
  on public.ailcd_applications (lower(email));

-- Backfill reference/status from JSON data for rows saved before columns existed
update public.ailcd_applications
set
  reference_code = coalesce(reference_code, nullif(data->>'_referenceCode', '')),
  status = coalesce(nullif(status, ''), nullif(data->>'_status', ''), 'pending'),
  status_message = coalesce(status_message, nullif(data->>'_statusMessage', '')),
  status_updated_at = coalesce(
    status_updated_at,
    nullif(data->>'_statusUpdatedAt', '')::timestamptz,
    created_at
  )
where reference_code is null
   or status is null
   or status = 'pending' and data ? '_status';
