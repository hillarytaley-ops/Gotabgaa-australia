import { getSupabase } from './supabase.js';
import {
  findActiveMemberByEmail,
  findMemberByEmailAndId,
  getMemberMeta,
  normalizeMemberEmail,
  serializeMemberProfile
} from './member-registration.js';

export function getPublicSiteUrl() {
  const fromEnv = String(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return 'https://gotabgaa-australia.vercel.app';
}

export function readBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export async function getAuthUserFromToken(accessToken) {
  if (!accessToken) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

export async function resolveMemberFromRequest(req) {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, status: 503, error: 'Member database not configured' };
  }

  const token = readBearerToken(req);
  if (token) {
    const user = await getAuthUserFromToken(token);
    if (!user?.email) {
      return { ok: false, status: 401, error: 'Invalid or expired sign-in session. Please sign in again.' };
    }

    const row = await findActiveMemberByEmail(supabase, user.email);
    if (!row) {
      return {
        ok: false,
        status: 403,
        error: 'No active membership is linked to this account. Contact Gotabgaa Australia if you need help.'
      };
    }

    const meta = getMemberMeta(row);
    if (meta.memberStatus === 'inactive') {
      return {
        ok: false,
        status: 403,
        error: 'This membership is inactive. Contact Gotabgaa Australia for assistance.'
      };
    }
    if (!meta.membershipId) {
      return {
        ok: false,
        status: 403,
        error: 'This registration does not have a membership ID yet.'
      };
    }

    const member = serializeMemberProfile(row);
    member.adminAccess = memberHasAdminAccess(row, user);
    return {
      ok: true,
      user,
      row,
      member,
      accessToken: token
    };
  }

  // Legacy fallback: email + membership ID query params
  const email = normalizeMemberEmail(req.query?.email);
  const membershipId = String(req.query?.id || req.query?.membershipId || '').trim().toUpperCase();
  if (!email || !membershipId) {
    return {
      ok: false,
      status: 401,
      error: 'Sign in required. Use your email and password, or provide a valid session token.'
    };
  }

  const row = await findMemberByEmailAndId(supabase, email, membershipId);
  if (!row) {
    return { ok: false, status: 404, error: 'No member found with that email and membership ID' };
  }

  const meta = getMemberMeta(row);
  if (!meta.membershipId) {
    return {
      ok: false,
      status: 403,
      error: 'This registration does not have a membership ID yet. Our team will email you when approved.'
    };
  }
  if (meta.memberStatus === 'inactive') {
    return {
      ok: false,
      status: 403,
      error: 'This membership is inactive. Contact Gotabgaa Australia for assistance.'
    };
  }

  const member = serializeMemberProfile(row);
  member.adminAccess = memberHasAdminAccess(row, null);
  return {
    ok: true,
    user: null,
    row,
    member,
    legacy: true
  };
}

async function findAuthUserByEmail(supabase, email) {
  const normalized = normalizeMemberEmail(email);
  if (!normalized) return null;

  // Prefer listUsers pagination for smaller projects; fall back to generateLink probe
  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find(u => normalizeMemberEmail(u.email) === normalized);
    if (match) return match;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

export async function ensureMemberAuthUser(supabase, { email, name, membershipId, authUserId }) {
  const normalizedEmail = normalizeMemberEmail(email);
  if (!normalizedEmail) throw new Error('Member email is required to create a login account');

  const metadata = {
    name: name || '',
    membership_id: membershipId || '',
    role: 'member'
  };

  if (authUserId) {
    const { data, error } = await supabase.auth.admin.updateUserById(authUserId, {
      email: normalizedEmail,
      email_confirm: true,
      ban_duration: 'none',
      user_metadata: metadata,
      app_metadata: { role: 'member', membership_id: membershipId || '' }
    });
    if (!error && data?.user) return data.user;
  }

  const existing = await findAuthUserByEmail(supabase, normalizedEmail);
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      ban_duration: 'none',
      user_metadata: { ...(existing.user_metadata || {}), ...metadata },
      app_metadata: { ...(existing.app_metadata || {}), role: 'member', membership_id: membershipId || '' }
    });
    if (error) throw error;
    return data.user;
  }

  const tempPassword = `Gaa-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}!`;
  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: { role: 'member', membership_id: membershipId || '' }
  });

  if (error) {
    if (/already|registered|exists/i.test(String(error.message || ''))) {
      const again = await findAuthUserByEmail(supabase, normalizedEmail);
      if (again) {
        const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(again.id, {
          email_confirm: true,
          ban_duration: 'none',
          user_metadata: { ...(again.user_metadata || {}), ...metadata },
          app_metadata: { ...(again.app_metadata || {}), role: 'member', membership_id: membershipId || '' }
        });
        if (updateError) throw updateError;
        return updated.user;
      }
    }
    throw error;
  }
  return data.user;
}

export async function createPasswordSetupLink(supabase, email) {
  const redirectTo = `${getPublicSiteUrl()}/set-password.html`;
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: normalizeMemberEmail(email),
    options: { redirectTo }
  });
  if (error) throw error;

  const actionLink = data?.properties?.action_link || data?.action_link || null;
  return { actionLink, redirectTo };
}

export async function banMemberAuthUser(supabase, authUserId) {
  if (!authUserId) return;
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    ban_duration: '876000h'
  });
  if (error) throw error;
}

export function getStoredAuthUserId(row) {
  return row?.data?._authUserId || row?.auth_user_id || null;
}

export function getAdminEmailAllowlist() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => normalizeMemberEmail(e))
    .filter(Boolean);
}

export function memberHasAdminAccess(row, user = null) {
  if (row?.data?._adminAccess === true) return true;
  if (user?.app_metadata?.admin === true || user?.app_metadata?.role === 'admin') return true;
  const email = normalizeMemberEmail(row?.email || user?.email);
  if (email && getAdminEmailAllowlist().includes(email)) return true;
  return false;
}

export async function syncAuthAdminRole(supabase, authUserId, adminAccess, membershipId = '') {
  if (!supabase || !authUserId) return;
  const { data: existing } = await supabase.auth.admin.getUserById(authUserId);
  const user = existing?.user;
  if (!user) return;

  const role = adminAccess ? 'admin' : 'member';
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    user_metadata: {
      ...(user.user_metadata || {}),
      membership_id: membershipId || user.user_metadata?.membership_id || ''
    },
    app_metadata: {
      ...(user.app_metadata || {}),
      role,
      admin: adminAccess === true,
      membership_id: membershipId || user.app_metadata?.membership_id || ''
    }
  });
  if (error) throw error;
}
