import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { findMemberByEmailAndId } from './lib/member-registration.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Database not configured' });
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
    const member = await findMemberByEmailAndId(supabase, email, membershipId);
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const { data, error } = await supabase
      .from('event_bookings')
      .select('id, event_id, event_title, tickets, notes, created_at')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ bookings: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not load bookings' });
  }
}
