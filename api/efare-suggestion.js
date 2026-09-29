import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Suggestions database not configured' });
    return;
  }

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const suggestion = String(req.body?.suggestion || '').trim();

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }
  if (suggestion.length < 8) {
    res.status(400).json({ error: 'Please write your idea in a few words' });
    return;
  }
  if (suggestion.length > 2000) {
    res.status(400).json({ error: 'Please keep your suggestion under 2000 characters' });
    return;
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('efare_suggestions').insert({
    name,
    email,
    suggestion
  });

  if (error) {
    res.status(500).json({ error: 'Could not save suggestion', detail: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
