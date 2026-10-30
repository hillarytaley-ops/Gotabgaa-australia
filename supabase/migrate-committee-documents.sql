-- Committee documents library (Admin → Documents)
-- Run in Supabase SQL Editor, then create a PRIVATE Storage bucket named "documents":
--   Dashboard → Storage → New bucket → name: documents → Public: OFF

create table if not exists public.committee_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'General',
  storage_path text not null,
  file_name text not null,
  content_type text not null default 'application/octet-stream',
  byte_size integer not null default 0,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists committee_documents_created_at_idx
  on public.committee_documents (created_at desc);

create index if not exists committee_documents_category_idx
  on public.committee_documents (category);

alter table public.committee_documents enable row level security;

-- All access goes through the admin API with the service role key.
revoke all on table public.committee_documents from public, anon, authenticated;

comment on table public.committee_documents is
  'Committee document library metadata; files live in private Storage bucket "documents"';
