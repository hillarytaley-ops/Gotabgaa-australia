import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { sendMeetGreetFeedbackThanks } from './lib/email.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

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

  const name = String(answers.name || req.body?.name || '').trim() || null;
  const email = normalizeEmail(answers.email || req.body?.email);
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address' });
    return;
  }

  const supabase = getSupabase();

  const { data: existing, error: lookupError } = await supabase
    .from('meet_greet_feedback')
    .select('id')
    .ilike('email', email)
    .limit(1);

  if (lookupError) {
    res.status(500).json({ error: 'Failed to check previous submissions', detail: lookupError.message });
    return;
  }

  if (existing?.length) {
    res.status(409).json({ error: 'This email has already submitted Meet & Greet feedback. Thank you.' });
    return;
  }

  const row = {
    name,
    email,
    attended: String(answers.attended || '').trim(),
    state: String(answers.state || '').trim() || null,
    overall: String(answers.overall || '').trim(),
    useful: String(answers.useful || '').trim(),
    topics: Array.isArray(answers.topics) ? answers.topics.map(String) : [],
    time_ok: String(answers.time_ok || '').trim() || null,
    zoom: String(answers.zoom || '').trim() || null,
    come_again: String(answers.come_again || '').trim(),
    next_steps: Array.isArray(answers.next) ? answers.next.map(String) : [],
    answers: { ...answers, email, name }
  };

  const { error } = await supabase.from('meet_greet_feedback').insert(row);

  if (error) {
    if (/duplicate|unique|23505/i.test(String(error.message))) {
      res.status(409).json({ error: 'This email has already submitted Meet & Greet feedback. Thank you.' });
      return;
    }
    res.status(500).json({ error: 'Failed to save feedback', detail: error.message });
    return;
  }

  const emailResult = await sendMeetGreetFeedbackThanks({
    to: email,
    name: name || 'Friend'
  });

  res.status(200).json({
    ok: true,
    emailSent: Boolean(emailResult?.ok),
    emailSkipped: Boolean(emailResult?.skipped),
    emailError: emailResult?.ok ? undefined : (emailResult?.error || emailResult?.reason)
  });
}
