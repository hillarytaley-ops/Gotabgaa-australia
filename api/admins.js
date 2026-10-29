/**
 * Onboard admins — list / invite / resend / remove committee dashboard access.
 */
import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { sendAdminInvite, isEmailConfigured } from './lib/email.js';
import {
  createPasswordSetupLink,
  ensureMemberAuthUser,
  isDeveloperAdmin,
  syncAuthAdminRole
} from './lib/member-auth.js';
import { normalizeMemberEmail } from './lib/member-registration.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

function missingTable(error) {
  return /relation|does not exist|Could not find the table|PGRST205/i.test(String(error?.message || error || ''));
}

function tableMissingResponse(res) {
  res.status(503).json({
    error: 'Committee admin list is not set up yet. Run supabase/migrate-site-admins.sql in the Supabase SQL Editor, then try again.'
  });
}

async function listAdmins(supabase) {
  const { data, error } = await supabase
    .from('site_admins')
    .select('email, full_name, invited_at, created_at')
    .order('full_name', { ascending: true })
    .limit(200);

  if (error) throw error;
  return data || [];
}

export default async function handler(req, res) {
  const token = readAuthToken(req);
  if (!verifyToken(token, getAdminSecret())) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      try {
        const rows = await listAdmins(supabase);
        res.status(200).json({
          rows: rows.map(row => ({
            ...row,
            is_developer: isDeveloperAdmin(row.email)
          }))
        });
      } catch (error) {
        if (missingTable(error)) {
          tableMissingResponse(res);
          return;
        }
        throw error;
      }
      return;
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || 'invite').trim().toLowerCase();
      const email = normalizeMemberEmail(req.body?.email);
      const fullName = String(req.body?.full_name || req.body?.name || '').trim().slice(0, 120);

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        res.status(400).json({ error: 'Enter a valid email address.' });
        return;
      }

      if (action === 'remove') {
        if (isDeveloperAdmin(email)) {
          res.status(400).json({
            error: 'The developer account cannot be removed by anyone on the committee.'
          });
          return;
        }

        let rows;
        try {
          rows = await listAdmins(supabase);
        } catch (error) {
          if (missingTable(error)) {
            tableMissingResponse(res);
            return;
          }
          throw error;
        }

        if (rows.length <= 1) {
          res.status(400).json({ error: 'Keep at least one committee admin on the list.' });
          return;
        }

        const target = rows.find(r => normalizeMemberEmail(r.email) === email);
        if (!target) {
          res.status(404).json({ error: 'That committee admin was not found.' });
          return;
        }

        const { error: delError } = await supabase
          .from('site_admins')
          .delete()
          .eq('email', email);

        if (delError) {
          if (missingTable(delError)) {
            tableMissingResponse(res);
            return;
          }
          throw delError;
        }

        // Drop Auth admin flag if present; do not ban (they may still be a member).
        try {
          let page = 1;
          let authUser = null;
          while (page <= 10 && !authUser) {
            const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
            const users = data?.users || [];
            authUser = users.find(u => normalizeMemberEmail(u.email) === email) || null;
            if (users.length < 200) break;
            page += 1;
          }
          if (authUser?.id) {
            await syncAuthAdminRole(supabase, authUser.id, false);
          }
        } catch (err) {
          console.warn('[admins] clear auth role', err?.message || err);
        }

        res.status(200).json({ ok: true, email });
        return;
      }

      if (!fullName || fullName.length < 2) {
        res.status(400).json({ error: 'Enter the committee member’s full name.' });
        return;
      }

      // invite or resend
      if (!isEmailConfigured()) {
        res.status(503).json({
          error: 'Invitation email is not configured. Add RESEND_API_KEY in Vercel, then redeploy.'
        });
        return;
      }

      let existing = null;
      try {
        const { data, error } = await supabase
          .from('site_admins')
          .select('email, full_name')
          .eq('email', email)
          .maybeSingle();
        if (error) throw error;
        existing = data;
      } catch (error) {
        if (missingTable(error)) {
          tableMissingResponse(res);
          return;
        }
        throw error;
      }

      const invitedAt = new Date().toISOString();
      const payload = { email, full_name: fullName, invited_at: invitedAt };

      if (existing) {
        const { error } = await supabase
          .from('site_admins')
          .update({ full_name: fullName, invited_at: invitedAt })
          .eq('email', email);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('site_admins')
          .insert(payload);
        if (error) throw error;
      }

      const authUser = await ensureMemberAuthUser(supabase, {
        email,
        name: fullName,
        membershipId: 'GAA-ADMIN',
        authUserId: null
      });
      await syncAuthAdminRole(supabase, authUser.id, true, 'GAA-ADMIN');

      const { actionLink } = await createPasswordSetupLink(supabase, email);
      if (!actionLink) {
        res.status(502).json({ error: 'Could not create a password link. Try again shortly.' });
        return;
      }

      const sent = await sendAdminInvite({
        to: email,
        name: fullName,
        setupLink: actionLink
      });

      if (!sent.ok) {
        res.status(502).json({
          error: sent.error || sent.reason || 'The invitation email could not be sent.',
          setupLink: actionLink
        });
        return;
      }

      res.status(200).json({
        ok: true,
        email,
        full_name: fullName,
        resent: Boolean(existing),
        message: existing
          ? `Invitation re-sent to ${email}. They can create or reset their password from the email.`
          : `Invitation sent to ${email}. They can create their password from the email, then sign in at Sign In → Admin.`
      });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[admins]', error);
    if (missingTable(error)) {
      tableMissingResponse(res);
      return;
    }
    res.status(500).json({ error: error.message || 'Could not update committee admins.' });
  }
}
