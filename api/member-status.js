import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { findMemberByEmailAndId, getMemberMeta } from './lib/member-registration.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Member database not configured' });
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
    const row = await findMemberByEmailAndId(supabase, email, membershipId);

    if (!row) {
      res.status(404).json({ error: 'No member found with that email and membership ID' });
      return;
    }

    const meta = getMemberMeta(row);

    if (!meta.membershipId) {
      res.status(403).json({
        error: 'This registration does not have a membership ID yet. Our team will email you when approved.'
      });
      return;
    }

    if (String(meta.membershipId).toUpperCase() !== membershipId) {
      res.status(404).json({ error: 'No member found with that email and membership ID' });
      return;
    }

    if (meta.memberStatus === 'inactive') {
      res.status(403).json({
        error: 'This membership is inactive. Contact Gotabgaa Australia for assistance.'
      });
      return;
    }

    res.status(200).json({
      member: {
        name: row.name,
        email: row.email,
        phone: row.phone,
        stateChapter: row.state_chapter,
        membershipType: row.membership_type,
        membershipId: meta.membershipId,
        memberStatus: meta.memberStatus || 'active',
        paymentStatus: meta.paymentStatus,
        feeDisplay: row.fee_display,
        joinedAt: row.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not load membership' });
  }
}
