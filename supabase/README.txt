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

STEP 3 — Member Auth (email + password login)
  Run: supabase/migrate-member-auth.sql

STEP 4 — Supabase Auth URL settings
  Authentication → URL Configuration
  Site URL: https://gotabgaa-australia.vercel.app
  Redirect URLs (add both):
    https://gotabgaa-australia.vercel.app/set-password.html
    http://localhost:3000/set-password.html   (optional, for local)

STEP 5 — Vercel environment variables
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_ANON_KEY          ← required for member email/password sign-in
  SITE_URL                   ← https://gotabgaa-australia.vercel.app
  ADMIN_PASSWORD
  ADMIN_SECRET
  RESEND_API_KEY             ← recommended so approval emails send password links
  EMAIL_FROM

STEP 6 — Redeploy on Vercel after adding env vars

HOW MEMBER LOGIN WORKS
  1. Member registers on join.html
  2. Admin Approves → system creates Supabase Auth user + emails "Set password" link
  3. Member opens link → set-password.html → chooses password
  4. Member signs in on login.html with email + password
  5. For existing approved members: Admin → "Send password setup"

TABLES
  site_content, contact_submissions, membership_registrations, …
  membership_registrations.auth_user_id links to auth.users (optional column)
