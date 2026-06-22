import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Application database not configured' });
    return;
  }

  const body = req.body || {};
  const personal = body.personal || {};
  const email = personal.email?.trim() || body.email?.trim();
  const fullName = personal.fullName?.trim()
    || [personal.givenNames, personal.surname].filter(Boolean).join(' ').trim()
    || body.fullName?.trim();

  if (!fullName || !email) {
    res.status(400).json({ error: 'Full name and email are required' });
    return;
  }

  if (!body.declaration?.agreed) {
    res.status(400).json({ error: 'You must agree to the declaration before submitting' });
    return;
  }

  const nameParts = fullName.split(/\s+/);
  const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : fullName;
  const givenNames = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';

  const supabase = getSupabase();
  const { error } = await supabase.from('ailcd_applications').insert({
    surname: surname || null,
    given_names: givenNames || null,
    full_name: fullName,
    email,
    phone: (personal.mobile || personal.phone || body.phone || '').trim() || null,
    state: (personal.stateTerritory || personal.state || body.state || '').trim() || null,
    data: body
  });

  if (error) {
    res.status(500).json({ error: 'Failed to save application', detail: error.message });
    return;
  }

  res.status(200).json({
    ok: true,
    message: 'Expression of interest received. Thank you — our team will contact you shortly.'
  });
}
