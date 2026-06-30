import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  findWelfareRegistration,
  getWelfareMeta,
  verifyMainMember,
  getActiveCommunityAlerts
} from './lib/welfare-member.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Welfare database not configured' });
    return;
  }

  const email = String(req.query?.email || '').trim().toLowerCase();
  const membershipId = String(req.query?.id || req.query?.membershipId || '')
    .trim()
    .toUpperCase();

  if (!email || !membershipId) {
    res.status(400).json({ error: 'Email and membership ID are required' });
    return;
  }

  const supabase = getSupabase();

  try {
    const mainCheck = await verifyMainMember(supabase, email, membershipId);
    if (!mainCheck.ok) {
      res.status(403).json({ error: mainCheck.error });
      return;
    }

    const welfareRow = await findWelfareRegistration(supabase, email, membershipId);
    const welfare = welfareRow ? getWelfareMeta(welfareRow) : null;

    let reimbursements = [];
    if (welfare) {
      const { data, error } = await supabase
        .from('welfare_reimbursement_requests')
        .select('id, deceased_name, relationship, date_of_loss, summary, status, status_message, status_updated_at, created_at')
        .ilike('email', email)
        .eq('membership_id', membershipId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      reimbursements = data || [];
    }

    let alerts = [];
    if (welfare?.welfareStatus === 'active') {
      alerts = await getActiveCommunityAlerts(supabase);
    }

    res.status(200).json({
      welfare,
      reimbursements,
      alerts,
      hasWelfareAccess: Boolean(welfare && welfare.welfareStatus !== 'inactive')
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not load welfare membership' });
  }
}
