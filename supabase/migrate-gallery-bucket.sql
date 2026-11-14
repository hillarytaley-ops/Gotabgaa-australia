-- Create public Storage bucket for gallery + leadership photo uploads
-- Run in Supabase Dashboard → SQL Editor → Run
-- (Storage → New bucket → name: gallery → Public: ON also works)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public read access for objects in the gallery bucket
drop policy if exists "Public read gallery" on storage.objects;
create policy "Public read gallery"
  on storage.objects for select
  to public
  using (bucket_id = 'gallery');

-- Service role / authenticated uploads are handled by the Vercel API with the service key.
-- Optional: allow authenticated inserts if you ever upload from the browser client.
drop policy if exists "Auth upload gallery" on storage.objects;
create policy "Auth upload gallery"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gallery');
