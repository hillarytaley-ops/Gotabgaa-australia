import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Feedback database not configured' });
    return;
  }

  const answers = req.body?.answers;
  if (!answers || typeof answers !== 'object') {
    res.status(400).json({ error: 'Answers are required' });
    return;
  }

  const required = ['attended', 'overall', 'useful', 'come_again'];
  for (const key of required) {
    if (!String(answers[key] || '').trim()) {
      res.status(400).json({ error: 'Please complete all required questions' });
      return;
    }
  }

  const row = {
    attended: String(answers.attended || '').trim(),
    state: String(answers.state || '').trim() || null,
    overall: String(answers.overall || '').trim(),
    useful: String(answers.useful || '').trim(),
    topics: Array.isArray(answers.topics) ? answers.topics.map(String) : [],
    time_ok: String(answers.time_ok || '').trim() || null,
    zoom: String(answers.zoom || '').trim() || null,
    come_again: String(answers.come_again || '').trim(),
    next_steps: Array.isArray(answers.next) ? answers.next.map(String) : [],
    answers
  };

  const supabase = getSupabase();
  const { error } = await supabase.from('meet_greet_feedback').insert(row);

  if (error) {
    res.status(500).json({ error: 'Failed to save feedback', detail: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
