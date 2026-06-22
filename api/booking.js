import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Booking database not configured' });
    return;
  }

  const {
    eventId,
    eventTitle,
    name,
    email,
    phone,
    tickets,
    notes
  } = req.body || {};

  if (!eventId?.trim() || !eventTitle?.trim() || !name?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'Event, name, and email are required' });
    return;
  }

  const ticketCount = Math.max(1, Math.min(20, parseInt(tickets, 10) || 1));

  const supabase = getSupabase();
  const { error } = await supabase.from('event_bookings').insert({
    event_id: eventId.trim(),
    event_title: eventTitle.trim(),
    name: name.trim(),
    email: email.trim(),
    phone: (phone || '').trim(),
    tickets: ticketCount,
    notes: (notes || '').trim()
  });

  if (error) {
    res.status(500).json({ error: 'Failed to save booking', detail: error.message });
    return;
  }

  res.status(200).json({ ok: true, message: 'Booking received. Payment will be added in a future update.' });
}
