import { isSupabaseConfigured, getSupabase } from './lib/supabase.js';
import { resolveMemberFromRequest } from './lib/member-auth.js';
import { normalizeMemberEmail } from './lib/member-registration.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  try {
    const resolved = await resolveMemberFromRequest(req);
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }

    const email = normalizeMemberEmail(resolved.member.email);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('event_bookings')
      .select('id, event_id, event_title, tickets, notes, payment_status, payment_reference, fee_amount, fee_display, created_at, data')
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
