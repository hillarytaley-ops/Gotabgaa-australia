/**
 * Send a password reset / first-password link via Resend.
 * Supabase Auth's built-in emails are not used (they often never arrive).
 */
import { sendPasswordReset, isEmailConfigured } from './lib/email.js';
import {
  createPasswordSetupLink,
  ensureMemberAuthUser,
  getStoredAuthUserId,
  isAllowlistedAdminEmail,
  memberHasAdminAccess,
  syncAuthAdminRole
} from './lib/member-auth.js';
import { findActiveMemberByEmail, normalizeMemberEmail } from './lib/member-registration.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

function genericOk(res) {
  res.status(200).json({
    ok: true,
    message: 'If that email has an account, we sent a password link. Check inbox and spam.'
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const email = normalizeMemberEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ error: 'Enter your email address first, then click Forgot password.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Member sign-in is not configured yet.' });
    return;
  }

  if (!isEmailConfigured()) {
    res.status(503).json({
      error: 'Password emails are not configured. Add RESEND_API_KEY in Vercel, then redeploy.'
    });
    return;
  }

  try {
    const supabase = getSupabase();
    const row = await findActiveMemberByEmail(supabase, email);
    const allowlisted = isAllowlistedAdminEmail(email);

    if (!row && !allowlisted) {
      genericOk(res);
      return;
    }

    const name = row?.name || email.split('@')[0];
    const membershipId = row
      ? (row.membership_id || row.data?._membershipId || '')
      : 'ADMIN';

    const authUser = await ensureMemberAuthUser(supabase, {
      email,
      name,
      membershipId,
      authUserId: row ? getStoredAuthUserId(row) : null
    });

    if (allowlisted || (row && memberHasAdminAccess(row, authUser))) {
      await syncAuthAdminRole(supabase, authUser.id, true, membershipId || 'ADMIN');
    }

    const { actionLink } = await createPasswordSetupLink(supabase, email);
    if (!actionLink) {
      res.status(500).json({ error: 'Could not create a password link. Try again in a few minutes.' });
      return;
    }

    const sent = await sendPasswordReset({
      to: email,
      name,
      resetLink: actionLink
    });

    if (!sent.ok) {
      console.error('[password-reset] email failed', sent.error || sent.reason);
      res.status(502).json({
        error: sent.error || sent.reason || 'The password email could not be sent. Check spam, or try again shortly.'
      });
      return;
    }

    genericOk(res);
  } catch (error) {
    console.error('[password-reset]', error);
    res.status(500).json({ error: error.message || 'Could not send the password email.' });
  }
}
