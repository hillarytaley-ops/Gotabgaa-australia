Gotabgaa Australia — Admin Dashboard Setup
============================================

URL:  /admin/  (e.g. https://gotabgaa-australia.vercel.app/admin/)

WHAT IT MANAGES
  Site settings (email, social, tagline)
  Home page (hero, stats, CTAs)
  About, Programs, Events, Leadership, Gallery
  Contact info and page hero text for all pages

HOW CONTENT WORKS
  All content lives in data/content.json
  Public pages load this file via js/content-loader.js
  Admin edits JSON and publishes

PUBLISHING (choose one or both)

  A) Supabase Postgres (recommended — instant live updates)
     SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel
     Run supabase/schema.sql in your Supabase SQL Editor
     See supabase/README.txt

  B) GitHub commit (optional backup)
     GITHUB_TOKEN + GITHUB_REPO in Vercel

  Admin → Publish Changes stores content in Supabase (and GitHub if configured).

CONTACT INBOX
  With Supabase connected, form messages appear in Admin → Inbox.

LOCAL TESTING
  API routes need Vercel CLI or deploy preview for login/publish.
  For local content preview, use serve.ps1 and edit data/content.json.

SECURITY
  Do not share admin URL publicly. Use a strong ADMIN_PASSWORD.
  Rotate GITHUB_TOKEN if compromised.
