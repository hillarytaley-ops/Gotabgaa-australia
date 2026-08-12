/**
 * Admin ops status (safe flags only — no secrets).
 * GET with Bearer admin token.
 */
import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { isEmailConfigured } from './lib/email.js';
import { isSupabaseConfigured } from './lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = readAuthToken(req);
  if (!verifyToken(token, getAdminSecret())) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const emailFrom = process.env.EMAIL_FROM || '';
  const siteUrl = process.env.SITE_URL || 'https://gotabgaa-australia.vercel.app';
  const usingDevFrom = !emailFrom || /onboarding@resend\.dev/i.test(emailFrom);

  res.status(200).json({
    emailConfigured: isEmailConfigured(),
    emailFromSet: Boolean(emailFrom),
    usingResendDevSender: usingDevFrom,
    siteUrl,
    supabaseConfigured: isSupabaseConfigured(),
    memberAuthConfigured: Boolean(
      process.env.SUPABASE_URL
      && (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ),
    tips: isEmailConfigured()
      ? (usingDevFrom
        ? ['RESEND_API_KEY is set, but EMAIL_FROM still uses the Resend test sender. Verify gotabgaaaustralia.org (or your domain) in Resend, then set EMAIL_FROM to noreply@your-domain and redeploy.']
        : ['Password / approval emails should send. Test with Admin → Membership → Send password setup.'])
      : [
        'Add RESEND_API_KEY in Vercel → Settings → Environment Variables.',
        'Set EMAIL_FROM (for testing: Gotabgaa Australia <onboarding@resend.dev>).',
        'Confirm SITE_URL=https://gotabgaa-australia.vercel.app',
        'Redeploy, then Approve a member or click Send password setup.'
      ]
  });
}
