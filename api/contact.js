import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Contact database not configured' });
    return;
  }

  const { name, email, subject, message } = req.body || {};

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    res.status(400).json({ error: 'Name, email, and message are required' });
    return;
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('contact_submissions').insert({
    name: name.trim(),
    email: email.trim(),
    subject: (subject || 'general').trim(),
    message: message.trim()
  });

  if (error) {
    res.status(500).json({ error: 'Failed to save message', detail: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
