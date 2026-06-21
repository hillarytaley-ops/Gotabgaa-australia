Gotabgaa Australia — Supabase Setup
=====================================

1. Open your Supabase project → SQL Editor
2. Run the full script: supabase/schema.sql
3. In Vercel → Settings → Environment Variables, add:
   - SUPABASE_URL          (Project Settings → API → Project URL)
   - SUPABASE_SERVICE_ROLE_KEY  (Project Settings → API → service_role — keep secret)
4. Redeploy the site on Vercel

FIRST-TIME CONTENT
  Admin → Sign in → Publish Changes
  (copies data/content.json into Postgres)

CONTACT INBOX
  Contact form saves to contact_submissions table
  Admin → Inbox (after sign in)

LOCAL API TEST
  npm install
  vercel dev
  (with .env.local containing the variables above)
