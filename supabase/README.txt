CREATE TABLES IN SUPABASE (do this once)
=======================================

STEP 1 — Open SQL Editor
  https://supabase.com/dashboard
  → your project
  → left menu: SQL Editor
  → New query

STEP 2 — Run the schema
  Open this file in your repo: supabase/schema.sql
  Copy ALL of it → paste into SQL Editor → click RUN

STEP 3 — Check results
  You should see a small table at the bottom:

  table_name          | row_count
  site_content        | 1
  contact_submissions | 0

STEP 4 — Load website content into Postgres
  Option A: Admin dashboard (after Vercel env vars + redeploy)
    /admin/ → Sign in → Dashboard → "Load content into Supabase"

  Option B: Admin → Publish Changes (after editing anything)

TABLES CREATED
  site_content         — all CMS data (events, programs, pages, etc.)
  contact_submissions  — contact form inbox

VERCEL ENV (required before step 4)
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ADMIN_PASSWORD
  ADMIN_SECRET
