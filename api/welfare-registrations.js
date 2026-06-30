import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { getWelfareMeta } from './lib/welfare-member.js';
import { loadPaymentConfig } from './lib/payment.js';
import { sendPaymentReceipt } from './lib/email.js';

export default async function handler(req, res) {
  const token = readAuthToken(req);
  if (!verifyToken(token, getAdminSecret())) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Welfare database not configured' });
    return;
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('welfare_registrations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const reimbursements = await supabase
        .from('welfare_reimbursement_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      res.status(200).json({
        registrations: (data || []).map(r => ({ ...r, meta: getWelfareMeta(r) })),
        reimbursements: reimbursements.data || []
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'PATCH') {
    const { id, action, read, welfareStatus, paymentStatus } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Registration id is required' });
      return;
    }

    try {
      const { data: row, error: fetchError } = await supabase
        .from('welfare_registrations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!row) {
        res.status(404).json({ error: 'Registration not found' });
        return;
      }

      const updates = {};

      if (read != null) updates.read = read;

      if (action === 'approve') {
        updates.welfare_status = 'active';
      } else if (action === 'revoke') {
        updates.welfare_status = 'inactive';
      } else if (welfareStatus) {
        updates.welfare_status = welfareStatus;
      }

      if (action === 'markPaid' || paymentStatus === 'paid') {
        updates.payment_status = 'paid';
        updates.payment_method = 'PayID/EFT';
        updates.paid_at = new Date().toISOString();
      } else if (paymentStatus) {
        updates.payment_status = paymentStatus;
      }

      const { data: updated, error } = await supabase
        .from('welfare_registrations')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      if (action === 'markPaid') {
        const paymentConfig = await loadPaymentConfig();
        const meta = getWelfareMeta(updated);
        await sendPaymentReceipt({
          to: updated.email,
          name: updated.name,
          payment: paymentConfig,
          amount: updated.fee_display,
          reference: meta.paymentReference,
          type: 'Social welfare membership'
        });
      }

      res.status(200).json({ ok: true, registration: updated, meta: getWelfareMeta(updated) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id;
    if (!id) {
      res.status(400).json({ error: 'Registration id is required' });
      return;
    }

    const { error } = await supabase.from('welfare_registrations').delete().eq('id', id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
