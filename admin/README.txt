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

PUBLISHING (choose one)

  A) Cloud publish (recommended)
     Set these in Vercel → Project → Settings → Environment Variables:

     ADMIN_PASSWORD     Your admin login password
     ADMIN_SECRET       Random long string (e.g. openssl rand -hex 32)
     GITHUB_TOKEN       GitHub PAT with repo Contents write access
     GITHUB_REPO        hillarytaley-ops/Gotabgaa-australia

     Then: edit in admin → Publish Changes → auto GitHub commit → Vercel redeploy

  B) Manual export
     Admin → Export JSON → replace data/content.json → git commit → push

LOCAL TESTING
  API routes need Vercel CLI or deploy preview for login/publish.
  For local content preview, use serve.ps1 and edit data/content.json.

SECURITY
  Do not share admin URL publicly. Use a strong ADMIN_PASSWORD.
  Rotate GITHUB_TOKEN if compromised.
