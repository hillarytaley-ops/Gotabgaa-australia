/**
 * Exchange a signed-in member session for an admin dashboard token
 * when the member has leadership/admin access.
 */
import { createToken, getAdminSecret } from './lib/auth.js';
import {
  getAuthUserFromToken,
  isAllowlistedAdminEmail,
  memberHasAdminAccess,
  readBearerToken
} from './lib/member-auth.js';
import { findActiveMemberByEmail } from './lib/member-registration.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Member database not configured' });
    return;
  }

  const secret = getAdminSecret();
  if (!secret) {
    res.status(503).json({ error: 'ADMIN_SECRET is not configured' });
    return;
  }

  try {
    const accessToken = readBearerToken(req);
    if (!accessToken) {
      res.status(401).json({ error: 'Sign in required' });
      return;
    }

    const user = await getAuthUserFromToken(accessToken);
    if (!user?.email) {
      res.status(401).json({ error: 'Invalid or expired sign-in session' });
      return;
    }

    const supabase = getSupabase();
    const row = await findActiveMemberByEmail(supabase, user.email);
    const allowlisted = isAllowlistedAdminEmail(user.email);

    if (!row && !allowlisted) {
      res.status(403).json({ error: 'No active membership is linked to this account.' });
      return;
    }

    if (!allowlisted && !memberHasAdminAccess(row, user)) {
      res.status(403).json({
        error: 'This account does not have leadership admin access. Ask an authorised admin to grant it in Membership.'
      });
      return;
    }

    const token = createToken(secret);
    if (!token) {
      res.status(503).json({ error: 'Could not create admin session' });
      return;
    }

    res.status(200).json({
      token,
      expiresIn: 8 * 60 * 60,
      email: user.email,
      name: row?.name || user.user_metadata?.name || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not open admin session' });
  }
}
