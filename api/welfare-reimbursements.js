import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  verifyActiveWelfareMember,
  createReimbursementAlert,
  deactivateReimbursementAlerts,
  PROCESSING_STATUSES,
  REIMBURSEMENT_STATUSES
} from './lib/welfare-member.js';
import { getSupabase as getSb } from './lib/supabase.js';

async function loadAlertTemplate() {
  try {
    const supabase = getSb();
    const { data } = await supabase.from('site_content').select('data').eq('id', 'main').maybeSingle();
    return data?.data?.welfare?.membership?.communityAlertMessage
      || 'A fellow welfare member is currently going through a bereavement reimbursement process. Please keep our community in your thoughts and prayers — member details remain confidential.';
  } catch {
    return 'A fellow welfare member is currently going through a bereavement reimbursement process. Please keep our community in your thoughts and prayers.';
  }
}

export default async function handler(req, res) {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Welfare database not configured' });
    return;
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const email = String(req.query?.email || '').trim().toLowerCase();
    const membershipId = String(req.query?.id || '').trim().toUpperCase();

    if (!email || !membershipId) {
      res.status(400).json({ error: 'Email and membership ID are required' });
      return;
    }

    try {
      const check = await verifyActiveWelfareMember(supabase, email, membershipId);
      if (!check.ok) {
        res.status(403).json({ error: check.error });
        return;
      }

      const { data, error } = await supabase
        .from('welfare_reimbursement_requests')
        .select('*')
        .ilike('email', email)
        .eq('membership_id', membershipId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.status(200).json({ requests: data || [] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'POST') {
    const {
      email,
      membershipId,
      deceasedName,
      relationship,
      dateOfLoss,
      summary
    } = req.body || {};

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedId = String(membershipId || '').trim().toUpperCase();

    if (!normalizedEmail || !normalizedId || !deceasedName?.trim() || !relationship?.trim()) {
      res.status(400).json({ error: 'Email, membership ID, deceased name, and relationship are required' });
      return;
    }

    try {
      const check = await verifyActiveWelfareMember(supabase, normalizedEmail, normalizedId);
      if (!check.ok) {
        res.status(403).json({ error: check.error });
        return;
      }

      const { data: openReq } = await supabase
        .from('welfare_reimbursement_requests')
        .select('id')
        .ilike('email', normalizedEmail)
        .eq('membership_id', normalizedId)
        .in('status', ['submitted', 'under_review', 'approved'])
        .limit(1);

      if (openReq?.length) {
        res.status(409).json({ error: 'You already have an open reimbursement request. Track its progress on your dashboard.' });
        return;
      }

      const { data: row, error } = await supabase
        .from('welfare_reimbursement_requests')
        .insert({
          email: normalizedEmail,
          membership_id: normalizedId,
          member_name: check.welfare.name,
          deceased_name: deceasedName.trim(),
          relationship: relationship.trim(),
          date_of_loss: (dateOfLoss || '').trim(),
          summary: (summary || '').trim(),
          status: 'submitted',
          status_updated_at: new Date().toISOString()
        })
        .select('id, status, created_at')
        .single();

      if (error) throw error;

      res.status(200).json({
        ok: true,
        request: row,
        message: 'Your reimbursement request has been submitted. The welfare team will review it confidentially.'
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Could not submit request' });
    }
    return;
  }

  if (req.method === 'PATCH') {
    const token = readAuthToken(req);
    if (!verifyToken(token, getAdminSecret())) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id, status, statusMessage, read } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Request id is required' });
      return;
    }

    try {
      const updates = { status_updated_at: new Date().toISOString() };
      if (read != null) updates.read = read;
      if (status) {
        if (!REIMBURSEMENT_STATUSES.includes(status)) {
          res.status(400).json({ error: 'Invalid status' });
          return;
        }
        updates.status = status;
      }
      if (statusMessage != null) updates.status_message = statusMessage;

      const { data: row, error } = await supabase
        .from('welfare_reimbursement_requests')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      if (status && PROCESSING_STATUSES.includes(status)) {
        const template = await loadAlertTemplate();
        await createReimbursementAlert(supabase, id, template);
      }

      if (status === 'declined' || status === 'paid') {
        await deactivateReimbursementAlerts(supabase, id);
      }

      res.status(200).json({ ok: true, request: row });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
