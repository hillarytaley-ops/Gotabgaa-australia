import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Vote database not configured' });
    return;
  }

  const name = String(req.body?.name || '').trim();
  const email = normalizeEmail(req.body?.email);
  const vote = String(req.body?.vote || '').trim().toLowerCase();
  const suggestion = String(req.body?.suggestion || '').trim();

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }
  if (vote !== 'aye' && vote !== 'nay') {
    res.status(400).json({ error: 'Vote must be Aye or Nay' });
    return;
  }
  if (suggestion && suggestion.length < 8) {
    res.status(400).json({ error: 'Please write your idea in a few words, or leave it blank' });
    return;
  }
  if (suggestion.length > 2000) {
    res.status(400).json({ error: 'Please keep your idea under 2000 characters' });
    return;
  }

  const supabase = getSupabase();
  const { data: existing, error: lookupError } = await supabase
    .from('efare_votes')
    .select('id')
    .ilike('email', email)
    .limit(1);

  if (lookupError) {
    res.status(500).json({ error: 'Could not check previous votes', detail: lookupError.message });
    return;
  }
  if (existing?.length) {
    res.status(409).json({ error: 'This email has already voted on the E-Fare proposal.' });
    return;
  }

  const { error } = await supabase.from('efare_votes').insert({ name, email, vote });
  if (error) {
    if (/duplicate|unique|23505/i.test(String(error.message))) {
      res.status(409).json({ error: 'This email has already voted on the E-Fare proposal.' });
      return;
    }
    res.status(500).json({ error: 'Could not save vote', detail: error.message });
    return;
  }

  if (suggestion) {
    const { error: suggestionError } = await supabase.from('efare_suggestions').insert({
      name,
      email,
      suggestion
    });
    if (suggestionError && !/does not exist|schema cache|PGRST204|42P01/i.test(String(suggestionError.message))) {
      res.status(200).json({ ok: true, vote, suggestionSaved: false });
      return;
    }
  }

  res.status(200).json({ ok: true, vote, suggestionSaved: Boolean(suggestion) });
}
